import { filterBookings, sumWeightedBookingHours } from '../chartUtils/chartUtils';
import { sumBookingHours } from '../bookingUtils';

// Demand-Wochenstunden BETRSTD-bewusst (adebis-Kalkulation statt Segment-Summe),
// Kapazität weiter über Segment-Modi (anstell kennt kein BETRSTD).
function demandBookingHours(booking) {
  return sumWeightedBookingHours(booking);
}

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
export function calculateHistogramSeries(filteredBookings, bins, binSize = 4, mode = 'all') {
  const series = new Array(bins.length).fill(0);
  
  filteredBookings.forEach(booking => {
    const totalHours = mode === 'all' ? demandBookingHours(booking) : sumBookingHours(booking, { mode });
    if (totalHours <= 0) return;
    const binIndex = getBinIndex(totalHours, binSize);
    if (binIndex >= 0 && binIndex < series.length) {
      series[binIndex]++;
    }
  });
  
  return series;
}

/**
 * Gemeinsame Bins für alle Gruppen (Max über Demand- UND Kapazitätsbuchungen) –
 * Voraussetzung für gestapelte Gruppen-Serien mit identischer X-Achse.
 */
export function generateSharedHistogramBins(filteredDemandBookings, filteredCapacityBookings, binSize = 4) {
  const maxHours = Math.max(
    ...filteredDemandBookings.map((booking) => demandBookingHours(booking)),
    ...filteredCapacityBookings.map((booking) => sumBookingHours(booking, { mode: 'pedagogical' })),
    ...filteredCapacityBookings.map((booking) => sumBookingHours(booking, { mode: 'administrative' })),
    12
  );
  return generateHistogramBins(maxHours, binSize);
}

/**
 * Entfernt leere Kategorien am ENDE der X-Achse (über alle Serien), behält aber
 * innere Nullen (sinnvolle Lücken) und mindestens eine Kategorie.
 * @returns {{ categories: Array, series: Array, count: number }}
 */
export function trimTrailingEmptyCategories(categories, seriesList) {
  const cats = Array.isArray(categories) ? categories : [];
  const series = (seriesList || []).map((serie) => ({
    ...serie,
    data: (serie?.data || []).map((value) => Number(value) || 0),
  }));
  if (cats.length === 0) return { categories: [], series, count: 0 };

  let lastNonEmpty = -1;
  for (let index = 0; index < cats.length; index += 1) {
    const hasData = series.some((serie) => (serie.data[index] || 0) > 0);
    if (hasData) lastNonEmpty = index;
  }
  // Alles leer: nichts trimmen (leeres Chart mit voller Achse ist aussagekräftiger)
  if (lastNonEmpty < 0) return { categories: [...cats], series, count: cats.length };

  const count = lastNonEmpty + 1;
  return {
    categories: cats.slice(0, count),
    series: series.map((serie) => ({ ...serie, data: serie.data.slice(0, count) })),
    count,
  };
}

/**
 * Baut die Histogramm-Datenstruktur aus bereits gefilterten Buchungen
 * (Wiederverwendung für gruppengefilterte Analysis-Slides ohne Re-Filterung).
 * @param {Array|null} sharedCategories - optionale gemeinsame Bins (Stacking über Gruppen)
 */
export function buildHistogramDataFromBookings(filteredDemandBookings, filteredCapacityBookings, sharedCategories = null) {
  const binSize = 4;
  const categories = sharedCategories || generateSharedHistogramBins(filteredDemandBookings, filteredCapacityBookings, binSize);
  const demandSeries = calculateHistogramSeries(filteredDemandBookings, categories, binSize, 'all');
  const capacityPedagogicalSeries = calculateHistogramSeries(filteredCapacityBookings, categories, binSize, 'pedagogical');
  const capacityAdministrativeSeries = calculateHistogramSeries(filteredCapacityBookings, categories, binSize, 'administrative');
  const capacitySeries = capacityPedagogicalSeries.map((value, index) => value + (capacityAdministrativeSeries[index] || 0));

  return {
    categories: [...categories],
    demand: [...demandSeries],
    maxdemand: Math.max(...demandSeries, 0),
    capacity: [...capacitySeries],
    capacity_pedagogical: [...capacityPedagogicalSeries],
    capacity_administrative: [...capacityAdministrativeSeries],
    maxcapacity: Math.max(...capacitySeries, 0),
  };
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

  return buildHistogramDataFromBookings(filteredDemandBookings, filteredCapacityBookings);
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
