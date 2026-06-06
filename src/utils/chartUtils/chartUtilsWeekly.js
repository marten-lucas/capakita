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
  if (!categories || categories.length === 0) {
    return [];
  }

  const series = new Array(categories.length).fill(0);
  const categoryIndex = new Map();
  categories.forEach((category, idx) => {
    categoryIndex.set(String(category), idx);
  });

  // Build counts segment-wise to avoid repeated full scans per category.
  (filteredBookings || []).forEach((booking) => {
    if (!Array.isArray(booking?.times)) return;

    booking.times.forEach((dayObj) => {
      const dayName = dayObj?.day_name;
      if (!dayName || !Array.isArray(dayObj?.segments)) return;

      dayObj.segments.forEach((seg) => {
        if (!segmentMatchesMode(seg, mode)) return;

        const startMinutes = timeToMinutes(seg?.booking_start);
        const endMinutes = timeToMinutes(seg?.booking_end);
        if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return;

        // A slot minute m is covered when start <= m < end.
        const firstSlot = Math.ceil((startMinutes - WEEKLY_SLOT_START_MINUTES) / WEEKLY_SLOT_MINUTES);
        const lastSlot = Math.floor(((endMinutes - 1) - WEEKLY_SLOT_START_MINUTES) / WEEKLY_SLOT_MINUTES);

        const boundedFirstSlot = Math.max(0, firstSlot);
        const boundedLastSlot = Math.min(WEEKLY_SLOTS_PER_DAY - 1, lastSlot);
        if (boundedLastSlot < boundedFirstSlot) return;

        for (let slotIndex = boundedFirstSlot; slotIndex <= boundedLastSlot; slotIndex += 1) {
          const totalMinutes = WEEKLY_SLOT_START_MINUTES + (slotIndex * WEEKLY_SLOT_MINUTES);
          const hour = Math.floor(totalMinutes / 60);
          const minute = totalMinutes % 60;
          const category = `${dayName} ${hour}:${String(minute).padStart(2, '0')}`;
          const idx = categoryIndex.get(category);
          if (idx !== undefined) {
            series[idx] += 1;
          }
        }
      });
    });
  });

  return [...series];
}

export function generateWeeklyChartTooltip(points, x, categories = []) {
  const label = formatWeeklyCategoryLabel(x, categories) || String(x);
  let s = `<b>${label}</b><br/>`;
  points.forEach(point => {
    const seriesName = point.series?.name || 'Series';
    let displayValue = point.y;
    
    // Format financial series with currency
    const financeSeriesNames = ['income_total', 'income_parents', 'income_baykibig', 'expenses_total', 'expenses_personnel', 'net_total'];
    const isFinanceSeries = financeSeriesNames.some(name => seriesName.toLowerCase().includes(name.toLowerCase())) ||
                           ['Einkommen', 'Ausgaben', 'Gewinn', 'Netto'].some(name => seriesName.includes(name)) ||
                           ['income', 'expenses', 'net'].some(name => seriesName.toLowerCase().includes(name));
    
    if (isFinanceSeries && typeof displayValue === 'number') {
      displayValue = displayValue.toLocaleString('de-DE', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      });
    }
    
    s += `<span style="color:${point.color}">\u25CF</span> <b>${seriesName}:</b> ${displayValue}<br/>`;
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
