import { segmentMatchesMode } from '../bookingUtils';
import { timeToMinutes } from '../timeUtils';
import { shouldIncludeDataItemInAnalysis } from '../dataVisibility';
import { resolveGroupIdAtDate, splitBookingByGroupAtDate } from '../financeUtils';

function getBayKiBiGWeightForChild(child, groupDef) {
  if (!child) return 1;

  if (groupDef?.type === 'Schulkindgruppe') {
    return 1.2;
  }

  const age = Number(child.age || child.rawdata?.ALTER || 3);
  if (Number.isFinite(age) && age < 3) {
    return 2;
  }

  return 1;
}

function getCategoryMinutes(category) {
  if (typeof category !== 'string') return null;
  const [, time] = category.split(' ');
  return timeToMinutes(time || '');
}

function getSegmentShareFactor(segment) {
  const allocation = Number(segment?.allocationSharePercent);
  if (!Number.isFinite(allocation)) return 1;
  return Math.max(0, allocation) / 100;
}

function sumWeightedBookingHours(booking, options = {}) {
  if (!Array.isArray(booking?.times)) return 0;
  const mode = options.mode || 'all';
  let totalMinutes = 0;

  booking.times.forEach((day) => {
    if (!Array.isArray(day?.segments)) return;
    day.segments.forEach((segment) => {
      if (!segmentMatchesMode(segment, mode)) return;

      const startMinutes = timeToMinutes(segment?.booking_start);
      const endMinutes = timeToMinutes(segment?.booking_end);
      if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return;

      totalMinutes += (endMinutes - startMinutes) * getSegmentShareFactor(segment);
    });
  });

  return totalMinutes / 60;
}

function getBookingContributionAtCategory(booking, dayName, categoryMinutes) {
  if (!Array.isArray(booking?.times)) return 0;

  return booking.times.reduce((total, dayObj) => {
    if (dayObj?.day_name !== dayName || !Array.isArray(dayObj?.segments)) return total;

    const segmentContribution = dayObj.segments.reduce((segmentTotal, segment) => {
      const startMinutes = timeToMinutes(segment?.booking_start);
      const endMinutes = timeToMinutes(segment?.booking_end);
      if (startMinutes === null || endMinutes === null) return segmentTotal;
      if (!(startMinutes <= categoryMinutes && endMinutes > categoryMinutes)) return segmentTotal;
      return segmentTotal + getSegmentShareFactor(segment);
    }, 0);

    return total + segmentContribution;
  }, 0);
}

// REMOVE any getScenarioChain or scenario traversal here!
// Only use the data passed in for calculations


/**
 * Generate a data series for expert ratio (percentage of qualified personnel per segment).
 * - qualificationDefs: array of { key, name, IsExpert }
 * - filteredCapacityBookings: array of bookings with qualifications
 * Returns array of percentages (0-100) for each category.
 */
export function generateExpertRatioSeries(categories, filteredCapacityBookings, qualificationDefs) {
  // Build a set of expert qualification keys
  const expertQualiKeys = new Set(
    (qualificationDefs || [])
      .filter(def => def.IsExpert !== false) // default true
      .map(def => def.key)
  );

  // For each category, count total personnel and expert personnel
  return categories.map((cat) => {
    // Parse category to day and time
    const [day] = cat.split(' ');
    const categoryMinutes = getCategoryMinutes(cat);
    let total = 0;
    let expert = 0;
    filteredCapacityBookings.forEach(booking => {
      // booking.times: [{ day_name, segments }]
      if (!Array.isArray(booking.times)) return;
      const contribution = getBookingContributionAtCategory(booking, day, categoryMinutes);
      if (contribution > 0) {
        total += contribution;
        // booking.qualifications: array of keys
        const qualiArr = Array.isArray(booking.qualifications) ? booking.qualifications : [];
        if (qualiArr.some(q => expertQualiKeys.has(q))) {
          expert += contribution;
        }
      }
    });
    if (total === 0) return 0;
    return Math.round((expert / total) * 100);
  });
}

/**
 * Berechnet den BayKiBiG-Anstellungsschlüssel für jedes Zeitsegment.
 * Gibt ein Array mit dem Schlüssel (z.B. 11.0) für jedes Segment zurück.
 */
export function generateCareRatioSeries(categories, filteredDemandBookings, filteredCapacityBookings, dataByScenario, groupDefs) {
  // Hilfsfunktion: Hole GroupDef nach groupId
  function getGroupDefById(groupId) {
    return groupDefs.find(g => String(g.id) === String(groupId));
  }

  return categories.map(cat => {
    // Parse category zu day und time
    const [day] = cat.split(' ');
    const categoryMinutes = getCategoryMinutes(cat);

    // Summe gewichtete Bedarfe (Kinderstunden)
    let weightedDemand = 0;
    filteredDemandBookings.forEach(booking => {
      if (!Array.isArray(booking.times)) return;
      const contribution = getBookingContributionAtCategory(booking, day, categoryMinutes);
      if (contribution > 0) {
        // Hole das Kind-Objekt und GroupDef
        const child = dataByScenario?.[booking.itemId];
        const groupDef = getGroupDefById(booking.groupId);
        const weight = getBayKiBiGWeightForChild(child, groupDef);
        weightedDemand += contribution * weight;
      }
    });

    // Summe Kapazität (Mitarbeiter)
    let capacityCount = 0;
    filteredCapacityBookings.forEach(booking => {
      if (!Array.isArray(booking.times)) return;
      capacityCount += getBookingContributionAtCategory(booking, day, categoryMinutes);
    });

    // Berechnung des Schlüssels
    if (capacityCount === 0) return 0;
    const ratio = weightedDemand / capacityCount;
    return Math.round(ratio * 10) / 10; // 1 Nachkommastelle
  });
}



/**
 * Overlay-aware booking filter.
 * Returns { demand: [...], capacity: [...] }
 * Now also checks simData presence (startdate/enddate) and absences.
 * Supports __NO_GROUP__ and __NO_QUALI__ in filter arrays.
 */
export function filterBookings({
  bookingsByScenario,
  dataByScenario,
  qualificationAssignmentsByScenario,
  overlaysByScenario,
  scenarioId,
  referenceDate,
  selectedGroups,
  selectedQualifications,
  groupsByScenario
}) {
  const demand = [];
  const capacity = [];
  const bookings = bookingsByScenario[scenarioId] || {};
  const dataItems = dataByScenario[scenarioId] || {};
  const overlays = overlaysByScenario[scenarioId] || {};
  const qualificationAssignments = qualificationAssignmentsByScenario[scenarioId] || {};
  const groupAssignments = groupsByScenario?.[scenarioId] || {}; // Ensure groupsByScenario is defined

  // Helper: get overlayed data item if exists
  function getOverlayedDataItem(itemId) {
    return overlays.dataItems?.[itemId] || dataItems[itemId];
  }

  // Helper: get overlayed bookings for an item
  function getOverlayedBookings(itemId) {
    const base = bookings[itemId] || {};
    const overlay = overlays.bookings?.[itemId] || {};
    return { ...base, ...overlay };
  }

  // Helper: get overlayed qualification assignments for an item
  function getOverlayedQualifications(itemId) {
    return qualificationAssignments[itemId] || {};
  }

  // Helper: check if booking is active at referenceDate
  function isActiveAt(booking, date) {
    const startOk = !booking.startdate || booking.startdate <= date;
    const endOk = !booking.enddate || booking.enddate >= date;
    return startOk && endOk;
  }

  // Helper: check if data item is present at referenceDate
  function isDataItemPresent(item, date) {
    const startOk = !item.startdate || item.startdate <= date;
    const endOk = !item.enddate || item.enddate >= date;
    return startOk && endOk;
  }

  // Helper: check if data item is absent at referenceDate
  function isDataItemAbsent(item, date) {
    if (!Array.isArray(item.absences)) return false;
    return item.absences.some(abs => {
      const startOk = !abs.startdate || abs.startdate <= date;
      const endOk = !abs.enddate || abs.enddate >= date;
      return startOk && endOk;
    });
  }

  function groupMatchesSelection(groupId) {
    if (selectedGroups.length === 0) return true;
    if (groupId && selectedGroups.includes(String(groupId))) return true;
    if (selectedGroups.includes('__NO_GROUP__') && !groupId) return true;
    return false;
  }

  Object.entries(dataItems).forEach(([itemId]) => {
    const overlayedItem = getOverlayedDataItem(itemId);
    if (!overlayedItem) return;
    if (!shouldIncludeDataItemInAnalysis(overlayedItem)) return;
    const type = overlayedItem.type;

    // Resolve groupId from group assignments or fallback to item groupId
    const groupId = resolveGroupIdAtDate(
      groupAssignments[itemId] || {},
      referenceDate,
      overlayedItem.groupId || null
    ) || null;

    // Check presence and absence
    if (!isDataItemPresent(overlayedItem, referenceDate)) return;
    if (isDataItemAbsent(overlayedItem, referenceDate)) return;

    // Group filter
    const groupMatch = groupMatchesSelection(groupId);

    // Get all bookings for this item (overlay-aware)
    const itemBookings = Object.values(getOverlayedBookings(itemId));

    // For demand: only group filter
    if (type === 'demand' && groupMatch) {
      itemBookings.forEach(booking => {
        if (isActiveAt(booking, referenceDate) && sumWeightedBookingHours(booking) > 0) {
          demand.push({ ...booking, itemId, groupId });
        }
      });
    }

    // For capacity: group and qualification filter
    if (type === 'capacity') {
      const qualiAssignments = Object.values(getOverlayedQualifications(itemId));
      const qualiKeys = qualiAssignments.map(a => a.qualification);

      let qualiMatch = false;
      if (selectedQualifications.length === 0) {
        qualiMatch = true;
      } else if (qualiKeys.some(q => selectedQualifications.includes(q))) {
        qualiMatch = true;
      } else if (selectedQualifications.includes('__NO_QUALI__') && qualiKeys.length === 0) {
        qualiMatch = true;
      }

      if (qualiMatch) {
        itemBookings.forEach(booking => {
          if (!isActiveAt(booking, referenceDate) || sumWeightedBookingHours(booking, { mode: 'pedagogical' }) <= 0) {
            return;
          }

          const splitBookings = splitBookingByGroupAtDate(
            booking,
            groupAssignments[itemId] || {},
            referenceDate,
            overlayedItem.groupId || null
          );

          splitBookings.forEach((splitBooking) => {
            if (!groupMatchesSelection(splitBooking.groupId)) return;
            if (sumWeightedBookingHours(splitBooking, { mode: 'pedagogical' }) <= 0) return;

            capacity.push({
              ...splitBooking,
              itemId,
              groupId: splitBooking.groupId,
              qualifications: qualiKeys,
            });
          });
        });
      }
    }
  });

  return { demand, capacity };
}

// /**
//  * Generate a data series for the chart by counting bookings per category (time segment).
//  * Each booking must have a 'times' array with { day, start, end }.
//  */
export function generateBookingDataSeries(referenceDate, filteredBookings, categories) {
  // categories: e.g. ["Mo 7:00", "Mo 7:30", ...]
  // Always return a new array, not a reference to a constant or reused array
  const series = new Array(categories.length).fill(0);

  // If categories is empty, still return a new array (not a shared constant)
  if (!categories || categories.length === 0) {
    return [];
  }

  // Helper: parse category to day and time
  function parseCategory(cat) {
    const [day, time] = cat.split(' ');
    return { day, time };
  }

  // For each category, count bookings that cover it
  categories.forEach((cat, idx) => {
    const { day } = parseCategory(cat);
    let count = 0;
    filteredBookings.forEach(booking => {
      count += getBookingContributionAtCategory(booking, day, getCategoryMinutes(cat));
    });
    series[idx] = count;
  });

  // Always return a new array (never a reference to a constant)
  return series.map(val => val); // Create a new array with copied values
}



// Helper function to ensure chart data arrays are mutable
export function cloneChartData(chartData) {
  if (!chartData || typeof chartData !== 'object') {
    return chartData;
  }

  const cloned = {};
  for (const [key, value] of Object.entries(chartData)) {
    if (Array.isArray(value)) {
      // Deep clone arrays to ensure they're mutable
      cloned[key] = value.map(item => 
        typeof item === 'object' && item !== null ? { ...item } : item
      );
    } else if (typeof value === 'object' && value !== null) {
      cloned[key] = { ...value };
    } else {
      cloned[key] = value;
    }
  }
  return cloned;
}

/**
 * Generate expert ratio series for time dimensions (weeks, months, quarters, years).
 * Calculates what percentage of booking hours is by expert personnel.
 * @param {Array} categories - Time dimension categories (e.g. ["2024-01", "2024-02"])
 * @param {string} timedimension - 'week' | 'month' | 'quarter' | 'year'
 * @param {Array} filteredCapacityBookings - Array of capacity bookings with qualifications
 * @param {Array} qualificationDefs - Array of qualification definitions with IsExpert flag
 * @returns {Array} Array of percentages (0-100) for each category
 */
export function generateExpertRatioTimeDimension(categories, timedimension, filteredCapacityBookings, qualificationDefs) {
  // Build a set of expert qualification keys
  const expertQualiKeys = new Set(
    (qualificationDefs || [])
      .filter(def => def.IsExpert !== false) // default true
      .map(def => def.key)
  );

  return categories.map((cat) => {
    let totalHours = 0;
    let expertHours = 0;

    filteredCapacityBookings.forEach(booking => {
      // Check if booking is active during this time period
      if (isBookingActiveInTimePeriod(booking, cat, timedimension)) {
        const bookingHours = sumWeightedBookingHours(booking, { mode: 'pedagogical' });
        totalHours += bookingHours;

        // Check if this booking has expert qualifications
        const qualiArr = Array.isArray(booking.qualifications) ? booking.qualifications : [];
        if (qualiArr.some(q => expertQualiKeys.has(q))) {
          expertHours += bookingHours;
        }
      }
    });

    if (totalHours === 0) return 0;
    return Math.round((expertHours / totalHours) * 100);
  });
}

/**
 * Generate care ratio series for time dimensions (weeks, months, quarters, years).
 * Applies BayKiBiG weighting to demand booking hours and calculates ratio (1:x) to capacity booking hours.
 * @param {Array} categories - Time dimension categories
 * @param {string} timedimension - 'week' | 'month' | 'quarter' | 'year'
 * @param {Array} filteredDemandBookings - Array of demand bookings
 * @param {Array} filteredCapacityBookings - Array of capacity bookings
 * @param {Object} dataByScenario - Data items for scenario
 * @param {Array} groupDefs - Group definitions for BayKiBiG weighting
 * @returns {Array} Array of care ratios for each category
 */
export function generateCareRatioTimeDimension(categories, timedimension, filteredDemandBookings, filteredCapacityBookings, dataByScenario, groupDefs) {
  // Helper function: get GroupDef by groupId
  function getGroupDefById(groupId) {
    return groupDefs.find(g => String(g.id) === String(groupId));
  }

  return categories.map(cat => {
    let weightedDemandHours = 0;
    let capacityHours = 0;

    // Calculate weighted demand hours for this time period
    filteredDemandBookings.forEach(booking => {
      if (isBookingActiveInTimePeriod(booking, cat, timedimension)) {
        const bookingHours = sumWeightedBookingHours(booking);
        
        // Get the child object and GroupDef for BayKiBiG weighting
        const child = dataByScenario?.[booking.itemId];
        const groupDef = getGroupDefById(booking.groupId);
        const weight = getBayKiBiGWeightForChild(child, groupDef);
        
        weightedDemandHours += bookingHours * weight;
      }
    });

    // Calculate capacity hours for this time period
    filteredCapacityBookings.forEach(booking => {
      if (isBookingActiveInTimePeriod(booking, cat, timedimension)) {
        capacityHours += sumWeightedBookingHours(booking, { mode: 'pedagogical' });
      }
    });

    // Calculate ratio (weighted demand / capacity)
    if (capacityHours === 0) return 0;
    const ratio = weightedDemandHours / capacityHours;
    return Math.round(ratio * 10) / 10; // 1 decimal place
  });
}

/**
 * Helper function to check if a booking is active during a specific time period.
 * @param {Object} booking - Booking object with startdate/enddate
 * @param {string} category - Time category (e.g. "2024-01", "2024-W01", "2024-Q1")
 * @param {string} timedimension - 'week' | 'month' | 'quarter' | 'year'
 * @returns {boolean} True if booking is active during the time period
 */
function isBookingActiveInTimePeriod(booking, category, timedimension) {
  // Get the start and end dates of the time period
  const { startDate, endDate } = getTimePeriodBounds(category, timedimension);
  
  // Check if booking overlaps with the time period
  const bookingStart = booking.startdate || '1900-01-01';
  const bookingEnd = booking.enddate || '2100-12-31';

  // If booking contains item validity information, require the item to be active as well
  const itemStart = booking.itemStart || booking.item_start || booking.itemstart || booking.startdate || '1900-01-01';
  const itemEnd = booking.itemEnd || booking.item_end || booking.itemend || booking.enddate || '2100-12-31';

  return bookingStart <= endDate && bookingEnd >= startDate && itemStart <= endDate && itemEnd >= startDate;
}

/**
 * Helper function to get start and end dates for a time period category.
 * @param {string} category - Time category (e.g. "2024-01", "2024-W01", "2024-Q1")
 * @param {string} timedimension - 'week' | 'month' | 'quarter' | 'year'
 * @returns {Object} { startDate, endDate } in YYYY-MM-DD format
 */
function getTimePeriodBounds(category, timedimension) {
  switch (timedimension) {
    case 'week': {
      // Parse "2024-W01" format
      const [year, weekStr] = category.split('-W');
      const weekNum = parseInt(weekStr, 10);
      const yearNum = parseInt(year, 10);
      
      // Calculate first day of the week (Monday)
      const jan4 = new Date(yearNum, 0, 4);
      const dayOfWeek = (jan4.getDay() + 6) % 7; // Monday = 0
      const firstWeekStart = new Date(jan4.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
      
      const weekStart = new Date(firstWeekStart.getTime() + (weekNum - 1) * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
      
      return {
        startDate: weekStart.toISOString().slice(0, 10),
        endDate: weekEnd.toISOString().slice(0, 10)
      };
    }
    case 'month': {
      // Parse "2024-01" format
      const [year, month] = category.split('-');
      const yearNum = parseInt(year, 10);
      const monthNum = parseInt(month, 10);
      
      const startDate = new Date(yearNum, monthNum - 1, 1);
      const endDate = new Date(yearNum, monthNum, 0); // Last day of month
      
      return {
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10)
      };
    }
    case 'quarter': {
      // Parse "2024-Q1" format
      const [year, quarterStr] = category.split('-Q');
      const yearNum = parseInt(year, 10);
      const quarter = parseInt(quarterStr, 10);
      
      const startMonth = (quarter - 1) * 3;
      const endMonth = startMonth + 2;
      
      const startDate = new Date(yearNum, startMonth, 1);
      const endDate = new Date(yearNum, endMonth + 1, 0); // Last day of quarter
      
      return {
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10)
      };
    }
    case 'year': {
      // Parse "2024" format
      const yearNum = parseInt(category, 10);
      
      return {
        startDate: `${yearNum}-01-01`,
        endDate: `${yearNum}-12-31`
      };
    }
    default:
      // Fallback: treat as date
      return {
        startDate: category,
        endDate: category
      };
  }
}