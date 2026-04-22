import { generateExpertRatioSeries, generateCareRatioSeries, filterBookings } from '../chartUtils/chartUtils';
import { segmentMatchesMode } from '../bookingUtils';
import { timeToMinutes } from '../timeUtils';

const WEEKLY_DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
const WEEKLY_SLOT_START_MINUTES = 7 * 60;
const WEEKLY_SLOT_END_MINUTES = 17 * 60;
const WEEKLY_SLOT_MINUTES = 30;
const WEEKLY_SLOTS_PER_DAY = ((WEEKLY_SLOT_END_MINUTES - WEEKLY_SLOT_START_MINUTES) / WEEKLY_SLOT_MINUTES) + 1;

function parseWeeklyCategory(value) {
  if (typeof value !== 'string') return null;

  const [day, time] = value.split(' ');
  if (!day || !time) return null;

  const [hourPart, minutePart] = time.split(':');
  const hour = Number(hourPart);
  const minute = Number(minutePart);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;

  return { day, hour, minute };
}

function getWeeklyCategoryMinutes(category) {
  const slot = parseWeeklyCategory(category);
  if (!slot) return null;
  return timeToMinutes(`${slot.hour}:${String(slot.minute).padStart(2, '0')}`);
}

// Hilfsfunktion für Zeitsegmente
export function generateTimeSegments() {
  const segments = [];

  for (let dayIndex = 0; dayIndex < WEEKLY_DAYS.length; dayIndex++) {
    for (let slotIndex = 0; slotIndex < WEEKLY_SLOTS_PER_DAY; slotIndex++) {
      const totalMinutes = WEEKLY_SLOT_START_MINUTES + (slotIndex * WEEKLY_SLOT_MINUTES);
      const hour = Math.floor(totalMinutes / 60);
      const min = totalMinutes % 60;
      segments.push(`${WEEKLY_DAYS[dayIndex]} ${hour}:${String(min).padStart(2, '0')}`);
    }
  }
  // Ensure we return a new mutable array every time
  return [...segments];
}

export function formatWeeklyCategoryLabel(value, categories = []) {
  if (typeof value === 'string') return value;
  if (Number.isFinite(value) && categories[value] !== undefined) return categories[value];
  return '';
}

export function formatWeeklyAxisLabel(value, categories = []) {
  const category = formatWeeklyCategoryLabel(value, categories);
  const slot = parseWeeklyCategory(category);

  if (!slot || slot.minute !== 0) return '';
  if (![8, 12, 16].includes(slot.hour)) return '';

  return `${slot.hour}:00`;
}

/**
 * Generate a data series for the chart by counting bookings per category (time segment).
 * Each booking must have a 'times' array with { day, start, end }.
 */
export function generateBookingDataSeries(referenceDate, filteredBookings, categories, mode = 'all') {
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
    const categoryMinutes = getWeeklyCategoryMinutes(`${catDay} ${catTime}`);
    if (categoryMinutes === null) return false;

    return booking.times.some(dayObj => {
      if (dayObj.day_name !== catDay) return false;
      if (!Array.isArray(dayObj.segments)) return false;
      return dayObj.segments.some(seg =>
        timeToMinutes(seg.booking_start) !== null
        && timeToMinutes(seg.booking_end) !== null
        && segmentMatchesMode(seg, mode)
        && timeToMinutes(seg.booking_start) <= categoryMinutes
        && timeToMinutes(seg.booking_end) > categoryMinutes // exclusive end
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

export function generateWeeklyChartTooltip(points, x, categories = []) {
  const label = formatWeeklyCategoryLabel(x, categories) || String(x);
  let s = `<b>${label}</b><br/>`;
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
  const capacity_pedagogical = generateBookingDataSeries(referenceDate, filteredCapacityBookings, categories, 'pedagogical');
  const capacity_administrative = generateBookingDataSeries(referenceDate, filteredCapacityBookings, categories, 'administrative');
  const capacity = capacity_pedagogical.map((value, index) => value + (capacity_administrative[index] || 0));

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
    capacity_pedagogical: [...capacity_pedagogical],
    capacity_administrative: [...capacity_administrative],
    maxcapacity: Math.max(...capacity, 0),
    care_ratio: [...care_ratio],
    max_care_ratio: Math.max(...care_ratio, 0),
    expert_ratio: [...expert_ratio],
    maxexpert_ratio: Math.max(...expert_ratio, 0),
  };
}
