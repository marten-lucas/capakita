import picoCss from '@picocss/pico/css/pico.min.css?inline';
import { getFeeBandZeitkatId, ZEITKAT_CATALOG } from '../../utils/adebisConstants';
import { isDateWithinRange } from '../../utils/financeUtils';
import { getFeeBandSimulationPriceKey } from '../../utils/foerderSimulation';

export const HTML_FAMILY_PROFILE_MIN_COUNT = 5;

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;
const normalizeGroupId = (value) => String(value || '__NO_GROUP__');

function cleanSubsidyRule(rule = {}) {
  return {
    enabled: rule.enabled !== false,
    monthlyAmount: Math.max(0, Number(rule.monthlyAmount) || 0),
    endDate: String(rule.endDate || ''),
  };
}

function cleanTariffEntry(entry) {
  const zeitkatId = getFeeBandZeitkatId(entry);
  if (!zeitkatId) return null;
  return {
    zeitkatId,
    monthlyAmount: Math.max(0, Number(entry.monthlyAmount) || 0),
    enabled: entry.enabled !== false,
    validFrom: String(entry.validFrom || ''),
    validUntil: String(entry.validUntil || ''),
  };
}

function getApplicableEntry(entries = [], zeitkatId, referenceDate) {
  return (entries || [])
    .filter((entry) => getFeeBandZeitkatId(entry) === zeitkatId
      && isDateWithinRange(referenceDate, entry.validFrom || '', entry.validUntil || ''))
    .sort((left, right) => String(right.validFrom || '').localeCompare(String(left.validFrom || '')))[0] || null;
}

function getInitialOverrides(temporaryPrices = {}, catalogs = []) {
  const overrides = {};
  Object.entries(temporaryPrices || {}).forEach(([key, value]) => {
    const entry = catalogs.find((candidate) => getFeeBandSimulationPriceKey(candidate) === key);
    const zeitkatId = getFeeBandZeitkatId(entry) || ZEITKAT_CATALOG.find((zone) => zone.id === key)?.id;
    if (zeitkatId && Number.isFinite(Number(value))) overrides[zeitkatId] = Math.max(0, Number(value));
  });
  return overrides;
}

/**
 * Builds a strict allowlist snapshot. Family identities and all raw source records
 * are deliberately discarded; only frequency-counted tariff profiles survive.
 */
export function buildAggregateSimulationSnapshot({
  annualIncomeRows = [],
  familyProfileData = {},
  groupDefs = [],
  groupFeeCatalogs = {},
  simulationCatalogs = {},
  effectiveFeeCatalogs = {},
  temporaryPrices = {},
  parentFeeSubsidy = {},
  effectiveParentFeeSubsidiesByGroup = {},
  referenceDate,
  fixedBaseYearEnabled = false,
  fixedBaseYear,
  potentialMonthlyBudget = 0,
} = {}) {
  const rawGroupIds = [];
  const addGroupId = (value) => {
    const id = normalizeGroupId(value);
    if (!rawGroupIds.includes(id)) rawGroupIds.push(id);
  };
  groupDefs.forEach((group) => addGroupId(group.id));
  [groupFeeCatalogs, simulationCatalogs, effectiveParentFeeSubsidiesByGroup].forEach((source) => {
    Object.keys(source || {}).forEach(addGroupId);
  });
  (familyProfileData.profiles || []).forEach((profile) => Object.values(profile.years || {}).forEach((months) => (
    (months || []).forEach((bands) => (bands || []).forEach((band) => addGroupId(band.groupId)))
  )));

  const groupKeyByRawId = new Map();
  let groupNumber = 0;
  rawGroupIds.forEach((rawId) => {
    groupKeyByRawId.set(rawId, rawId === '__NO_GROUP__' ? 'no-group' : `g${++groupNumber}`);
  });
  const groups = rawGroupIds.map((rawId) => {
    const sourceId = rawId === '__NO_GROUP__' ? '' : rawId;
    const key = groupKeyByRawId.get(rawId);
    const baseEntries = (groupFeeCatalogs?.[sourceId] || []).map(cleanTariffEntry).filter(Boolean);
    const simulationEntries = (simulationCatalogs?.[sourceId] || []).map(cleanTariffEntry).filter(Boolean);
    const effectiveEntries = effectiveFeeCatalogs?.[sourceId] || [];
    const initialOverrides = getInitialOverrides(temporaryPrices?.[sourceId] || {}, simulationCatalogs?.[sourceId] || []);
    const initialEnabledOverrides = {};
    const tariffs = ZEITKAT_CATALOG.map((zone) => {
      const entry = getApplicableEntry(effectiveEntries, zone.id, referenceDate)
        || getApplicableEntry(simulationCatalogs?.[sourceId] || [], zone.id, referenceDate);
      const configuredEntry = getApplicableEntry(simulationCatalogs?.[sourceId] || [], zone.id, referenceDate);
      const amount = Object.hasOwn(initialOverrides, zone.id)
        ? initialOverrides[zone.id]
        : Math.max(0, Number(entry?.monthlyAmount) || 0);
      const enabled = configuredEntry ? configuredEntry.enabled !== false : Boolean(entry);
      initialEnabledOverrides[zone.id] = enabled;
      return {
        zeitkatId: zone.id,
        label: `ZEITKAT ${zone.id} (${zone.kurzbez}h)`,
        maxHours: zone.maxHours,
        initialAmount: amount,
        initialEnabled: enabled,
      };
    });
    const subsidy = cleanSubsidyRule(effectiveParentFeeSubsidiesByGroup?.[sourceId] || parentFeeSubsidy);
    return {
      key,
      label: rawId === '__NO_GROUP__' ? 'Ohne Gruppe' : `Gruppe ${key.slice(1)}`,
      baselineSubsidy: subsidy,
      initialSubsidy: { ...subsidy },
      baselineTariffs: baseEntries,
      simulationTariffs: simulationEntries,
      initialOverrides,
      initialEnabledOverrides,
      tariffs,
    };
  });

  const familyProfiles = (familyProfileData.profiles || [])
    .filter((profile) => Number(profile.familyCount) >= HTML_FAMILY_PROFILE_MIN_COUNT)
    .map((profile) => ({
      familyCount: Math.max(0, Number(profile.familyCount) || 0),
      years: Object.fromEntries(Object.entries(profile.years || {}).map(([year, months]) => [
        String(year),
        (months || []).map((bands) => (bands || []).map((band) => ({
          groupKey: groupKeyByRawId.get(normalizeGroupId(band.groupId)) || 'no-group',
          zeitkatId: String(band.zeitkatId || ''),
          childCount: Math.max(0, Number(band.childCount) || 0),
          subsidyEligibleChildCount: Math.max(0, Math.min(
            Number(band.childCount) || 0,
            Number(band.subsidyEligibleChildCount) || 0
          )),
        }))),
      ])),
    }));
  const years = annualIncomeRows.map((row) => ({
    year: Number(row.year),
    fundingAtExport: roundMoney(row.totalFunding),
    fundingExcludingParentSubsidy: roundMoney(row.totalFunding - row.annualParentFeeSubsidy),
    parentFeesAtExport: roundMoney(row.contributions),
    parentFeeSubsidyAtExport: roundMoney(row.annualParentFeeSubsidy),
    totalIncomeAtExport: roundMoney(row.totalIncome),
    additionalFunding: roundMoney(row.additionalFunding),
    averageDailyBookingHours: roundMoney(row.averageDailyBookingHours),
  }));

  return {
    format: 'capakita-aggregate-simulation',
    version: 1,
    createdAt: new Date().toISOString(),
    referenceMonth: String(referenceDate || '').slice(0, 7),
    fixedBaseYearEnabled: fixedBaseYearEnabled === true,
    fixedBaseYear: Number(fixedBaseYear) || null,
    potentialMonthlyBudget: Math.max(0, Number(potentialMonthlyBudget) || 0),
    groups,
    years,
    familyProfiles,
    privacy: {
      totalFamilies: Math.max(0, Number(familyProfileData.totalFamilies) || 0),
      suppressedFamilyCount: Math.max(0, Number(familyProfileData.suppressedFamilyCount) || 0),
      minimumFamilyCount: HTML_FAMILY_PROFILE_MIN_COUNT,
      includedProfileClasses: familyProfiles.length,
    },
  };
}

function calculateAggregateSimulationResultsInternal(snapshot, state, initializeState) {
  const round = (value) => Math.round((Number(value) || 0) * 100) / 100;
  const initialState = initializeState(snapshot);
  const groupByKey = new Map((snapshot.groups || []).map((group) => [group.key, group]));
  const owns = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
  const inDateRange = (date, entry) => (!entry.validFrom || entry.validFrom <= date)
    && (!entry.validUntil || entry.validUntil >= date);
  const pickEntry = (entries, zoneId, date) => (entries || [])
    .filter((entry) => entry.zeitkatId === zoneId && inDateRange(date, entry))
    .sort((left, right) => String(right.validFrom || '').localeCompare(String(left.validFrom || '')))[0] || null;
  const getFee = (groupKey, zoneId, date, simulation, activeState = state) => {
    const group = groupByKey.get(groupKey);
    if (!group) return 0;
    const entries = simulation ? group.simulationTariffs : group.baselineTariffs;
    const entry = pickEntry(entries, zoneId, date);
    if (!simulation) return !entry || entry.enabled === false ? 0 : round(entry.monthlyAmount);

    const enabledOverride = owns(activeState.enabledOverrides?.[groupKey], zoneId)
      ? activeState.enabledOverrides[groupKey][zoneId]
      : undefined;
    if (enabledOverride === false) return 0;
    if (!entry && enabledOverride !== true) return 0;
    if (entry?.enabled === false && enabledOverride !== true) return 0;
    const amount = owns(activeState.rateOverrides?.[groupKey], zoneId)
      ? activeState.rateOverrides[groupKey][zoneId]
      : owns(group.initialOverrides, zoneId)
        ? group.initialOverrides[zoneId]
        : entry?.monthlyAmount;
    return Math.max(0, round(amount));
  };
  const getSubsidy = (groupKey, date, simulation, activeState = state) => {
    const group = groupByKey.get(groupKey);
    const rule = simulation ? activeState.subsidies?.[groupKey] : group?.baselineSubsidy;
    if (!rule || rule.enabled === false || (rule.endDate && date > rule.endDate)) return 0;
    return Math.max(0, round(rule.monthlyAmount));
  };
  const calculateProfileYear = (profile, year, simulation, activeState = state) => {
    let parentFees = 0;
    let subsidy = 0;
    (profile.years?.[String(year)] || []).forEach((bands, monthIndex) => {
      const date = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
      (bands || []).forEach((band) => {
        const childCount = Math.max(0, Number(band.childCount) || 0);
        const eligibleCount = Math.max(0, Math.min(childCount, Number(band.subsidyEligibleChildCount) || 0));
        const fee = getFee(band.groupKey, band.zeitkatId, date, simulation, activeState);
        const monthlySubsidy = eligibleCount ? getSubsidy(band.groupKey, date, simulation, activeState) : 0;
        parentFees += (childCount - eligibleCount) * fee + eligibleCount * Math.max(0, fee - monthlySubsidy);
        subsidy += eligibleCount * monthlySubsidy;
      });
    });
    return { parentFees: round(parentFees), subsidy: round(subsidy) };
  };
  const safeTotalsForYear = (year, activeState = state) => (snapshot.familyProfiles || []).reduce((total, profile) => {
    const totals = calculateProfileYear(profile, year, true, activeState);
    const count = Number(profile.familyCount) || 0;
    return {
      parentFees: total.parentFees + totals.parentFees * count,
      subsidy: total.subsidy + totals.subsidy * count,
    };
  }, { parentFees: 0, subsidy: 0 });

  const annualResults = (snapshot.years || []).map((yearRow, index, rows) => {
    const initialSafeTotals = safeTotalsForYear(yearRow.year, initialState);
    const safeTotals = safeTotalsForYear(yearRow.year, state);
    const suppressedParentFees = yearRow.parentFeesAtExport - initialSafeTotals.parentFees;
    const suppressedSubsidy = yearRow.parentFeeSubsidyAtExport - initialSafeTotals.subsidy;
    const parentFees = round(suppressedParentFees + safeTotals.parentFees);
    const parentFeeSubsidy = round(suppressedSubsidy + safeTotals.subsidy);
    const funding = round(yearRow.fundingExcludingParentSubsidy + parentFeeSubsidy);
    const totalIncome = round(funding + parentFees);
    const previous = rows[index - 1];
    let yearOverYearIncome = null;
    if (previous) {
      const previousInitialTotals = safeTotalsForYear(previous.year, initialState);
      const previousCurrentTotals = safeTotalsForYear(previous.year, state);
      const previousFees = previous.parentFeesAtExport - previousInitialTotals.parentFees + previousCurrentTotals.parentFees;
      const previousSubsidy = previous.parentFeeSubsidyAtExport - previousInitialTotals.subsidy + previousCurrentTotals.subsidy;
      const previousIncome = previous.fundingExcludingParentSubsidy + previousSubsidy + previousFees;
      yearOverYearIncome = round(totalIncome - previousIncome);
    }
    return {
      year: yearRow.year,
      additionalFunding: yearRow.additionalFunding,
      averageDailyBookingHours: yearRow.averageDailyBookingHours,
      funding,
      parentFees,
      parentFeeSubsidy,
      totalIncome,
      yearOverYearIncome,
    };
  });

  const histogramBins = [
    { key: 'decrease', label: 'Senkung' },
    { key: 'increase-0-50', label: '1–49 €' },
    { key: 'increase-50-100', label: '50–99 €' },
    { key: 'increase-100-150', label: '100–149 €' },
    { key: 'increase-150-200', label: '150–199 €' },
    { key: 'increase-200-plus', label: '≥ 200 €' },
  ];
  const getHistogramBinKey = (value) => {
    if (value < -0.005) return histogramBins[0].key;
    if (value <= 0.005) return null;
    if (value < 50) return histogramBins[1].key;
    if (value < 100) return histogramBins[2].key;
    if (value < 150) return histogramBins[3].key;
    if (value < 200) return histogramBins[4].key;
    return histogramBins[5].key;
  };
  const histogramSeries = (snapshot.years || []).map((yearRow, index, rows) => {
    const previousYear = rows[index - 1]?.year;
    const counts = Object.fromEntries(histogramBins.map((bin) => [bin.key, 0]));
    (snapshot.familyProfiles || []).forEach((profile) => {
      const currentBaseline = calculateProfileYear(profile, yearRow.year, false).parentFees / 12;
      const currentSimulation = calculateProfileYear(profile, yearRow.year, true).parentFees / 12;
      const previousBaseline = previousYear == null
        ? currentBaseline
        : calculateProfileYear(profile, previousYear, false).parentFees / 12;
      const simulationDelta = currentSimulation - currentBaseline;
      const previousYearDelta = currentBaseline - previousBaseline;
      const amount = state.histogramMode === 'simulation'
        ? simulationDelta
        : state.histogramMode === 'yearOverYear'
          ? previousYearDelta
          : simulationDelta + previousYearDelta;
      const binKey = getHistogramBinKey(amount);
      if (binKey) counts[binKey] += Number(profile.familyCount) || 0;
    });
    return { year: String(yearRow.year), counts };
  }).filter((row) => Object.values(row.counts).some((count) => count > 0));

  return {
    annualResults,
    histogram: {
      bins: histogramBins.map((bin) => ({
        label: bin.label,
        counts: Object.fromEntries(histogramSeries.map((series) => [series.year, series.counts[bin.key]])),
      })),
      years: histogramSeries.map((series) => series.year),
      affectedFamiliesByYear: Object.fromEntries(histogramSeries.map((series) => [
        series.year,
        Object.values(series.counts).reduce((sum, count) => sum + count, 0),
      ])),
    },
    suppressedFamilyCount: snapshot.privacy?.suppressedFamilyCount || 0,
  };
}

export function createInitialStandaloneSimulationState(snapshot) {
  return {
    rateOverrides: Object.fromEntries((snapshot.groups || []).map((group) => [group.key, { ...(group.initialOverrides || {}) }])),
    enabledOverrides: Object.fromEntries((snapshot.groups || []).map((group) => [group.key, { ...(group.initialEnabledOverrides || {}) }])),
    subsidies: Object.fromEntries((snapshot.groups || []).map((group) => [group.key, { ...(group.initialSubsidy || {}) }])),
    histogramMode: 'total',
  };
}

export function calculateAggregateSimulationResults(snapshot, state = createInitialStandaloneSimulationState(snapshot)) {
  return calculateAggregateSimulationResultsInternal(snapshot, state, createInitialStandaloneSimulationState);
}

function escapeScriptJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function standaloneSimulationRuntime(initializeState, calculateResults) {
  const dataNode = document.getElementById('simulation-data');
  const data = JSON.parse(dataNode.textContent);
  const state = initializeState(data);
  const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const make = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const clear = (node) => { node.replaceChildren(); };
  const controls = document.getElementById('tariff-controls');
  const resultsNode = document.getElementById('annual-results');
  const histogramNode = document.getElementById('family-histogram');
  const histogramYear = document.getElementById('histogram-year');
  const suppressionNote = document.getElementById('suppression-note');

  function renderControls() {
    clear(controls);
    data.groups.forEach((group) => {
      const section = make('section', null, 'group-card');
      section.append(make('h3', group.label));
      const grid = make('div', null, 'tariff-grid');
      group.tariffs.forEach((tariff) => {
        const field = make('div', null, 'tariff-field');
        field.append(make('span', tariff.label));
        const row = make('div', null, 'input-row');
        const amount = document.createElement('input');
        amount.type = 'number';
        amount.min = '0';
        amount.step = '1';
        amount.value = state.rateOverrides[group.key][tariff.zeitkatId] ?? tariff.initialAmount;
        amount.setAttribute('aria-label', `${group.label} ${tariff.label} monatlich`);
        amount.addEventListener('input', () => {
          state.rateOverrides[group.key][tariff.zeitkatId] = Math.max(0, Number(amount.value) || 0);
          refreshResults();
        });
        const enabledLabel = make('label', null, 'enabled-field');
        const enabled = document.createElement('input');
        enabled.type = 'checkbox';
        enabled.checked = state.enabledOverrides[group.key][tariff.zeitkatId] !== false;
        enabled.setAttribute('aria-label', `${tariff.label} aktiv`);
        enabled.addEventListener('change', () => {
          state.enabledOverrides[group.key][tariff.zeitkatId] = enabled.checked;
          refreshResults();
        });
        enabledLabel.append(enabled, make('span', 'Aktiv'));
        row.append(amount, enabledLabel);
        field.append(row);
        grid.append(field);
      });
      section.append(grid);

      const subsidy = state.subsidies[group.key];
      const subsidySection = make('div', null, 'subsidy-fields');
      subsidySection.append(make('strong', 'Elternbeitragszuschuss'));
      const subsidyAmountLabel = make('label', 'Betrag pro Kind und Monat');
      const subsidyAmount = document.createElement('input');
      subsidyAmount.type = 'number';
      subsidyAmount.min = '0';
      subsidyAmount.step = '1';
      subsidyAmount.value = subsidy.monthlyAmount;
      subsidyAmount.addEventListener('input', () => {
        subsidy.monthlyAmount = Math.max(0, Number(subsidyAmount.value) || 0);
        refreshResults();
      });
      subsidyAmountLabel.append(subsidyAmount);
      const endDateLabel = make('label', 'Gültig bis (einschließlich)');
      const endDate = document.createElement('input');
      endDate.type = 'date';
      endDate.value = subsidy.endDate;
      endDate.addEventListener('input', () => {
        subsidy.endDate = endDate.value;
        refreshResults();
      });
      endDateLabel.append(endDate);
      const subsidyEnabledLabel = make('label', null, 'enabled-field');
      const subsidyEnabled = document.createElement('input');
      subsidyEnabled.type = 'checkbox';
      subsidyEnabled.checked = subsidy.enabled !== false;
      subsidyEnabled.addEventListener('change', () => {
        subsidy.enabled = subsidyEnabled.checked;
        refreshResults();
      });
      subsidyEnabledLabel.append(subsidyEnabled, make('span', 'Zuschuss aktiv'));
      subsidySection.append(subsidyAmountLabel, endDateLabel, subsidyEnabledLabel);
      section.append(subsidySection);
      controls.append(section);
    });
  }

  function renderAnnualResults(results) {
    clear(resultsNode);
    const table = make('table');
    const head = make('thead');
    const headerRow = make('tr');
    ['Jahr', 'Förderung inkl. Zuschuss', 'Elternbeiträge', 'Zuschuss-Durchlauf', 'Einnahmen gesamt'].forEach((label) => headerRow.append(make('th', label)));
    head.append(headerRow);
    const body = make('tbody');
    results.annualResults.forEach((row) => {
      const tr = make('tr');
      [String(row.year), euro.format(row.funding), euro.format(row.parentFees), euro.format(row.parentFeeSubsidy), euro.format(row.totalIncome)]
        .forEach((value, index) => tr.append(make(index === 0 ? 'th' : 'td', value)));
      body.append(tr);
    });
    table.append(head, body);
    resultsNode.append(table);
  }

  function renderHistogram(results) {
    const previousYear = histogramYear.value;
    clear(histogramYear);
    results.histogram.years.forEach((year) => {
      const option = make('option', year);
      option.value = year;
      histogramYear.append(option);
    });
    if (results.histogram.years.includes(previousYear)) histogramYear.value = previousYear;
    else if (results.histogram.years.length) histogramYear.value = results.histogram.years[0];
    clear(histogramNode);
    const year = histogramYear.value;
    const maxCount = Math.max(1, ...results.histogram.bins.map((bin) => bin.counts[year] || 0));
    const chart = make('div', null, 'histogram-chart');
    chart.setAttribute('role', 'img');
    chart.setAttribute('aria-label', `Histogramm der Beitragsänderungen für ${year}`);
    results.histogram.bins.forEach((bin) => {
      const count = bin.counts[year] || 0;
      const column = make('div', null, 'histogram-column');
      const value = make('span', String(count), 'histogram-value');
      const track = make('div', null, 'histogram-track');
      const bar = make('div', null, 'histogram-bar');
      bar.style.height = `${count ? Math.max(3, (count / maxCount) * 100) : 0}%`;
      track.append(bar);
      column.append(value, track, make('span', bin.label, 'histogram-label'));
      chart.append(column);
    });
    histogramNode.append(chart);
    const affected = results.histogram.affectedFamiliesByYear[year] || 0;
    document.getElementById('affected-count').textContent = `${affected} betroffene Familien${results.suppressedFamilyCount ? ` · ${results.suppressedFamilyCount} Familien nicht aufgeschlüsselt` : ''}`;
    suppressionNote.hidden = !results.suppressedFamilyCount;
  }

  function refreshResults() {
    const results = calculateResults(data, state, initializeState);
    renderAnnualResults(results);
    renderHistogram(results);
  }

  document.getElementById('reset-simulation').addEventListener('click', () => {
    const reset = initializeState(data);
    Object.assign(state, reset);
    renderControls();
    refreshResults();
  });
  document.getElementById('download-updated').addEventListener('click', () => {
    const updated = JSON.parse(JSON.stringify(data));
    updated.groups.forEach((group) => {
      group.initialOverrides = { ...state.rateOverrides[group.key] };
      group.initialEnabledOverrides = { ...state.enabledOverrides[group.key] };
      group.initialSubsidy = { ...state.subsidies[group.key] };
    });
    const documentCopy = document.documentElement.cloneNode(true);
    documentCopy.querySelector('#simulation-data').textContent = JSON.stringify(updated).replace(/</g, '\\u003c');
    const blob = new Blob([`<!doctype html>\\n${documentCopy.outerHTML}`], { type: 'text/html;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'capakita-simulation-aktualisiert.html';
    link.click();
    URL.revokeObjectURL(link.href);
  });
  histogramYear.addEventListener('change', () => renderHistogram(calculateResults(data, state, initializeState)));
  renderControls();
  refreshResults();
}

export function buildStandaloneSimulationHtml(snapshot) {
  const json = escapeScriptJson(snapshot);
  const inlineRuntime = `(${standaloneSimulationRuntime.toString()})((${createInitialStandaloneSimulationState.toString()}), (${calculateAggregateSimulationResultsInternal.toString()}));`;
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; connect-src 'none'; font-src 'none'">
<title>CapaKita – interaktive Beitragssimulation</title>
<style>${picoCss}
:root{--pico-font-size:100%;--pico-spacing:1rem}body{max-width:1200px;margin:0 auto;padding:1.25rem}.privacy-notice{border-left:4px solid #c0841a;padding:.75rem 1rem;background:var(--pico-card-background-color)}.group-card{border:1px solid var(--pico-muted-border-color);border-radius:.75rem;padding:1rem;margin:1rem 0}.group-card h3{margin-bottom:.75rem}.tariff-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.75rem}.tariff-field,.subsidy-fields>label{margin:0}.tariff-field>span{display:block;font-weight:600}.input-row{display:flex;align-items:center;gap:.5rem}.input-row>input{margin:0}.enabled-field{display:inline-flex;align-items:center;gap:.4rem;white-space:nowrap}.enabled-field input{margin:0}.subsidy-fields{display:flex;align-items:end;flex-wrap:wrap;gap:.75rem;margin-top:1rem;padding-top:1rem;border-top:1px solid var(--pico-muted-border-color)}.subsidy-fields strong{width:100%}.subsidy-fields label{min-width:180px}.actions{display:flex;gap:.5rem;flex-wrap:wrap;margin:1rem 0}.histogram-toolbar{display:flex;align-items:center;gap:.75rem;flex-wrap:wrap}.histogram-toolbar select{width:auto}.histogram-chart{height:260px;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:.5rem;align-items:end;border-bottom:1px solid var(--pico-muted-border-color);padding:.5rem .25rem 0}.histogram-column{height:100%;display:grid;grid-template-rows:1.5rem 1fr 2.75rem;align-items:end;text-align:center;min-width:0}.histogram-value{font-variant-numeric:tabular-nums}.histogram-track{height:100%;display:flex;align-items:end;justify-content:center}.histogram-bar{width:min(65%,3rem);background:var(--pico-primary);border-radius:.3rem .3rem 0 0;min-height:0}.histogram-column:nth-child(1) .histogram-bar{background:#718096}.histogram-column:nth-child(n+3) .histogram-bar{background:#d88727}.histogram-column:nth-child(n+5) .histogram-bar{background:#b5473c}.histogram-label{font-size:.8rem;line-height:1.15;align-self:start;padding-top:.35rem}table{font-variant-numeric:tabular-nums}th,td{text-align:right}th:first-child,td:first-child{text-align:left}#suppression-note{color:var(--pico-del-color)}@media(max-width:640px){body{padding:.75rem}.histogram-chart{gap:.15rem}.histogram-label{font-size:.65rem}.histogram-chart{height:220px}table{font-size:.8rem}}
</style>
</head>
<body>
<main>
<header><h1>Interaktive Beitragssimulation</h1><p>Referenzmonat: ${snapshot.referenceMonth || '–'} · ${snapshot.fixedBaseYearEnabled ? `Fixiertes Basisjahr ${snapshot.fixedBaseYear || '–'}` : 'Jahresbasis gemäß Simulation'}</p></header>
<p class="privacy-notice"><strong>Datenschutz:</strong> Diese Datei enthält nur aggregierte Tarifprofile. Es werden keine Namen, IDs oder Einzelbuchungen exportiert. Seltene Profile unter ${HTML_FAMILY_PROFILE_MIN_COUNT} Familien sind unterdrückt. Der Inhalt dieser HTML-Datei ist unverschlüsselt.</p>
<section><h2>Beiträge anpassen</h2><p>Änderungen werden ausschließlich in diesem Browser neu berechnet.</p><div id="tariff-controls"></div><div class="actions"><button id="reset-simulation" class="secondary">Änderungen zurücksetzen</button><button id="download-updated">Aktualisierte HTML-Datei herunterladen</button><button type="button" class="outline" onclick="window.print()">Drucken / als PDF speichern</button></div></section>
<section><h2>Jahresergebnisse</h2><div id="annual-results"></div></section>
<section><h2>Beitragsänderungen der betroffenen Familien</h2><p>Familien werden nach ihrer monatlichen Beitragsänderung gruppiert; jede Säule zeigt die Anzahl der Familien im jeweiligen Bereich.</p><div class="histogram-toolbar"><label for="histogram-year">Jahr</label><select id="histogram-year"></select><strong id="affected-count"></strong></div><div id="family-histogram"></div><p id="suppression-note" hidden>Datenschutzbedingt unterdrückte Familienprofile werden nicht neu berechnet: Ihr Beitragsanteil bleibt in den Jahresgesamtsummen auf dem Export-Ausgangswert. Änderungen und Histogramm zeigen deshalb nur die aufgeschlüsselten Profile; die Gesamtauswirkung ist unvollständig.</p><p><small>Die Histogrammänderung umfasst standardmäßig die Tarif-/Zuschusssimulation und den Effekt zum Vorjahr. Alle Berechnungen laufen lokal; die Datei lädt keine Inhalte aus dem Internet.</small></p></section>
</main>
<script id="simulation-data" type="application/json">${json}</script>
<script>${inlineRuntime}</script>
</body>
</html>`;
}
