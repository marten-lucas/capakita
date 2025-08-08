import { filterBookings } from '../chartUtils/chartUtils';
import { sumBookingHours } from '../bookingUtils';

/**
 * Generate histogram bins for booking hours
 * @param {number} maxHours - Maximum hours to create bins for
 * @param {number} binSize - Size of each bin (default: 4 hours)
 * @returns {Array} Array of bin labels
 */
export function generateHistogramBins(maxHours, binSize = 4) {
  const bins = ['0'];
  let start = 1;
  while (start <= maxHours) {
    const end = start + binSize - 1;
    bins.push(`${start}-${end}`);
    start += binSize;
  }
  return bins;
}

/**
 * Assign booking to bin index
 */
function getBinIndex(totalHours, binSize = 4) {
  if (totalHours === 0) return 0;
  // 0: "0", 1: "1-4", 2: "5-8", ...
  return Math.ceil(totalHours / binSize);
}

/**
 * Calculate histogram data for booking hours distribution
 * @param {Array} filteredBookings - Array of bookings to analyze
 * @param {Array} bins - Array of bin labels
 * @param {number} binSize - Size of each bin in hours
 * @returns {Array} Array of counts for each bin
 */
export function calculateHistogramSeries(filteredBookings, bins, binSize = 4) {
  const series = new Array(bins.length).fill(0);
  
  filteredBookings.forEach(booking => {
    const totalHours = sumBookingHours(booking);
    const binIndex = getBinIndex(totalHours, binSize);
    if (binIndex >= 0 && binIndex < series.length) {
      series[binIndex]++;
    }
  });
  
  return series;
}

/**
 * Calculate chart data for booking histogram
 */
export function calculateChartDataHistogram(
  referenceDate,
  selectedGroups,
  selectedQualifications,
  {
    bookingsByScenario,
    dataByScenario,
    groupsByScenario,
    qualificationAssignmentsByScenario,
    overlaysByScenario,
    scenarioId
  }
) {
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

  // Calculate max hours to determine bin range
  const allBookings = [...filteredDemandBookings, ...filteredCapacityBookings];
  const maxHours = Math.max(
    ...allBookings.map(booking => sumBookingHours(booking)),
    12 // Minimum range of 12 hours (so at least 0, 1-4, 5-8, 9-12)
  );
  const binSize = 4;
  const categories = generateHistogramBins(maxHours, binSize);
  const demandSeries = calculateHistogramSeries(filteredDemandBookings, categories, binSize);
  const capacitySeries = calculateHistogramSeries(filteredCapacityBookings, categories, binSize);

  return {
    categories: [...categories],
    demand: [...demandSeries],
    maxdemand: Math.max(...demandSeries, 0),
    capacity: [...capacitySeries],
    maxcapacity: Math.max(...capacitySeries, 0),
  };
}

/**
 * Generate tooltip for histogram chart
 */
export function generateHistogramTooltip(points, x) {
  let s = `<b>${x} Stunden</b><br/>`;
  points.forEach(point => {
    s += `<span style="color:${point.color}">\u25CF</span> <b>${point.series.name}:</b> ${point.y}<br/>`;
  });
  return s;
}
