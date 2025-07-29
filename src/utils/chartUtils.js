// Import selectors as needed
// import { selectDataItemsByScenario } from '../store/simDataSlice';
// import { ... } from '../store/simBookingSlice';
// ...other imports...

// Hilfsfunktion für Zeitsegmente
export function generateTimeSegments() {
  const days = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
  const startHour = 7;
  const endHour = 17;
  const segments = [];
  for (let d = 0; d < days.length; d++) {
    for (let h = startHour; h <= endHour; h += 0.5) {
      const hour = Math.floor(h);
      const min = h % 1 === 0 ? '00' : '30';
      segments.push(`${days[d]} ${hour}:${min}`);
    }
  }
  return segments;
}

export function calculateChartData(
  referenceDate,
  selectedGroups,
  selectedQualifications,
  {
    bookingsByScenario,
    dataByScenario,
    groupDefs,
    qualificationAssignmentsByScenario,
    overlaysByScenario,
    scenarioId
  }
) {
  // ...use the passed-in data for calculations...

  const { demand: filteredDemandBookings, capacity: filteredCapacityBookings } = filterBookings({
    bookingsByScenario,
    dataByScenario,
    groupDefs,
    qualificationAssignmentsByScenario,
    overlaysByScenario,
    scenarioId,
    referenceDate,
    selectedGroups,
    selectedQualifications
  });

  const categories = generateTimeSegments();
  const demand = generateBookingDataSeries(referenceDate, filteredDemandBookings, categories);
  const capacity = generateBookingDataSeries(referenceDate, filteredCapacityBookings, categories);
  const care_ratio = [];
  const expert_ratio = [];

  return {
    categories,
    demand,
    maxdemand: Math.max(...demand),
    capacity,
    maxcapacity: Math.max(...capacity),
    care_ratio,
    max_care_ratio: Math.max(...care_ratio),
    expert_ratio,
    maxexpert_ratio: Math.max(...expert_ratio),
  };
}

export function generateWeeklyChartTooltip(points, x) {
  let s = `<b>${x}</b><br/>`;
  points.forEach(point => {
    s += `<span style="color:${point.color}">\u25CF</span> <b>${point.series.name}:</b> ${point.y}<br/>`;
  });
  return s;
}

/**
 * Overlay-aware booking filter.
 * Returns { demand: [...], capacity: [...] }
 * Now also checks simData presence (startdate/enddate) and absences.
 */
export function filterBookings({
  bookingsByScenario,
  dataByScenario,
  qualificationAssignmentsByScenario,
  overlaysByScenario,
  scenarioId,
  referenceDate,
  selectedGroups,
  selectedQualifications
}) {
  const demand = [];
  const capacity = [];
  const bookings = bookingsByScenario[scenarioId] || {};
  const dataItems = dataByScenario[scenarioId] || {};
  const overlays = overlaysByScenario[scenarioId] || {};
  const qualificationAssignments = qualificationAssignmentsByScenario[scenarioId] || {};

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
    // Null/empty startdate: since forever; null/empty enddate: indefinitely
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

  // Iterate all data items
  Object.entries(dataItems).forEach(([itemId, item]) => {
    const overlayedItem = getOverlayedDataItem(itemId);
    if (!overlayedItem) return;
    const type = overlayedItem.type;
    const groupId = overlayedItem.groupId || overlayedItem.group || null;

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
      let qualiMatch = selectedQualifications.length === 0 ||
        qualiKeys.some(q => selectedQualifications.includes(q));

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
  const series = Array.from({ length: categories.length }, () => 0);

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

  return series;
}