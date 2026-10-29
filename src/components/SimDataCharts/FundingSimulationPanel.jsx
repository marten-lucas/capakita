import React from 'react';
import { Accordion, Alert, Badge, Button, Group, MultiSelect, NumberInput, Paper, Stack, Switch, Table, Text, Title, SimpleGrid } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconRefresh } from '@tabler/icons-react';
import { useDispatch, useSelector } from 'react-redux';
import { seedDefaultBayKiBiGRules, updateParentFeeSubsidy, updateScenarioFinanceSettings } from '../../store/simFinanceSlice';
import { useOverlayData } from '../../hooks/useOverlayData';
import { filterBookings } from '../../utils/chartUtils/chartUtils';
import { getFeeBandZeitkatId } from '../../utils/adebisConstants';
import {
  calculateFamilyFeePotentials,
  getFeeBandSimulationPriceKey,
  getFeeCatalogSimulationRows,
  simulateContributionChanges,
} from '../../utils/foerderSimulation';
import { calculateScenarioMonthlyFinance } from '../../utils/financeUtils';
import FeeStaircaseEditor from '../common/FeeStaircaseEditor';
import { REFORM_FIXED_ASSUMPTIONS, REFORM_YEARS } from '../../utils/reformSimulation';


const EMPTY_FINANCE = {};
const EMPTY_GROUP_FEE_CATALOGS = {};
const formatEuro = (value) => `${Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const formatSignedEuro = (value) => `${Number(value) > 0 ? '+' : ''}${formatEuro(value)}`;
const formatWeeklyHours = (value) => `${Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h/Woche`;
const formatPercent = (value) => `${Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;

function toDateValue(value) {
  if (!value) return null;
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
  return year && month && day ? new Date(year, month - 1, day) : null;
}

function toIsoDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function ReformAmountInput({ value, onCommit, ...props }) {
  const [draft, setDraft] = React.useState(value ?? 0);
  React.useEffect(() => setDraft(value ?? 0), [value]);

  return (
    <NumberInput
      {...props}
      value={draft}
      onChange={setDraft}
      onBlur={() => onCommit(draft === '' ? 0 : Number(draft))}
    />
  );
}

const REFORM_ACTUAL_FIELDS = [
  ['bookingTime', 'Förderung nach Buchungszeiten'],
  ['qualityBonus', 'Qualitätsbonus'],
  ['preparatoryCourses', 'Vorkurse'],
  ['under3Additional', 'Zusatzförderung U3'],
  ['under3Federal', 'U3-Bundesmittel'],
  ['parentFeeSubsidy', 'Elternbeitragszuschuss (durchlaufend)'],
  ['assistance', 'Fördersumme Assistenzkräfte'],
  ['personnelBonus', 'Fördersumme Personalbonus'],
  ['languageSpecialists', 'Fördersumme Sprachfachkräfte'],
];

function calculateReformPrefill2026({
  scenarioId,
  referenceDate,
  dataItems,
  bookingsByItem,
  groupAssignmentsByItem,
  qualificationAssignmentsByItem,
  groupDefs,
  financeScenario,
  groupFeeCatalogs,
  parentFeeSubsidy,
}) {
  const normalizedScenarioId = String(scenarioId);
  const referenceDate2026 = String(referenceDate || '').startsWith('2026-')
    ? referenceDate
    : '2026-12-01';
  const financeForModel = {
    ...financeScenario,
    groupFeeCatalogs,
    settings: {
      partialAbsenceThresholdDays: financeScenario?.settings?.partialAbsenceThresholdDays ?? 42,
      partialAbsenceEmployerSharePercent: financeScenario?.settings?.partialAbsenceEmployerSharePercent ?? 0,
    },
  };
  const bookingTime = calculateScenarioMonthlyFinance({
    referenceDate: referenceDate2026,
    effectiveDataItems: dataItems,
    effectiveBookingsByItem: bookingsByItem,
    effectiveGroupAssignmentsByItem: groupAssignmentsByItem,
    effectiveGroupDefs: groupDefs,
    financeScenario: financeForModel,
  }).summary.incomeBayKiBiG;
  let parentFeeSubsidyAmount = 0;

  Array.from({ length: 12 }, (_, monthIndex) => {
    const monthReferenceDate = `2026-${String(monthIndex + 1).padStart(2, '0')}-01`;
    const { demand } = filterBookings({
      bookingsByScenario: { [normalizedScenarioId]: bookingsByItem },
      dataByScenario: { [normalizedScenarioId]: dataItems },
      qualificationAssignmentsByScenario: { [normalizedScenarioId]: qualificationAssignmentsByItem },
      overlaysByScenario: {},
      scenarioId: normalizedScenarioId,
      referenceDate: monthReferenceDate,
      selectedGroups: [],
      selectedQualifications: [],
      groupsByScenario: { [normalizedScenarioId]: groupAssignmentsByItem },
    });
    parentFeeSubsidyAmount += simulateContributionChanges({
      demandBookings: demand,
      dataItems,
      groupDefs,
      bayKiBiGRules: financeScenario?.bayKiBiGRules || [],
      groupFeeCatalogs,
      originalGroupFeeCatalogs: groupFeeCatalogs,
      parentFeeSubsidy,
      temporaryPrices: {},
      utilizationPercent: 0,
      referenceDate: monthReferenceDate,
    }).totals.policyParentFeeSubsidy;
  });

  return {
    bookingTime: Math.round(bookingTime * 100) / 100,
    parentFeeSubsidy: Math.round(parentFeeSubsidyAmount * 100) / 100,
  };
}

function getConfiguredFundingYears(rules, currentYear) {
  const years = new Set();
  (rules || []).forEach((rule) => {
    if (!(Number(rule?.baseValue) > 0)) return;
    const startYear = /^\d{4}/.test(String(rule.validFrom || ''))
      ? Number(String(rule.validFrom).slice(0, 4))
      : currentYear;
    const endYear = /^\d{4}/.test(String(rule.validUntil || ''))
      ? Number(String(rule.validUntil).slice(0, 4))
      : startYear;
    if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || endYear < currentYear) return;
    for (let year = Math.max(currentYear, startYear); year <= endYear; year += 1) years.add(year);
  });
  return Array.from(years).sort((left, right) => left - right);
}

function getComparisonDateForYear(referenceDate, year) {
  const [, monthString, dayString] = String(referenceDate).slice(0, 10).split('-');
  const month = Number(monthString) || 1;
  const day = Number(dayString) || 1;
  const lastDayOfMonth = new Date(Number(year), month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDayOfMonth)).padStart(2, '0')}`;
}

function getSimulationDemandForDate({ scenarioId, referenceDate, selectedGroupIds, simulationData }) {
  const normalizedScenarioId = String(scenarioId);
  const filtered = filterBookings({
    bookingsByScenario: { [normalizedScenarioId]: simulationData.bookingsByItem },
    dataByScenario: { [normalizedScenarioId]: simulationData.dataItems },
    qualificationAssignmentsByScenario: { [normalizedScenarioId]: simulationData.qualificationAssignmentsByItem },
    overlaysByScenario: {},
    scenarioId: normalizedScenarioId,
    referenceDate,
    selectedGroups: selectedGroupIds,
    selectedQualifications: [],
    groupsByScenario: { [normalizedScenarioId]: simulationData.groupAssignmentsByItem },
  });
  const bookingsByItem = {};
  filtered.demand.forEach((booking) => {
    const itemId = String(booking.itemId);
    if (!bookingsByItem[itemId]) bookingsByItem[itemId] = {};
    bookingsByItem[itemId][String(booking.id)] = booking;
  });
  const selectedItemIds = new Set(Object.keys(bookingsByItem));
  return {
    demand: filtered.demand,
    effectiveDataItems: Object.fromEntries(Object.entries(simulationData.dataItems || {}).filter(([itemId]) => selectedItemIds.has(itemId))),
    effectiveBookingsByItem: bookingsByItem,
    effectiveGroupAssignmentsByItem: simulationData.groupAssignmentsByItem,
  };
}

function ReformForecastInputs({ settings, scenarioId, dispatch, calculatedValues }) {
  const forecast = settings?.reformForecast || {};
  const actual = forecast.actualFunding || {};
  const update = (field, value) => {
    dispatch(updateScenarioFinanceSettings({
      scenarioId,
      updates: {
        reformForecast: {
          ...forecast,
          actualFunding: { ...actual, [field]: value ?? 0 },
        },
      },
    }));
  };
  const updateApprovedPlaces = (value) => {
    dispatch(updateScenarioFinanceSettings({
      scenarioId,
      updates: { reformForecast: { ...forecast, approvedPlaces: Number(value) || 0 } },
    }));
  };
  const updateTeamGrantEligibility = (value) => {
    dispatch(updateScenarioFinanceSettings({
      scenarioId,
      updates: { reformForecast: { ...forecast, teamGrantEligible: value } },
    }));
  };

  return (
    <Accordion variant="separated" data-testid="reform-forecast-settings">
      <Accordion.Item value="reform-inputs">
        <Accordion.Control>
          <Stack gap={2}>
            <Text fw={600}>BayKiBiG-Reform · Zusatzdaten</Text>
            <Text size="xs" c="dimmed">2026-Istwerte, genehmigte Plätze und Personalangabe</Text>
          </Stack>
        </Accordion.Control>
        <Accordion.Panel>
          <Stack gap="md">
            <div>
              <Text fw={600} size="sm">2026-Istwerte aus KiBiG.web und Förderbescheiden</Text>
              <Text size="xs" c="dimmed">
                Buchungszeitenförderung und Elternbeitragszuschuss werden aus Capakita-Daten vorbelegt; übrige Beträge bitte anhand von Bescheiden eintragen.
              </Text>
            </div>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
              {REFORM_ACTUAL_FIELDS.map(([key, label]) => (
                <ReformAmountInput
                  key={key}
                  label={`Ist 2026 · ${label}`}
                  value={actual[key] ?? calculatedValues[key] ?? 0}
                  onCommit={(value) => update(key, value)}
                  min={0}
                  decimalScale={2}
                  thousandSeparator="."
                  decimalSeparator=","
                  suffix=" EUR"
                  data-testid={`reform-actual-${key}`}
                />
              ))}
            </SimpleGrid>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <ReformAmountInput
                label="Genehmigte Plätze (gemäß Betriebserlaubnis)"
                min={0}
                step={1}
                value={forecast.approvedPlaces ?? 0}
                onCommit={updateApprovedPlaces}
                data-testid="reform-approved-places"
              />
              <Switch
                mt="xl"
                label="Ab 2027 Personal außerhalb des Anstellungsschlüssels eingesetzt?"
                description="Ja: Teamkräfteförderung wird berücksichtigt."
                checked={forecast.teamGrantEligible === true}
                onChange={(event) => updateTeamGrantEligibility(event.currentTarget.checked)}
                data-testid="reform-team-grant-eligible"
              />
            </SimpleGrid>
            <Alert color="blue" variant="light" title="Qualitätsbonus-Benchmark">
              2026–2029: {REFORM_YEARS.map((year) => REFORM_FIXED_ASSUMPTIONS.qualityBonusBenchmarkByYear[year].toLocaleString('de-DE', { minimumFractionDigits: 2 })).join(' · ')} €. Der BayKiBiG-Basiswert wird pro Jahr aus der passenden Regel in den Optionen übernommen.
            </Alert>
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}

const DEFAULT_PARENT_FEE_SUBSIDY = { endDate: '2026-12-31' };

function FundingSimulationPanel() {
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector((state) => state.simScenario.selectedScenarioId);
  const financeByScenario = useSelector((state) => state.simFinance?.financeByScenario || {});
  const financeScenario = financeByScenario[String(selectedScenarioId)] || EMPTY_FINANCE;
  const referenceDate = useSelector((state) => state.chart?.referenceDate)
    || new Date().toISOString().slice(0, 10);
  const {
    getEffectiveDataItems,
    getEffectiveBookings,
    getEffectiveGroupDefs,
    getEffectiveGroupAssignments,
    getEffectiveQualificationAssignments,
  } = useOverlayData();
  const [temporaryCatalogEntries, setTemporaryCatalogEntries] = React.useState({});
  const [temporaryPrices, setTemporaryPrices] = React.useState({});
  const [selectedGroupIds, setSelectedGroupIds] = React.useState([]);
  const [potentialMonthlyBudget, setPotentialMonthlyBudget] = React.useState(50);

  React.useEffect(() => {
    setTemporaryCatalogEntries({});
    setTemporaryPrices({});
    setSelectedGroupIds([]);
    if (selectedScenarioId) dispatch(seedDefaultBayKiBiGRules({ scenarioId: selectedScenarioId }));
  }, [selectedScenarioId, dispatch]);

  const groupFeeCatalogs = financeScenario?.groupFeeCatalogs || EMPTY_GROUP_FEE_CATALOGS;
  const parentFeeSubsidy = financeScenario?.parentFeeSubsidy || DEFAULT_PARENT_FEE_SUBSIDY;
  const groupDefs = getEffectiveGroupDefs();
  const simulationData = React.useMemo(() => {
    const dataItems = getEffectiveDataItems();
    const bookingsByItem = {};
    const groupAssignmentsByItem = {};
    const qualificationAssignmentsByItem = {};
    Object.keys(dataItems || {}).forEach((itemId) => {
      bookingsByItem[itemId] = getEffectiveBookings(itemId);
      groupAssignmentsByItem[itemId] = getEffectiveGroupAssignments(itemId);
      qualificationAssignmentsByItem[itemId] = Object.fromEntries(
        (getEffectiveQualificationAssignments(itemId) || []).map((assignment, index) => [String(index), assignment])
      );
    });
    return { dataItems, bookingsByItem, groupAssignmentsByItem, qualificationAssignmentsByItem };
  }, [
    getEffectiveDataItems,
    getEffectiveBookings,
    getEffectiveGroupAssignments,
    getEffectiveQualificationAssignments,
  ]);
  const calculatedReformValues = React.useMemo(() => calculateReformPrefill2026({
    scenarioId: selectedScenarioId,
    referenceDate,
    ...simulationData,
    groupDefs,
    financeScenario,
    groupFeeCatalogs,
    parentFeeSubsidy,
  }), [selectedScenarioId, referenceDate, simulationData, groupDefs, financeScenario, groupFeeCatalogs, parentFeeSubsidy]);
  const groupFilterOptions = React.useMemo(() => [
    ...(groupDefs || []).map((group) => ({ value: String(group.id), label: group.name || String(group.id) })),
    { value: '__NO_GROUP__', label: 'Ohne Gruppe' },
  ], [groupDefs]);
  const groupLabels = React.useMemo(() => new Map(
    (groupDefs || []).map((group) => [String(group.id), group.name || String(group.id)])
  ), [groupDefs]);

  const categoryPriceRows = React.useMemo(() => {
    const rows = getFeeCatalogSimulationRows(groupFeeCatalogs, groupLabels, referenceDate);
    if (selectedGroupIds.length === 0) return rows;
    const selectedGroupIdSet = new Set(selectedGroupIds);
    return rows.filter((row) => selectedGroupIdSet.has(row.groupId));
  }, [groupFeeCatalogs, groupLabels, referenceDate, selectedGroupIds]);
  const simulationCatalogs = React.useMemo(() => ({
    ...groupFeeCatalogs,
    ...temporaryCatalogEntries,
  }), [groupFeeCatalogs, temporaryCatalogEntries]);
  const effectiveFeeCatalogs = React.useMemo(() => Object.fromEntries(
    Object.entries(simulationCatalogs).map(([groupId, entries]) => [
      groupId,
      entries.map((entry) => {
        const override = temporaryPrices?.[groupId]?.[getFeeBandSimulationPriceKey(entry)];
        return Number.isFinite(Number(override))
          ? { ...entry, monthlyAmount: Number(override) }
          : entry;
      }),
    ])
  ), [simulationCatalogs, temporaryPrices]);
  const tariffGroups = React.useMemo(() => {
    const groupIds = new Set([
      ...(groupDefs || []).map((group) => String(group.id)),
      ...Object.keys(groupFeeCatalogs || {}).map(String),
    ]);
    return Array.from(groupIds)
      .filter((groupId) => selectedGroupIds.length === 0 || selectedGroupIds.includes(groupId))
      .filter((groupId) => (groupFeeCatalogs[groupId] || []).length > 0)
      .map((groupId) => ({
        id: groupId,
        name: groupLabels.get(groupId) || groupId,
      }))
      .sort((left, right) => left.name.localeCompare(right.name, 'de'));
  }, [groupDefs, groupFeeCatalogs, groupLabels, selectedGroupIds]);

  const currentYear = Number(referenceDate.slice(0, 4));
  const fundingYears = React.useMemo(
    () => getConfiguredFundingYears(financeScenario?.bayKiBiGRules, currentYear),
    [financeScenario?.bayKiBiGRules, currentYear]
  );
  const annualIncomeRows = React.useMemo(() => {
    const financeForModel = { ...financeScenario, groupFeeCatalogs };
    return fundingYears.map((year) => {
      const comparisonDate = getComparisonDateForYear(referenceDate, year);
      const demandData = getSimulationDemandForDate({
        scenarioId: selectedScenarioId,
        referenceDate: comparisonDate,
        selectedGroupIds: [],
        simulationData,
      });
      const monthlyFinance = calculateScenarioMonthlyFinance({
        referenceDate: comparisonDate,
        ...demandData,
        effectiveGroupDefs: groupDefs,
        financeScenario: financeForModel,
      });
      const monthlySimulation = simulateContributionChanges({
        demandBookings: demandData.demand,
        dataItems: simulationData.dataItems,
        groupDefs,
        bayKiBiGRules: financeScenario?.bayKiBiGRules || [],
        groupFeeCatalogs: simulationCatalogs,
        originalGroupFeeCatalogs: groupFeeCatalogs,
        parentFeeSubsidy,
        temporaryPrices,
        utilizationPercent: 0,
        referenceDate: comparisonDate,
      });
      const fundingChange = Math.round(monthlySimulation.totals.deltaMonthlyBayKiBiG * 100) / 100;
      const contributionsChange = Math.round((monthlySimulation.totals.deltaParentFees
        + monthlySimulation.totals.deltaParentFeeSubsidy) * 12 * 100) / 100;
      const funding = Math.round((monthlyFinance.summary.incomeBayKiBiG + fundingChange) * 100) / 100;
      const contributions = Math.round((monthlyFinance.summary.incomeParents * 12 + contributionsChange) * 100) / 100;
      return {
        year,
        funding,
        fundingChange,
        contributions,
        contributionsChange,
        totalIncome: Math.round((funding + contributions) * 100) / 100,
        totalIncomeChange: Math.round((fundingChange + contributionsChange) * 100) / 100,
      };
    });
  }, [
    referenceDate,
    fundingYears,
    financeScenario,
    groupFeeCatalogs,
    selectedScenarioId,
    simulationData,
    groupDefs,
    simulationCatalogs,
    parentFeeSubsidy,
    temporaryPrices,
  ]);
  const currentDemandData = React.useMemo(() => getSimulationDemandForDate({
    scenarioId: selectedScenarioId,
    referenceDate,
    selectedGroupIds: [],
    simulationData,
  }), [selectedScenarioId, referenceDate, simulationData]);
  const currentSimulation = React.useMemo(() => simulateContributionChanges({
    demandBookings: currentDemandData.demand,
    dataItems: simulationData.dataItems,
    groupDefs,
    bayKiBiGRules: financeScenario?.bayKiBiGRules || [],
    groupFeeCatalogs: simulationCatalogs,
    originalGroupFeeCatalogs: groupFeeCatalogs,
    parentFeeSubsidy,
    temporaryPrices,
    utilizationPercent: 0,
    referenceDate,
  }), [
    currentDemandData,
    simulationData,
    groupDefs,
    financeScenario?.bayKiBiGRules,
    simulationCatalogs,
    groupFeeCatalogs,
    parentFeeSubsidy,
    temporaryPrices,
    referenceDate,
  ]);
  const familyPotentials = React.useMemo(() => calculateFamilyFeePotentials({
    demandBookings: currentDemandData.demand,
    dataItems: simulationData.dataItems,
    groupDefs,
    groupFeeCatalogs: simulationCatalogs,
    parentFeeSubsidy,
    temporaryPrices,
    referenceDate,
    monthlyBudget: potentialMonthlyBudget,
  }), [
    currentDemandData,
    simulationData,
    groupDefs,
    simulationCatalogs,
    parentFeeSubsidy,
    temporaryPrices,
    referenceDate,
    potentialMonthlyBudget,
  ]);
  const familyPotentialById = React.useMemo(() => new Map(
    familyPotentials.map((family) => [family.id, family])
  ), [familyPotentials]);
  const affectedFamilyRows = React.useMemo(() => currentSimulation.familyContributions
    .filter((family) => Math.abs(family.deltaMonthlyParentFees) >= 0.005)
    .map((family) => ({
      ...family,
      changePercent: family.monthlyParentFeesBefore > 0
        ? family.deltaMonthlyParentFees / family.monthlyParentFeesBefore * 100
        : null,
      potential: familyPotentialById.get(family.id) || {
        potentialUpgradeWeeklyHours: 0,
        potentialDowngradeWeeklyHours: 0,
      },
    }))
    .sort((left, right) => Math.abs(right.deltaMonthlyParentFees) - Math.abs(left.deltaMonthlyParentFees)),
  [currentSimulation.familyContributions, familyPotentialById]);

  const setTemporaryCatalog = (groupId, nextEntries) => {
    const originalEntries = groupFeeCatalogs[groupId] || [];
    const overrides = {};
    const structuralEntries = nextEntries.map((entry) => {
      const original = originalEntries.find((candidate) => String(candidate.id) === String(entry.id));
      const originalAmount = Number(original?.monthlyAmount) || 0;
      const nextAmount = Number(entry.monthlyAmount) || 0;
      if (Math.round(originalAmount * 100) !== Math.round(nextAmount * 100)) {
        overrides[getFeeBandSimulationPriceKey(entry)] = nextAmount;
      }
      return { ...entry, monthlyAmount: original ? originalAmount : 0 };
    });
    setTemporaryCatalogEntries((current) => ({ ...current, [groupId]: structuralEntries }));
    setTemporaryPrices((current) => ({ ...current, [groupId]: overrides }));
  };
  const resetTemporaryCatalog = (groupId) => {
    setTemporaryCatalogEntries((current) => {
      const next = { ...current };
      delete next[groupId];
      return next;
    });
    setTemporaryPrices((current) => {
      const next = { ...current };
      delete next[groupId];
      return next;
    });
  };
  const resetAllTemporaryCatalogs = () => {
    setTemporaryCatalogEntries({});
    setTemporaryPrices({});
  };

  const hasRule = (financeScenario?.bayKiBiGRules || []).some((rule) => Number(rule.baseValue) > 0);
  const catalogEntries = Object.values(groupFeeCatalogs).flatMap((entries) => (Array.isArray(entries) ? entries : []));
  const hasAnyZeitkatEntries = catalogEntries.some((entry) => Boolean(getFeeBandZeitkatId(entry)) && entry.enabled !== false && Number(entry.monthlyAmount) > 0);
  const hasSimulationFeeRows = categoryPriceRows.length > 0;

  return (
    <SimpleGrid
      cols={2}
      spacing="md"
      h="100%"
      style={{ minHeight: 0, gridTemplateRows: 'minmax(0, 1fr)' }}
      data-testid="funding-simulation-panel"
    >
      <Stack
        gap="md"
        h="100%"
        p="sm"
        style={{ minWidth: 0, overflowY: 'auto', overflowX: 'hidden' }}
        data-testid="simulation-settings-panel"
      >
      <Group gap="sm" align="flex-end" wrap="nowrap">
        <Text size="sm" fw={600} style={{ whiteSpace: 'nowrap', paddingBottom: 8 }}>Tarifgruppen</Text>
        <MultiSelect
          aria-label="Gruppen für Tarif-Einstellungen"
          placeholder="Alle Gruppen"
          data={groupFilterOptions}
          value={selectedGroupIds}
          onChange={setSelectedGroupIds}
          searchable
          clearable
          style={{ flex: 1, minWidth: 0 }}
          data-testid="simulation-group-filter"
        />
      </Group>
      {!hasRule ? (
        <Badge color="orange" variant="light" w="fit-content" data-testid="simulation-missing-funding-rule">
          Keine BayKiBiG-Förderregel mit positivem Basiswert konfiguriert (Optionen → Förderregel).
        </Badge>
      ) : null}
      {!hasSimulationFeeRows ? (
        <Badge color="orange" variant="light" w="fit-content">
          {!catalogEntries.length
            ? 'Keine Beitragsstaffeln im Capakita-Datenspeicher gefunden. JSON-Katalog unter Optionen → Beiträge importieren.'
            : hasAnyZeitkatEntries
              ? `ZEITKAT-Beitragssätze sind vorhanden, aber am Stichtag ${referenceDate} nicht gültig. Bitte die Gültigkeitszeiträume in Optionen → Beiträge prüfen.`
              : 'Der gespeicherte Katalog enthält keine verwendbaren Beitragsstaffeln für den ausgewählten Stichtag.'}
        </Badge>
      ) : null}

      <Paper withBorder p="sm" radius="md" data-testid="temporary-category-prices">
        <Stack gap="sm">
          <Group justify="space-between" align="center" wrap="nowrap" data-testid="temporary-category-prices-header">
            <Text fw={600} size="sm">Beitragsstaffeln aus dem Capakita-Datenspeicher</Text>
            {categoryPriceRows.length > 0 || Object.keys(temporaryCatalogEntries).length > 0 ? (
              <Button
                size="xs"
                variant="subtle"
                leftSection={<IconRefresh size={14} />}
                onClick={resetAllTemporaryCatalogs}
                title="Alle simulierten Beitragsstaffeln auf Ausgangswerte zurücksetzen"
                data-testid="reset-all-temporary-prices"
              >
                Alle zurücksetzen
              </Button>
            ) : null}
          </Group>
          {tariffGroups.length > 0 ? (
            <Accordion
              variant="separated"
              defaultValue={tariffGroups[0]?.id || null}
              data-testid="simulation-tariff-groups"
            >
              {tariffGroups.map((group) => (
                <Accordion.Item key={group.id} value={group.id}>
                  <Accordion.Control>
                    <Group justify="space-between" pr="md" wrap="wrap">
                      <Text fw={600}>{group.name}</Text>
                      <Text size="xs" c="dimmed">{(effectiveFeeCatalogs[group.id] || []).filter((entry) => entry.enabled !== false && Number(entry.monthlyAmount) > 0).length} Staffeln</Text>
                    </Group>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <FeeStaircaseEditor
                      entries={effectiveFeeCatalogs[group.id] || []}
                      originalEntries={groupFeeCatalogs[group.id] || []}
                      referenceDate={referenceDate}
                      simulation
                      onChangeEntries={(nextEntries) => setTemporaryCatalog(group.id, nextEntries)}
                      onResetAll={() => resetTemporaryCatalog(group.id)}
                    />
                  </Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion>
          ) : (
            <Text size="xs" c="dimmed">Es gibt für den ausgewählten Stichtag keine ZEITKAT- oder Wochenstunden-Beitragsstaffeln.</Text>
          )}
        </Stack>
      </Paper>

      <Paper withBorder p="sm" radius="md" data-testid="parent-fee-subsidy-control">
        <Group justify="space-between" align="flex-end" wrap="nowrap" data-testid="parent-fee-subsidy-header">
          <Text fw={600} size="sm" style={{ minWidth: 0 }}>Elternbeitragszuschuss / Rabatt</Text>
          <DatePickerInput
            label="Gilt bis"
            value={toDateValue(parentFeeSubsidy.endDate)}
            onChange={(value) => dispatch(updateParentFeeSubsidy({
              scenarioId: selectedScenarioId,
              updates: { endDate: toIsoDate(value) },
            }))}
            valueFormat="DD.MM.YYYY"
            clearable
            w={220}
            data-testid="parent-fee-subsidy-end-date"
          />
        </Group>
      </Paper>

      <ReformForecastInputs
        settings={financeScenario.settings}
        scenarioId={selectedScenarioId}
        dispatch={dispatch}
        calculatedValues={calculatedReformValues}
      />
      </Stack>
      <Paper
        withBorder
        p="md"
        radius="md"
        h="100%"
        style={{ minWidth: 0, overflow: 'auto' }}
        data-testid="simulation-results-panel"
      >
        <Stack gap="lg">
          <Title order={2}>Ergebnis</Title>
          <Stack gap="xs">
            <Text fw={700}>Einnahmen im Jahresvergleich · Jahreswerte zum gewählten Stichtag</Text>
            {annualIncomeRows.length === 0 ? (
              <Text size="sm" c="dimmed" data-testid="no-funding-years">
                Für das aktuelle oder kommende Jahr ist keine BayKiBiG-Förderregel mit positivem Basiswert hinterlegt.
              </Text>
            ) : (
              <Paper withBorder radius="sm" style={{ overflowX: 'auto' }}>
                <Table striped highlightOnHover withTableBorder fz="xs" miw={720} data-testid="annual-income-results">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Jahr</Table.Th>
                      <Table.Th ta="right">Förderung / Jahr</Table.Th>
                      <Table.Th ta="right">Δ Förderung</Table.Th>
                      <Table.Th ta="right">Beiträge / Jahr</Table.Th>
                      <Table.Th ta="right">Δ Beiträge</Table.Th>
                      <Table.Th ta="right">Einnahmen gesamt / Jahr</Table.Th>
                      <Table.Th ta="right">Δ gesamt</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {annualIncomeRows.map((row) => (
                      <Table.Tr key={row.year} data-testid={`annual-income-row-${row.year}`}>
                        <Table.Td>{row.year}</Table.Td>
                        <Table.Td ta="right">{formatEuro(row.funding)}</Table.Td>
                        <Table.Td ta="right">{formatSignedEuro(row.fundingChange)}</Table.Td>
                        <Table.Td ta="right">{formatEuro(row.contributions)}</Table.Td>
                        <Table.Td ta="right">{formatSignedEuro(row.contributionsChange)}</Table.Td>
                        <Table.Td ta="right" fw={700}>{formatEuro(row.totalIncome)}</Table.Td>
                        <Table.Td ta="right" fw={700}>{formatSignedEuro(row.totalIncomeChange)}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Paper>
            )}
          </Stack>

          <Stack gap="xs">
            <Group justify="space-between" align="flex-end" wrap="wrap">
              <Text fw={700}>Von Beitragsänderungen betroffene Familien</Text>
              <NumberInput
                label="Budgetänderung pro Familie / Monat"
                value={potentialMonthlyBudget}
                onChange={(value) => setPotentialMonthlyBudget(Math.max(0, Number(value) || 0))}
                min={0}
                max={500}
                step={5}
                decimalScale={2}
                thousandSeparator="."
                decimalSeparator=","
                suffix=" EUR"
                w={230}
                data-testid="family-potential-budget"
              />
            </Group>
            {affectedFamilyRows.length === 0 ? (
              <Text size="sm" c="dimmed" data-testid="no-affected-families">
                Für die aktuellen Beitragssätze sind keine Familien von einer Beitragsänderung betroffen.
              </Text>
            ) : (
              <Paper withBorder radius="sm" style={{ overflowX: 'auto' }}>
                <Table striped highlightOnHover withTableBorder fz="xs" miw={680} data-testid="affected-families-table">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Familie</Table.Th>
                      <Table.Th ta="right">Beiträge / Monat</Table.Th>
                      <Table.Th ta="right">Veränderung</Table.Th>
                      <Table.Th ta="right">Veränderung %</Table.Th>
                      <Table.Th ta="right">Potential Upgrade</Table.Th>
                      <Table.Th ta="right">Potential Downgrade</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {affectedFamilyRows.map((family) => (
                      <Table.Tr key={family.id} data-testid={`affected-family-${family.id}`}>
                        <Table.Td>{family.label}</Table.Td>
                        <Table.Td ta="right">{formatEuro(family.monthlyParentFeesAfter)}</Table.Td>
                        <Table.Td ta="right">{formatSignedEuro(family.deltaMonthlyParentFees)}</Table.Td>
                        <Table.Td ta="right">{family.changePercent == null ? '–' : formatPercent(family.changePercent)}</Table.Td>
                        <Table.Td ta="right">
                          {family.potential.potentialUpgradeWeeklyHours > 0
                            ? `+${formatWeeklyHours(family.potential.potentialUpgradeWeeklyHours)}`
                            : '–'}
                        </Table.Td>
                        <Table.Td ta="right">
                          {family.potential.potentialDowngradeWeeklyHours > 0
                            ? `−${formatWeeklyHours(family.potential.potentialDowngradeWeeklyHours)}`
                            : '–'}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Paper>
            )}
          </Stack>
        </Stack>
      </Paper>
    </SimpleGrid>
  );
}

export default FundingSimulationPanel;
