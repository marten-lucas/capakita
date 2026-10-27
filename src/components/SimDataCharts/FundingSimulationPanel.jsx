import React from 'react';
import { Accordion, Alert, Badge, Box, Button, Group, NumberInput, Paper, Slider, Stack, Table, Tabs, Text, SimpleGrid } from '@mantine/core';
import { IconArrowRight, IconCoins, IconUsers } from '@tabler/icons-react';
import { useDispatch, useSelector } from 'react-redux';
import { setSelectedItem } from '../../store/simScenarioSlice';
import { useOverlayData } from '../../hooks/useOverlayData';
import { filterBookings } from '../../utils/chartUtils/chartUtils';
import { simulateAnnualContributionChanges, simulateContributionChanges } from '../../utils/foerderSimulation';
import { getFeeBandZeitkatId } from '../../utils/adebisConstants';
import { getFeeBandSimulationPriceKey, getFeeCatalogSimulationRows } from '../../utils/foerderSimulation';
import FeeStaircaseEditor from '../common/FeeStaircaseEditor';
import { calculateReformForecast } from '../../utils/reformSimulation';
import { calculateScenarioMonthlyFinance } from '../../utils/financeUtils';
import { CopyTableButton } from '../common/CopyToClipboardButton';

const formatEuro = (value) => `${Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const formatHours = (value) => `${Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} h`;
const formatAffectedCount = (children, families) => (
  `${children} ${children === 1 ? 'Kind' : 'Kinder'} in ${families} ${families === 1 ? 'Familie' : 'Familien'}.`
);
const EMPTY_FINANCE = {};
const EMPTY_GROUP_FEE_CATALOGS = {};

const DEFAULT_PARENT_FEE_SUBSIDY = {
  enabled: true,
  monthlyAmount: 100,
  minimumAgeYears: 3,
  maximumAgeYears: 7,
  excludeSchoolChildren: true,
  endDate: '2026-12-31',
};

function FundingSimulationPanel({ accent }) {
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

  const [utilizationPercent, setUtilizationPercent] = React.useState(100);
  const [temporaryCatalogEntries, setTemporaryCatalogEntries] = React.useState({});
  const [temporaryPrices, setTemporaryPrices] = React.useState({});
  const [temporaryParentFeeSubsidyAmount, setTemporaryParentFeeSubsidyAmount] = React.useState(null);
  const [activeTab, setActiveTab] = React.useState('groups');
  const groupTableRef = React.useRef(null);
  const childTableRef = React.useRef(null);
  const familyTableRef = React.useRef(null);

  React.useEffect(() => {
    setTemporaryCatalogEntries({});
    setTemporaryPrices({});
    setTemporaryParentFeeSubsidyAmount(null);
  }, [selectedScenarioId]);

  const groupFeeCatalogs = financeScenario?.groupFeeCatalogs || EMPTY_GROUP_FEE_CATALOGS;
  const parentFeeSubsidy = financeScenario?.parentFeeSubsidy || DEFAULT_PARENT_FEE_SUBSIDY;
  const baselineParentFeeSubsidyAmount = parentFeeSubsidy.enabled === false
    ? 0
    : Math.max(0, Number(parentFeeSubsidy.monthlyAmount ?? 100) || 0);
  const subsidyEndsBeforeReferenceDate = Boolean(parentFeeSubsidy.endDate)
    && referenceDate > String(parentFeeSubsidy.endDate).slice(0, 10);
  const policyParentFeeSubsidyAmount = subsidyEndsBeforeReferenceDate ? 0 : baselineParentFeeSubsidyAmount;
  const simulatedParentFeeSubsidyAmount = temporaryParentFeeSubsidyAmount ?? policyParentFeeSubsidyAmount;
  const groupDefs = getEffectiveGroupDefs();
  const groupLabels = React.useMemo(() => new Map(
    (groupDefs || []).map((group) => [String(group.id), group.name || String(group.id)])
  ), [groupDefs]);

  const categoryPriceRows = React.useMemo(
    () => getFeeCatalogSimulationRows(groupFeeCatalogs, groupLabels, referenceDate),
    [groupFeeCatalogs, groupLabels, referenceDate]
  );
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
    const rowCounts = new Map();
    categoryPriceRows.forEach((row) => rowCounts.set(row.groupId, (rowCounts.get(row.groupId) || 0) + 1));
    const groupIds = new Set([
      ...(groupDefs || []).map((group) => String(group.id)),
      ...Object.keys(groupFeeCatalogs || {}).map(String),
    ]);
    return Array.from(groupIds)
      .filter((groupId) => (groupFeeCatalogs[groupId] || []).length > 0)
      .map((groupId) => ({
        id: groupId,
        name: groupLabels.get(groupId) || groupId,
        rows: Array.from({ length: rowCounts.get(groupId) || 0 }),
      }))
      .sort((left, right) => left.name.localeCompare(right.name, 'de'));
  }, [categoryPriceRows, groupDefs, groupFeeCatalogs, groupLabels]);

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

  const reformBaseline = React.useMemo(() => {
    const dataItems = getEffectiveDataItems();
    const effectiveGroupDefs = getEffectiveGroupDefs();
    const bookingsByItem = {};
    const groupAssignmentsByItem = {};
    Object.keys(dataItems || {}).forEach((itemId) => {
      bookingsByItem[itemId] = getEffectiveBookings(itemId);
      groupAssignmentsByItem[itemId] = getEffectiveGroupAssignments(itemId);
    });
    const financeForHistoricalComparison = {
      bayKiBiGRules: financeScenario?.bayKiBiGRules || [],
      groupFeeCatalogs,
      itemFinances: financeScenario?.itemFinances || {},
      settings: {
        partialAbsenceThresholdDays: financeScenario?.settings?.partialAbsenceThresholdDays ?? 42,
        partialAbsenceEmployerSharePercent: financeScenario?.settings?.partialAbsenceEmployerSharePercent ?? 0,
      },
    };
    const annualFunding = Array.from({ length: 12 }, (_, monthIndex) => {
      const monthReferenceDate = `2026-${String(monthIndex + 1).padStart(2, '0')}-01`;
      return calculateScenarioMonthlyFinance({
        referenceDate: monthReferenceDate,
        effectiveDataItems: dataItems,
        effectiveBookingsByItem: bookingsByItem,
        effectiveGroupAssignmentsByItem: groupAssignmentsByItem,
        effectiveGroupDefs,
        financeScenario: financeForHistoricalComparison,
      }).summary.incomeBayKiBiG;
    }).reduce((sum, amount) => sum + amount, 0);
    return { year: 2026, capakitaModeledAnnualFunding: annualFunding };
  }, [
    getEffectiveDataItems,
    getEffectiveBookings,
    getEffectiveGroupDefs,
    getEffectiveGroupAssignments,
    financeScenario?.bayKiBiGRules,
    financeScenario?.itemFinances,
    financeScenario?.settings?.partialAbsenceThresholdDays,
    financeScenario?.settings?.partialAbsenceEmployerSharePercent,
    groupFeeCatalogs,
  ]);

  const simulation = React.useMemo(() => {
    const dataItems = getEffectiveDataItems();
    const effectiveGroupDefs = getEffectiveGroupDefs();
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

    const { demand } = filterBookings({
      bookingsByScenario: { [selectedScenarioId]: bookingsByItem },
      dataByScenario: { [selectedScenarioId]: dataItems },
      qualificationAssignmentsByScenario: { [selectedScenarioId]: qualificationAssignmentsByItem },
      overlaysByScenario: {},
      scenarioId: selectedScenarioId,
      referenceDate,
      selectedGroups: [],
      selectedQualifications: [],
      groupsByScenario: { [selectedScenarioId]: groupAssignmentsByItem },
    });

    const options = {
      demandBookings: demand,
      dataItems,
      groupDefs: effectiveGroupDefs,
      bayKiBiGRules: financeScenario?.bayKiBiGRules || [],
      groupFeeCatalogs: simulationCatalogs,
      originalGroupFeeCatalogs: groupFeeCatalogs,
      parentFeeSubsidy,
      temporaryParentFeeSubsidyAmount,
      temporaryPrices,
      utilizationPercent,
    };
    return {
      current: simulateContributionChanges({ ...options, referenceDate }),
      annual: simulateAnnualContributionChanges({ ...options, year: Number(referenceDate.slice(0, 4)) }),
    };
  }, [
    getEffectiveDataItems,
    getEffectiveBookings,
    getEffectiveGroupDefs,
    getEffectiveGroupAssignments,
    getEffectiveQualificationAssignments,
    selectedScenarioId,
    referenceDate,
    financeScenario,
    simulationCatalogs,
    groupFeeCatalogs,
    parentFeeSubsidy,
    temporaryParentFeeSubsidyAmount,
    temporaryPrices,
    utilizationPercent,
  ]);

  const result = simulation.current;
  const annualResult = simulation.annual;
  const reformForecast = React.useMemo(
    () => calculateReformForecast(financeScenario?.settings?.reformForecast || {}),
    [financeScenario?.settings?.reformForecast]
  );
  const totals = result?.totals || {
    bookingHoursBefore: 0,
    bookingHoursAfter: 0,
    deltaMonthlyBayKiBiG: 0,
    deltaParentFees: 0,
    deltaParentFeeSubsidy: 0,
    deltaMonthlyTotal: 0,
    deltaYearlyTotal: 0,
    migratedBookings: 0,
    affectedChildren: 0,
    affectedFamilies: 0,
    childrenWithMoreHours: 0,
    familiesWithMoreHours: 0,
    weeklyHoursAdded: 0,
    childrenWithHigherFees: 0,
    familiesWithHigherFees: 0,
    monthlyParentCostIncrease: 0,
    childrenWithLowerFees: 0,
    familiesWithLowerFees: 0,
    monthlyParentCostReduction: 0,
  };
  const hasRule = Boolean(result?.rule && Number(result.rule.baseValue) > 0);
  const catalogEntries = Object.values(groupFeeCatalogs).flatMap((entries) => (Array.isArray(entries) ? entries : []));
  const hasAnyZeitkatEntries = catalogEntries.some((entry) => Boolean(getFeeBandZeitkatId(entry)));
  const hasZeitkatRates = categoryPriceRows.some((row) => row.kind === 'zeitkat');
  const hasWeeklyHourRates = categoryPriceRows.some((row) => row.kind === 'weeklyHours');
  const hasSimulationFeeRows = categoryPriceRows.length > 0;

  const kpis = [
    { label: 'Buchungsstunden vorher', value: formatHours(totals.bookingHoursBefore), icon: IconUsers },
    { label: 'Buchungsstunden Simulation', value: formatHours(totals.bookingHoursAfter), icon: IconUsers },
    { label: 'Δ Förderung / Monat', value: formatEuro(totals.deltaMonthlyBayKiBiG), icon: IconCoins },
    { label: 'Δ Elternanteil / Monat', value: formatEuro(totals.deltaParentFees), icon: IconCoins },
    { label: 'Δ Elternbeitragszuschuss / Monat', value: formatEuro(totals.deltaParentFeeSubsidy), icon: IconCoins },
    { label: 'Δ Gesamteinnahmen / Monat', value: formatEuro(totals.deltaMonthlyTotal), icon: IconCoins },
    { label: 'Δ Gesamteinnahmen / Jahr', value: formatEuro(annualResult?.totals?.deltaYearlyTotal || 0), icon: IconCoins },
  ];

  return (
    <Stack gap="md" h="100%" p="md" style={{ overflow: 'auto' }} data-testid="funding-simulation-panel">
      <Stack gap={2}>
        <Text fw={700} size="sm" style={{ color: accent }}>Simulation von Beitragsänderungen</Text>
        <Text size="xs" c="dimmed">
          Verwendet die im Capakita-Datenspeicher hinterlegten ZEITKAT-Sätze oder, falls diese fehlen, JSON-importierte Wochenstunden-Bänder.
          Fehlende ZEITKAT werden aus den gespeicherten Buchungszeiten abgeleitet. Bei gleichem Preis wechselt die Ausschöpfungsquote anteilig in die nächste Staffel.
          Simulationspreise bleiben lokal und verändern weder Optionen noch gespeicherte Buchungen.
        </Text>
        {!hasRule ? (
          <Badge color="orange" variant="light" w="fit-content">
            Keine Förderregel mit Basiswert hinterlegt (Einstellungen → Förderregel) – Förderänderungen = 0.
          </Badge>
        ) : null}
        {result?.skippedNoZone > 0 ? (
          <Badge color="orange" variant="light" w="fit-content">
            Für {result.skippedNoZone} Buchung{result.skippedNoZone === 1 ? '' : 'en'} fehlen sowohl ZEITKAT als auch auswertbare Buchungszeiten; dafür kann keine Förderänderung berechnet werden.
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
        {!hasZeitkatRates && hasWeeklyHourRates ? (
          <Badge color="blue" variant="light" w="fit-content">
            ZEITKAT-Sätze fehlen; die JSON-importierten Wochenstunden-Bänder werden direkt verwendet. Fehlende ZEITKAT werden, soweit Buchungszeiten vorhanden sind, aus dem Capakita-Datenspeicher abgeleitet.
          </Badge>
        ) : null}
      </Stack>

      <Paper withBorder p="sm" radius="md" data-testid="temporary-category-prices">
        <Stack gap="sm">
          <Group justify="space-between" align="center" wrap="wrap">
            <Stack gap={2}>
              <Text fw={600} size="sm">Beitragsstaffeln aus dem Capakita-Datenspeicher</Text>
              <Text size="xs" c="dimmed">Die Treppenfläche zeigt Stundenbereich und Monatsbeitrag; darunter lassen sich Grenzen und Beträge direkt eingeben. Originalstaffeln bleiben im Hintergrund sichtbar. Änderungen gelten nur lokal für diese Simulation.</Text>
            </Stack>
            {categoryPriceRows.length > 0 || Object.keys(temporaryCatalogEntries).length > 0 ? (
              <Button size="xs" variant="subtle" onClick={resetAllTemporaryCatalogs} data-testid="reset-all-temporary-prices">
                Alle auf Ausgangswerte zurücksetzen
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
                      <Text size="xs" c="dimmed">{(effectiveFeeCatalogs[group.id] || []).length} Staffeln</Text>
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
        <Stack gap="xs">
          <Group justify="space-between" align="flex-start" wrap="wrap">
            <Stack gap={2}>
              <Text fw={600} size="sm">Elternbeitragszuschuss / Rabatt</Text>
              <Text size="xs" c="dimmed">
                Vor Reform: {formatEuro(baselineParentFeeSubsidyAmount)} je berechtigtem Kind und Monat. Nach Gültigkeitsende ({parentFeeSubsidy.endDate || 'unbegrenzt'}) wird der Zuschuss mit 0 € angesetzt; höchstens bis zur Höhe des Beitrags.
              </Text>
            </Stack>
            <Text fw={700} size="sm" data-testid="parent-fee-subsidy-value">{formatEuro(simulatedParentFeeSubsidyAmount)} / Monat</Text>
          </Group>
          <Group align="center" gap="sm" wrap="wrap">
            <Box style={{ flex: '1 1 260px', minWidth: 200 }}>
              <Slider
                min={0}
                max={Math.max(300, Math.ceil(simulatedParentFeeSubsidyAmount / 100) * 100)}
                step={5}
                value={Math.min(simulatedParentFeeSubsidyAmount, Math.max(300, Math.ceil(simulatedParentFeeSubsidyAmount / 100) * 100))}
                onChange={setTemporaryParentFeeSubsidyAmount}
                aria-label="Simulierter Elternbeitragszuschuss pro Kind"
                thumbLabel="Simulierter Elternbeitragszuschuss pro Kind"
                data-testid="parent-fee-subsidy-slider"
              />
            </Box>
            <NumberInput
              size="xs"
              w={180}
              label="Rabatt / Kind / Monat"
              min={0}
              max={100000}
              decimalScale={2}
              step={5}
              value={simulatedParentFeeSubsidyAmount}
              onChange={(value) => {
                if (Number.isFinite(Number(value))) setTemporaryParentFeeSubsidyAmount(Math.max(0, Number(value)));
              }}
              data-testid="parent-fee-subsidy-input"
            />
            {temporaryParentFeeSubsidyAmount != null ? (
              <Button size="compact-xs" variant="subtle" onClick={() => setTemporaryParentFeeSubsidyAmount(null)} data-testid="reset-parent-fee-subsidy">
                Auf Modellwert zurücksetzen
              </Button>
            ) : <Badge variant="light">Modellwert</Badge>}
          </Group>
          <Text size="xs" c="dimmed">
            Angerechnet für Kinder ab {parentFeeSubsidy.minimumAgeYears ?? 3} bis vor das {parentFeeSubsidy.maximumAgeYears ?? 7}. Lebensjahr; Schulkindgruppen sind ausgeschlossen. Der Simulationswert bleibt lokal. Die Jahresansicht summiert die zwölf Monatsberechnungen und berücksichtigt das Gültigkeitsende.
          </Text>
        </Stack>
      </Paper>

      <Paper withBorder p="sm" radius="md">
        <Stack gap="xs">
          <Group justify="space-between" align="center" wrap="wrap">
            <Stack gap={2}>
              <Text fw={600} size="sm">Ausschöpfungsquote Mehrstunden</Text>
              <Text size="xs" c="dimmed">
                Anteil der passenden Buchungen, die bei gleichem Beitrag in die nächste ZEITKAT- oder Wochenstunden-Staffel wechseln.
              </Text>
            </Stack>
            <Text fw={700} size="sm" data-testid="utilization-value">{utilizationPercent} %</Text>
          </Group>
          <Slider
            min={0}
            max={100}
            step={5}
            value={utilizationPercent}
            onChange={setUtilizationPercent}
            marks={[{ value: 0, label: '0 %' }, { value: 50, label: '50 %' }, { value: 100, label: '100 %' }]}
            aria-label="Ausschöpfungsquote Mehrstunden"
            thumbLabel="Ausschöpfungsquote Mehrstunden"
            data-testid="utilization-slider"
          />
          <Text size="xs" c="dimmed">
            Beispiel: Bei 50 % wechseln rechnerisch die Hälfte der passenden Buchungen; Stunden und Förderwirkung werden soweit aus den Buchungszeiten berechenbar anteilig ermittelt.
          </Text>
        </Stack>
      </Paper>

      <SimpleGrid cols={{ base: 2, sm: 3, lg: 7 }} spacing="xs">
        {kpis.map((kpi) => (
          <Paper key={kpi.label} withBorder p="xs" radius="md" miw={130}>
            <Group gap={4} wrap="nowrap"><kpi.icon size={14} /><Text size="xs" c="dimmed">{kpi.label}</Text></Group>
            <Text fw={700}>{kpi.value}</Text>
          </Paper>
        ))}
      </SimpleGrid>

      {annualResult?.totals ? (
        <Paper withBorder p="sm" radius="md" data-testid="annual-contribution-impact">
          <Stack gap="sm">
            <div>
              <Text fw={600} size="sm">Jahreswirkung {annualResult.year} · Summe der zwölf Monatsberechnungen</Text>
              <Text size="xs" c="dimmed">Die Rechnung berücksichtigt gültige Staffeln, Buchungen, Förderregeln und den Wegfall des Elternbeitragszuschusses ab {parentFeeSubsidy.endDate ? `${parentFeeSubsidy.endDate} (danach)` : 'dem eingerichteten Gültigkeitsende'}.</Text>
            </div>
            <SimpleGrid cols={{ base: 2, md: 4 }} spacing="xs">
              {[
                ['Δ Förderung im Jahr', annualResult.totals.deltaYearlyBayKiBiG],
                ['Δ Elternanteil im Jahr', annualResult.totals.deltaYearlyParentFees],
                ['Δ Zuschuss im Jahr', annualResult.totals.deltaYearlyParentSubsidy],
                ['Δ Gesamteinnahmen im Jahr', annualResult.totals.deltaYearlyTotal],
              ].map(([label, value]) => (
                <Paper key={label} withBorder p="xs" radius="sm">
                  <Text size="xs" c="dimmed">{label}</Text>
                  <Text fw={700}>{formatEuro(value)}</Text>
                </Paper>
              ))}
            </SimpleGrid>
            <Text size="xs" c="dimmed">
              Betroffene Kinder: {annualResult.totals.affectedChildren} · Familien: {annualResult.totals.affectedFamilies} · durchschnittliche monatliche Eltern-Mehrbelastung: {formatEuro(annualResult.totals.monthlyParentCostIncrease / 12)}.
            </Text>
          </Stack>
        </Paper>
      ) : null}

      <Paper withBorder p="sm" radius="md" data-testid="reform-forecast-results">
        <Stack gap="sm">
          <div>
            <Text fw={600} size="sm">BayKiBiG-Reformrechnung · Jahreswerte</Text>
            <Text size="xs" c="dimmed">Formellogik der freigegebenen Berechnungsvorlage 2027; der Elternbeitragszuschuss wird separat ausgewiesen und nicht in das Reformergebnis addiert.</Text>
          </div>
          {!reformForecast.assumptions.hasActualBaseline ? (
            <Badge color="orange" variant="light" w="fit-content">Ist-Jahressummen 2026 fehlen noch. Trage sie unter Optionen → Finanzen → BayKiBiG-Rahmen ein, um belastbare Ergebnisse zu erhalten.</Badge>
          ) : null}
          <Paper withBorder radius="sm" style={{ overflowX: 'auto' }}>
            <Table highlightOnHover withTableBorder={false} miw={760} fz="xs">
              <Table.Thead><Table.Tr>
                <Table.Th>Jahr</Table.Th><Table.Th style={{ textAlign: 'right' }}>Kindbezogene Förderung</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Teamkräfte brutto</Table.Th><Table.Th style={{ textAlign: 'right' }}>Bisherige Richtlinienförderung</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Teamkräfte netto</Table.Th><Table.Th style={{ textAlign: 'right' }}>Reformergebnis</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Δ zum Vorjahr</Table.Th><Table.Th style={{ textAlign: 'right' }}>Zuschuss (durchlaufend)</Table.Th>
              </Table.Tr></Table.Thead>
              <Table.Tbody>
                {reformForecast.results.map((row) => (
                  <Table.Tr key={row.year}>
                    <Table.Td>{row.year}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>{formatEuro(row.components.childRelatedFunding)}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>{formatEuro(row.teamGrant)}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>−{formatEuro(row.priorGuidelineFunding)}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>{formatEuro(row.teamGrantNet)}</Table.Td>
                    <Table.Td style={{ textAlign: 'right', fontWeight: 700 }}>{formatEuro(row.result)}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>{row.changeFromPreviousYear == null ? '–' : formatEuro(row.changeFromPreviousYear)}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>{formatEuro(row.parentFeeSubsidyPassThrough)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
          <Alert color="gray" variant="light" title="Abstimmung mit dem kindbezogenen Capakita-Modell">
            2026 Ist nach Eingabe: {formatEuro(financeScenario.settings?.reformForecast?.actualFunding?.bookingTime || 0)} · Capakita-Modellhochrechnung aus aktiven Buchungen und den vorhandenen BayKiBiG-Regeln: {formatEuro(reformBaseline.capakitaModeledAnnualFunding)} · Differenz (Modell − Ist): {formatEuro(reformBaseline.capakitaModeledAnnualFunding - (Number(financeScenario.settings?.reformForecast?.actualFunding?.bookingTime) || 0))}. Die Differenz ist ein Abstimmungshinweis, keine Korrektur der eingegebenen KiBiG.web-Istsumme.
          </Alert>
          <Text size="xs" c="dimmed">
            Teamkräfte: {reformForecast.assumptions.approvedPlaces} genehmigte Plätze · {reformForecast.assumptions.teamGrantEligible ? 'Förderung aktiviert' : 'Förderung nicht aktiviert'}. Die Vorlage führt Jahresbeträge; 2027 ff. sind Prognosen nach den editierbaren Annahmen.
          </Text>
        </Stack>
      </Paper>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xs" data-testid="simulation-impact-summary">
        <Paper withBorder p="sm" radius="md" data-testid="simulation-more-hours-impact">
          <Group gap="xs" align="flex-start" wrap="nowrap">
            <IconUsers size={18} />
            <Stack gap={2}>
              <Text fw={600} size="sm">Zusätzliche Betreuungsstunden verfügbar</Text>
              <Text size="sm">+{formatHours(totals.weeklyHoursAdded)} pro Woche</Text>
              <Text size="xs" c="dimmed">Betrifft {formatAffectedCount(totals.childrenWithMoreHours, totals.familiesWithMoreHours)}</Text>
            </Stack>
          </Group>
        </Paper>
        <Paper withBorder p="sm" radius="md" data-testid="simulation-parent-cost-impact">
          <Group gap="xs" align="flex-start" wrap="nowrap">
            <IconCoins size={18} />
            <Stack gap={2}>
              <Text fw={600} size="sm">Zusätzliche Elternkosten</Text>
              <Text size="sm">+{formatEuro(totals.monthlyParentCostIncrease)} pro Monat</Text>
              <Text size="xs" c="dimmed">Betrifft {formatAffectedCount(totals.childrenWithHigherFees, totals.familiesWithHigherFees)} Nettoänderung Elternbeiträge: {formatEuro(totals.deltaParentFees)} / Monat.</Text>
              {totals.monthlyParentCostReduction > 0 ? (
                <Text size="xs" c="dimmed">Kosten sinken bei {formatAffectedCount(totals.childrenWithLowerFees, totals.familiesWithLowerFees)} insgesamt um {formatEuro(totals.monthlyParentCostReduction)} / Monat.</Text>
              ) : null}
            </Stack>
          </Group>
        </Paper>
      </SimpleGrid>

      <Tabs value={activeTab} onChange={(value) => setActiveTab(value || 'groups')}>
        <Tabs.List>
          <Tabs.Tab value="groups">Gruppen & Gesamt</Tabs.Tab>
          <Tabs.Tab value="children" leftSection={<IconUsers size={14} />}>Kinder ({totals.affectedChildren})</Tabs.Tab>
          <Tabs.Tab value="families" leftSection={<IconUsers size={14} />}>Familien ({totals.affectedFamilies})</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {activeTab === 'groups' ? (
        <Paper withBorder radius="md" style={{ overflow: 'auto' }}>
          <Group justify="flex-end" p="xs"><CopyTableButton tableRef={groupTableRef} testId="copy-simulation-groups" /></Group>
          <Table ref={groupTableRef} highlightOnHover verticalSpacing="xs" fz="xs" data-testid="simulation-group-results">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Gruppe</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Buchungen / Wechsel</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Buchungsstunden vorher → Simulation</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Δ Förderung / Monat</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Δ Elternanteil / Monat</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Δ Elternbeitragszuschuss / Monat</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Δ Gesamteinnahmen / Monat</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(result?.groups || []).map((group) => (
                <Table.Tr key={group.id || 'no-group'}>
                  <Table.Td>{group.name}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{group.bookings} / {group.migratedBookings}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{formatHours(group.bookingHoursBefore)} → {formatHours(group.bookingHoursAfter)}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{formatEuro(group.deltaMonthlyFunding)}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{formatEuro(group.deltaMonthlyParentFees)}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{formatEuro(group.deltaMonthlyParentSubsidy)}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{formatEuro(group.deltaMonthlyTotal)}</Table.Td>
                </Table.Tr>
              ))}
              <Table.Tr fw={700} data-testid="simulation-total-row">
                <Table.Td>Gesamt</Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>{(result?.groups || []).reduce((sum, group) => sum + group.bookings, 0)} / {totals.migratedBookings}</Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>{formatHours(totals.bookingHoursBefore)} → {formatHours(totals.bookingHoursAfter)}</Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>{formatEuro(totals.deltaMonthlyBayKiBiG)}</Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>{formatEuro(totals.deltaParentFees)}</Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>{formatEuro(totals.deltaParentFeeSubsidy)}</Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>{formatEuro(totals.deltaMonthlyTotal)}</Table.Td>
              </Table.Tr>
              {(result?.groups || []).length === 0 ? (
                <Table.Tr><Table.Td colSpan={7}><Text size="xs" c="dimmed">Keine aktiven Basisbuchungen mit auswertbarer ZEITKAT oder Wochenstunden gefunden.</Text></Table.Td></Table.Tr>
              ) : null}
            </Table.Tbody>
          </Table>
        </Paper>
      ) : null}

      {activeTab === 'children' ? (
        <Paper withBorder radius="md" style={{ overflow: 'auto' }}>
          <Group justify="flex-end" p="xs"><CopyTableButton tableRef={childTableRef} testId="copy-simulation-children" /></Group>
          <Table ref={childTableRef} highlightOnHover verticalSpacing="xs" fz="xs">
            <Table.Thead><Table.Tr>
              <Table.Th>Kind</Table.Th><Table.Th>Gruppe</Table.Th><Table.Th>ZEITKAT</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Δ Förderung / Monat</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Δ Elternanteil / Monat</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Δ Zuschuss / Monat</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Δ Gesamt / Monat</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Buchungsstunden vorher → Simulation</Table.Th><Table.Th />
            </Table.Tr></Table.Thead>
            <Table.Tbody>
              {(result?.perChild || []).map((row) => (
                <Table.Tr key={row.itemId} onClick={() => dispatch(setSelectedItem(row.itemId))} style={{ cursor: 'pointer' }} data-testid={`funding-child-${row.itemId}`}>
                  <Table.Td>{row.name}</Table.Td><Table.Td>{row.groupName || '–'}</Table.Td><Table.Td>{row.fromZone} → {row.toZone}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{formatEuro(row.deltaMonthly)}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{formatEuro(row.deltaMonthlyParentFees)}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{formatEuro(row.deltaMonthlyParentSubsidy)}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{formatEuro(row.deltaMonthlyTotal)}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{formatHours(row.weeklyHoursBefore)} → {formatHours(row.weeklyHoursAfter)}</Table.Td>
                  <Table.Td><IconArrowRight size={14} /></Table.Td>
                </Table.Tr>
              ))}
              {(result?.perChild || []).length === 0 ? <Table.Tr><Table.Td colSpan={9}><Text size="xs" c="dimmed">Keine betroffenen Kinder – Preise und/oder Ausschöpfungsquote unverändert.</Text></Table.Td></Table.Tr> : null}
            </Table.Tbody>
          </Table>
        </Paper>
      ) : null}

      {activeTab === 'families' ? (
        <Paper withBorder radius="md" style={{ overflow: 'auto' }}>
          <Group justify="flex-end" p="xs"><CopyTableButton tableRef={familyTableRef} testId="copy-simulation-families" /></Group>
          <Table ref={familyTableRef} highlightOnHover verticalSpacing="xs" fz="xs">
            <Table.Thead><Table.Tr>
              <Table.Th>Familie</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Betroffene Kinder</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Kinder mit Mehrstunden</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Zusatzstunden / Woche</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Kinder mit Mehrkosten</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Mehrkosten / Monat</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Δ Förderung / Monat</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Δ Elternanteil / Monat</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Δ Zuschuss / Monat</Table.Th>
            </Table.Tr></Table.Thead>
            <Table.Tbody>
              {(result?.families || []).map((family) => (
                <Table.Tr key={family.id}>
                  <Table.Td>{family.label}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{family.affectedChildren}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{family.childrenWithMoreHours}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>+{formatHours(family.weeklyHoursAdded)}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{family.childrenWithHigherFees}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{formatEuro(family.monthlyParentCostIncrease)}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{formatEuro(family.deltaMonthlyFunding)}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{formatEuro(family.deltaMonthlyParentFees)}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{formatEuro(family.deltaMonthlyParentSubsidy)}</Table.Td>
                </Table.Tr>
              ))}
              {(result?.families || []).length === 0 ? <Table.Tr><Table.Td colSpan={9}><Text size="xs" c="dimmed">Keine Familienzuordnung gefunden (erzber-Daten oder Haushalts-Fallback fehlen).</Text></Table.Td></Table.Tr> : null}
            </Table.Tbody>
          </Table>
        </Paper>
      ) : null}

      <Text size="xs" c="dimmed">
        Elternanteil = Bruttobeitrag abzüglich des anwendbaren Elternbeitragszuschusses (maximal bis zum Beitrag); der Zuschuss wird als eigene Einnahme ausgewiesen. Förderänderung = Basiswert × ZEITKAT-Faktor × Gewichtung (§ 21 BayKiBiG).
      </Text>
    </Stack>
  );
}

export default FundingSimulationPanel;
