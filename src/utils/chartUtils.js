import { getBayKiBiGWeightForChild } from './BayKiBiG-calculator';

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
    const [day, time] = cat.split(' ');
    let total = 0;
    let expert = 0;
    filteredCapacityBookings.forEach(booking => {
      // booking.times: [{ day_name, segments }]
      if (!Array.isArray(booking.times)) return;
      const covers = booking.times.some(dayObj => {
        if (dayObj.day_name !== day) return false;
        if (!Array.isArray(dayObj.segments)) return false;
        return dayObj.segments.some(seg =>
          seg.booking_start <= time && seg.booking_end > time
        );
      });
      if (covers) {
        total += 1;
        // booking.qualifications: array of keys
        const qualiArr = Array.isArray(booking.qualifications) ? booking.qualifications : [];
        if (qualiArr.some(q => expertQualiKeys.has(q))) {
          expert += 1;
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
    const [day, time] = cat.split(' ');

    // Summe gewichtete Bedarfe (Kinderstunden)
    let weightedDemand = 0;
    filteredDemandBookings.forEach(booking => {
      if (!Array.isArray(booking.times)) return;
      const covers = booking.times.some(dayObj => {
        if (dayObj.day_name !== day) return false;
        if (!Array.isArray(dayObj.segments)) return false;
        return dayObj.segments.some(seg =>
          seg.booking_start <= time && seg.booking_end > time
        );
      });
      if (covers) {
        // Hole das Kind-Objekt und GroupDef
        const child = dataByScenario?.[booking.itemId];
        const groupDef = getGroupDefById(booking.groupId);
        const weight = getBayKiBiGWeightForChild(child, groupDef);
        weightedDemand += weight;
      }
    });

    // Summe Kapazität (Mitarbeiter)
    let capacityCount = 0;
    filteredCapacityBookings.forEach(booking => {
      if (!Array.isArray(booking.times)) return;
      const covers = booking.times.some(dayObj => {
        if (dayObj.day_name !== day) return false;
        if (!Array.isArray(dayObj.segments)) return false;
        return dayObj.segments.some(seg =>
          seg.booking_start <= time && seg.booking_end > time
        );
      });
      if (covers) {
        capacityCount += 1;
      }
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

  // Helper: resolve groupId from group assignments
  function resolveGroupId(itemId, date) {
    const assignments = groupAssignments[itemId] || {};
    const activeAssignment = Object.values(assignments).find(assignment => {
      const startOk = !assignment.start || assignment.start <= date;
      const endOk = !assignment.end || assignment.end >= date;
      return startOk && endOk;
    });
    return activeAssignment?.groupId || null;
  }

  Object.entries(dataItems).forEach(([itemId]) => {
    const overlayedItem = getOverlayedDataItem(itemId);
    if (!overlayedItem) return;
    const type = overlayedItem.type;

    // Resolve groupId from group assignments or fallback to item groupId
    const groupId = resolveGroupId(itemId, referenceDate) || overlayedItem.groupId || null;

    // Check presence and absence
    if (!isDataItemPresent(overlayedItem, referenceDate)) return;
    if (isDataItemAbsent(overlayedItem, referenceDate)) return;

    // Group filter
    let groupMatch = false;
    if (selectedGroups.length === 0) {
      groupMatch = true;
    } else if (groupId && selectedGroups.includes(groupId)) {
      groupMatch = true;
    } else if (Array.isArray(groupId) && groupId.some(g => selectedGroups.includes(g))) {
      groupMatch = true;
    } else if (selectedGroups.includes('__NO_GROUP__') && (!groupId || groupId === '')) {
      groupMatch = true;
    }

    // Get all bookings for this item (overlay-aware)
    const itemBookings = Object.values(getOverlayedBookings(itemId));

    // For demand: only group filter
    if (type === 'demand' && groupMatch) {
      itemBookings.forEach(booking => {
        if (isActiveAt(booking, referenceDate)) {
          demand.push({ ...booking, itemId, groupId });
        }
      });
    }

    // For capacity: group and qualification filter
    if (type === 'capacity' && groupMatch) {
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
          if (isActiveAt(booking, referenceDate)) {
            capacity.push({ ...booking, itemId, groupId, qualifications: qualiKeys });
          }
        });
      }
    }
  });

  return { demand, capacity };
}

/**
 * Generate a data series for the chart by counting bookings per category (time segment).
 * Each booking must have a 'times' array with { day, start, end }.
 */
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

  // Helper: check if a booking covers a category (supports nested segments)
  function bookingCoversCategory(booking, catDay, catTime) {
    if (!Array.isArray(booking.times)) return false;
    // booking.times: [{ day_name: 'Mo', segments: [{ booking_start, booking_end }] }, ...]
    return booking.times.some(dayObj => {
      if (dayObj.day_name !== catDay) return false;
      if (!Array.isArray(dayObj.segments)) return false;
      return dayObj.segments.some(seg =>
        seg.booking_start <= catTime && seg.booking_end > catTime // exclusive end
      );
    });
  }

  // For each category, count bookings that cover it
  categories.forEach((cat, idx) => {
    const { day, time } = parseCategory(cat);
    let count = 0;
    filteredBookings.forEach(booking => {
      if (bookingCoversCategory(booking, day, time)) {
        count++;
      }
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