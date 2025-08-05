import { generateExpertRatioSeries, generateCareRatioSeries, filterBookings } from '../chartUtils/chartUtils';

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
  // Ensure we return a new mutable array every time
  return [...segments];
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

export function generateWeeklyChartTooltip(points, x) {
  let s = `<b>${x}</b><br/>`;
  points.forEach(point => {
    s += `<span style="color:${point.color}">\u25CF</span> <b>${point.series.name}:</b> ${point.y}<br/>`;
  });
  return s;
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

export function calculateChartDataWeekly(
  referenceDate,
  selectedGroups,
  selectedQualifications,
  {
    bookingsByScenario,
    dataByScenario,
    groupDefs,
    qualificationDefs, 
    groupsByScenario, 
    qualificationAssignmentsByScenario,
    overlaysByScenario,
    scenarioId
  }
) {
  // No scenario chain logic here, only use the passed-in data
  const { demand: filteredDemandBookings, capacity: filteredCapacityBookings } = filterBookings({
    bookingsByScenario,
    dataByScenario,
    qualificationAssignmentsByScenario,
    overlaysByScenario,
    scenarioId,
    referenceDate,
    selectedGroups,
    selectedQualifications,
    groupsByScenario
  });

  const categories = generateTimeSegments();
  const demand = generateBookingDataSeries(referenceDate, filteredDemandBookings, categories);
  const capacity = generateBookingDataSeries(referenceDate, filteredCapacityBookings, categories);

  // Neu: careRatio berechnen
  const care_ratio = generateCareRatioSeries(
    categories,
    filteredDemandBookings,
    filteredCapacityBookings,
    dataByScenario[scenarioId],
    groupDefs || []
  );

  // Fill expert_ratio using new function
  const expert_ratio = generateExpertRatioSeries(
    categories,
    filteredCapacityBookings,
    qualificationDefs || []
  );

  // Return completely new objects and arrays to prevent any mutation issues
  return {
    categories: [...categories],
    demand: [...demand],
    maxdemand: Math.max(...demand, 0),
    capacity: [...capacity],
    maxcapacity: Math.max(...capacity, 0),
    care_ratio: [...care_ratio],
    max_care_ratio: Math.max(...care_ratio, 0),
    expert_ratio: [...expert_ratio],
    maxexpert_ratio: Math.max(...expert_ratio, 0),
  };
}
