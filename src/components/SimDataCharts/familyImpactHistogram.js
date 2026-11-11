const HISTOGRAM_BINS = [
  { key: 'decrease', label: 'Senkung' },
  { key: 'increase-0-50', label: '1–49 €' },
  { key: 'increase-50-100', label: '50–99 €' },
  { key: 'increase-100-150', label: '100–149 €' },
  { key: 'increase-150-200', label: '150–199 €' },
  { key: 'increase-200-plus', label: '≥ 200 €' },
];

function getHistogramBinKey(value) {
  if (value < -0.005) return HISTOGRAM_BINS[0].key;
  if (value <= 0.005) return null;
  if (value < 50) return HISTOGRAM_BINS[1].key;
  if (value < 100) return HISTOGRAM_BINS[2].key;
  if (value < 150) return HISTOGRAM_BINS[3].key;
  if (value < 200) return HISTOGRAM_BINS[4].key;
  return HISTOGRAM_BINS[5].key;
}

function getHistogramRange(value) {
  const key = getHistogramBinKey(value);
  return HISTOGRAM_BINS.find((bin) => bin.key === key)?.label || 'zwischen Senkung und Erhöhung';
}

export function buildFamilyImpactHistogramData(annualIncomeRows = [], mode = 'yearOverYear') {
  const getImpactAmount = (family) => {
    const simulationDelta = Number(family.averageMonthlyDelta) || 0;
    const yearOverYearDelta = Number(family.averageMonthlyYearOverYearDelta) || 0;
    if (mode === 'simulation') return simulationDelta;
    if (mode === 'yearOverYear') return yearOverYearDelta;
    return simulationDelta + yearOverYearDelta;
  };
  const yearlyCounts = (annualIncomeRows || []).map((yearRow) => {
    const counts = Object.fromEntries(HISTOGRAM_BINS.map((bin) => [bin.key, 0]));
    const changes = [];
    (yearRow.familyImpacts || []).forEach((family) => {
      const amount = getImpactAmount(family);
      if (!Number.isFinite(amount)) return;
      const binKey = getHistogramBinKey(amount);
      if (!binKey) return;
      counts[binKey] += 1;
      changes.push(amount);
    });
    const sortedChanges = [...changes].sort((left, right) => left - right);
    const middle = Math.floor(sortedChanges.length / 2);
    const median = sortedChanges.length === 0
      ? null
      : sortedChanges.length % 2 === 0
        ? (sortedChanges[middle - 1] + sortedChanges[middle]) / 2
        : sortedChanges[middle];
    const average = changes.length ? changes.reduce((sum, amount) => sum + amount, 0) / changes.length : null;
    return {
      year: String(yearRow.year),
      counts,
      statistics: {
        average,
        median,
        averageRange: average == null ? null : getHistogramRange(average),
        medianRange: median == null ? null : getHistogramRange(median),
        affectedFamilies: changes.length,
      },
    };
  }).filter((yearRow) => Object.values(yearRow.counts).some((count) => count > 0));

  return {
    series: yearlyCounts.map(({ year }) => year),
    data: HISTOGRAM_BINS.map((bin) => ({
      range: bin.label,
      ...Object.fromEntries(yearlyCounts.map(({ year, counts }) => [year, counts[bin.key]])),
    })),
    affectedFamiliesByYear: Object.fromEntries(yearlyCounts.map(({ year, counts }) => [
      year,
      Object.values(counts).reduce((sum, count) => sum + count, 0),
    ])),
    statisticsByYear: Object.fromEntries(yearlyCounts.map(({ year, statistics }) => [year, statistics])),
  };
}
