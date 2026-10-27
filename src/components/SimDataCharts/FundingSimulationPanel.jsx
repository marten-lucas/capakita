import React from 'react';
import { Badge, Button, Group, NumberInput, Paper, Slider, Stack, Table, Tabs, Text, SimpleGrid } from '@mantine/core';
import { IconArrowRight, IconCoins, IconUsers } from '@tabler/icons-react';
import { useDispatch, useSelector } from 'react-redux';
import { setSelectedItem } from '../../store/simScenarioSlice';
import { useOverlayData } from '../../hooks/useOverlayData';
import { filterBookings } from '../../utils/chartUtils/chartUtils';
import { simulateContributionChanges } from '../../utils/foerderSimulation';
import { calculateZeitkatFeeAmount } from '../../utils/financeUtils';
import { ZEITKAT_CATALOG } from '../../utils/adebisConstants';
import { CopyTableButton } from '../common/CopyToClipboardButton';

const formatEuro = (value) => `${Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const formatHours = (value) => `${Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} h`;
const formatAffectedCount = (children, families) => (
  `${children} ${children === 1 ? 'Kind' : 'Kinder'} in ${families} ${families === 1 ? 'Familie' : 'Familien'}.`
);
const EMPTY_FINANCE = {};
const EMPTY_GROUP_FEE_CATALOGS = {};
const EMPTY_TEMPORARY_PRICES = {};

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
  const [temporaryPrices, setTemporaryPrices] = React.useState(EMPTY_TEMPORARY_PRICES);
  const [activeTab, setActiveTab] = React.useState('groups');
  const groupTableRef = React.useRef(null);
  const childTableRef = React.useRef(null);
  const familyTableRef = React.useRef(null);

  React.useEffect(() => {
    setTemporaryPrices(EMPTY_TEMPORARY_PRICES);
  }, [selectedScenarioId]);

  const groupFeeCatalogs = financeScenario?.groupFeeCatalogs || EMPTY_GROUP_FEE_CATALOGS;
  const groupDefs = getEffectiveGroupDefs();
  const groupLabels = React.useMemo(() => new Map(
    (groupDefs || []).map((group) => [String(group.id), group.name || String(group.id)])
  ), [groupDefs]);

  const categoryPriceRows = React.useMemo(() => Object.entries(groupFeeCatalogs).flatMap(([groupId, catalog]) => (
    ZEITKAT_CATALOG.flatMap((zone) => {
      const { entry, baseAmount } = calculateZeitkatFeeAmount(catalog, zone.id, referenceDate);
      return entry ? [{
        groupId: String(groupId),
        groupName: groupLabels.get(String(groupId)) || String(groupId),
        zone,
        originalAmount: baseAmount,
      }] : [];
    })
  )), [groupFeeCatalogs, groupLabels, referenceDate]);

  const getTemporaryPrice = (groupId, zeitkatId, originalAmount) => {
    const value = temporaryPrices?.[groupId]?.[zeitkatId];
    return Number.isFinite(Number(value)) ? Number(value) : originalAmount;
  };
  const setTemporaryPrice = (groupId, zeitkatId, value) => {
    if (!Number.isFinite(Number(value))) return;
    setTemporaryPrices((current) => ({
      ...current,
      [groupId]: { ...(current[groupId] || {}), [zeitkatId]: Math.max(0, Number(value)) },
    }));
  };
  const resetTemporaryPrice = (groupId, zeitkatId) => {
    setTemporaryPrices((current) => {
      const next = { ...current, [groupId]: { ...(current[groupId] || {}) } };
      delete next[groupId][zeitkatId];
      if (Object.keys(next[groupId]).length === 0) delete next[groupId];
      return next;
    });
  };

  const result = React.useMemo(() => {
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

    return simulateContributionChanges({
      demandBookings: demand,
      dataItems,
      groupDefs: effectiveGroupDefs,
      bayKiBiGRules: financeScenario?.bayKiBiGRules || [],
      groupFeeCatalogs,
      temporaryPrices,
      utilizationPercent,
      referenceDate,
    });
  }, [
    getEffectiveDataItems,
    getEffectiveBookings,
    getEffectiveGroupDefs,
    getEffectiveGroupAssignments,
    getEffectiveQualificationAssignments,
    selectedScenarioId,
    referenceDate,
    financeScenario,
    groupFeeCatalogs,
    temporaryPrices,
    utilizationPercent,
  ]);

  const totals = result?.totals || {
    bookingHoursBefore: 0,
    bookingHoursAfter: 0,
    deltaMonthlyBayKiBiG: 0,
    deltaParentFees: 0,
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
  const hasZeitkatRates = categoryPriceRows.length > 0;

  const kpis = [
    { label: 'Buchungsstunden vorher', value: formatHours(totals.bookingHoursBefore), icon: IconUsers },
    { label: 'Buchungsstunden Simulation', value: formatHours(totals.bookingHoursAfter), icon: IconUsers },
    { label: 'Δ Förderung / Monat', value: formatEuro(totals.deltaMonthlyBayKiBiG), icon: IconCoins },
    { label: 'Δ Elternbeiträge / Monat', value: formatEuro(totals.deltaParentFees), icon: IconCoins },
    { label: 'Δ Gesamteinnahmen / Monat', value: formatEuro(totals.deltaMonthlyTotal), icon: IconCoins },
    { label: 'Δ Gesamteinnahmen / Jahr', value: formatEuro(totals.deltaYearlyTotal), icon: IconCoins },
  ];

  return (
    <Stack gap="md" h="100%" p="md" style={{ overflow: 'auto' }} data-testid="funding-simulation-panel">
      <Stack gap={2}>
        <Text fw={700} size="sm" style={{ color: accent }}>Simulation von Beitragsänderungen</Text>
        <Text size="xs" c="dimmed">
          Simuliert neue absolute Elternbeiträge je ZEITKAT. Bei gleichem Preis zweier direkt aufeinanderfolgender Staffeln
          wechselt der eingestellte Anteil der Buchungen in die höhere Stundenkategorie. Änderungen gelten nur hier und werden nicht gespeichert.
        </Text>
        {!hasRule ? (
          <Badge color="orange" variant="light" w="fit-content">
            Keine Förderregel mit Basiswert hinterlegt (Einstellungen → Förderregel) – Förderänderungen = 0.
          </Badge>
        ) : null}
        {!hasZeitkatRates ? (
          <Badge color="orange" variant="light" w="fit-content">
            Keine ZEITKAT-Beitragsstaffeln geladen. Bitte zuerst Beitragsstaffeln aus den Optionen importieren.
          </Badge>
        ) : null}
      </Stack>

      <Paper withBorder p="sm" radius="md">
        <Stack gap="xs">
          <Group justify="space-between" align="center" wrap="wrap">
            <Stack gap={2}>
              <Text fw={600} size="sm">Ausschöpfungsquote Mehrstunden</Text>
              <Text size="xs" c="dimmed">
                Anteil der Buchungen, die bei gleichem Beitrag in die direkt höhere ZEITKAT-Staffel wechseln.
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
            Beispiel: Bei 50 % wechseln rechnerisch die Hälfte der passenden Buchungen; Buchungsstunden und Förderwirkung werden anteilig berechnet.
          </Text>
        </Stack>
      </Paper>

      <Paper withBorder p="sm" radius="md" data-testid="temporary-category-prices">
        <Stack gap="sm">
          <Group justify="space-between" align="center" wrap="wrap">
            <Stack gap={2}>
              <Text fw={600} size="sm">Beitragsstaffeln aus den Optionen</Text>
              <Text size="xs" c="dimmed">Ausgangswert bleibt sichtbar. Simulationspreise sind absolute Eurobeträge und bleiben lokal/temporär.</Text>
            </Stack>
            {categoryPriceRows.length > 0 ? (
              <Button size="xs" variant="subtle" onClick={() => setTemporaryPrices(EMPTY_TEMPORARY_PRICES)} data-testid="reset-all-temporary-prices">
                Alle auf Ausgangswerte zurücksetzen
              </Button>
            ) : null}
          </Group>
          {categoryPriceRows.length > 0 ? (
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
              {categoryPriceRows.map(({ groupId, groupName, zone, originalAmount }) => {
                const value = getTemporaryPrice(groupId, zone.id, originalAmount);
                const sliderMax = Math.max(500, Math.ceil(Math.max(originalAmount, value) / 100) * 100);
                return (
                  <Paper key={`${groupId}-${zone.id}`} withBorder p="xs" radius="sm" data-testid={`tariff-${groupId}-${zone.id}`}>
                    <Stack gap={5}>
                      <Group justify="space-between" align="flex-start" wrap="nowrap">
                        <Stack gap={1}>
                          <Text size="sm" fw={600}>{groupName} · ZEITKAT {zone.id} ({zone.kurzbez})</Text>
                          <Text size="xs" c="dimmed">Ausgangswert: {formatEuro(originalAmount)}</Text>
                        </Stack>
                        {value !== originalAmount ? (
                          <Button size="compact-xs" variant="subtle" onClick={() => resetTemporaryPrice(groupId, zone.id)}>
                            Zurücksetzen
                          </Button>
                        ) : <Badge variant="light">unverändert</Badge>}
                      </Group>
                      <NumberInput
                        size="xs"
                        label="Simulationspreis / Monat"
                        min={0}
                        max={100000}
                        decimalScale={2}
                        step={5}
                        value={value}
                        onChange={(nextValue) => setTemporaryPrice(groupId, zone.id, nextValue)}
                        data-testid={`tariff-input-${groupId}-${zone.id}`}
                      />
                      <Slider
                        min={0}
                        max={sliderMax}
                        step={5}
                        value={Math.min(value, sliderMax)}
                        onChange={(nextValue) => setTemporaryPrice(groupId, zone.id, nextValue)}
                        aria-label={`Simulationspreis ${groupName} ZEITKAT ${zone.id}`}
                        thumbLabel={`Simulationspreis ${groupName} ZEITKAT ${zone.id}`}
                        data-testid={`tariff-slider-${groupId}-${zone.id}`}
                      />
                    </Stack>
                  </Paper>
                );
              })}
            </SimpleGrid>
          ) : (
            <Text size="xs" c="dimmed">Es gibt für den ausgewählten Stichtag keine ZEITKAT-gebundenen Beitragssätze.</Text>
          )}
        </Stack>
      </Paper>

      <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }} spacing="xs">
        {kpis.map((kpi) => (
          <Paper key={kpi.label} withBorder p="xs" radius="md" miw={130}>
            <Group gap={4} wrap="nowrap"><kpi.icon size={14} /><Text size="xs" c="dimmed">{kpi.label}</Text></Group>
            <Text fw={700}>{kpi.value}</Text>
          </Paper>
        ))}
      </SimpleGrid>

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
                <Table.Th style={{ textAlign: 'right' }}>Δ Elternbeiträge / Monat</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Δ Gesamteinnahmen / Monat</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Δ Gesamteinnahmen / Jahr</Table.Th>
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
                  <Table.Td style={{ textAlign: 'right' }}>{formatEuro(group.deltaMonthlyTotal)}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{formatEuro(group.deltaYearlyTotal)}</Table.Td>
                </Table.Tr>
              ))}
              <Table.Tr fw={700} data-testid="simulation-total-row">
                <Table.Td>Gesamt</Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>{(result?.groups || []).reduce((sum, group) => sum + group.bookings, 0)} / {totals.migratedBookings}</Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>{formatHours(totals.bookingHoursBefore)} → {formatHours(totals.bookingHoursAfter)}</Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>{formatEuro(totals.deltaMonthlyBayKiBiG)}</Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>{formatEuro(totals.deltaParentFees)}</Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>{formatEuro(totals.deltaMonthlyTotal)}</Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>{formatEuro(totals.deltaYearlyTotal)}</Table.Td>
              </Table.Tr>
              {(result?.groups || []).length === 0 ? (
                <Table.Tr><Table.Td colSpan={7}><Text size="xs" c="dimmed">Keine aktiven Basisbuchungen mit auswertbarer ZEITKAT gefunden.</Text></Table.Td></Table.Tr>
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
              <Table.Th style={{ textAlign: 'right' }}>Δ Elternbeitrag / Monat</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Δ Gesamt / Monat</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Buchungsstunden vorher → Simulation</Table.Th><Table.Th />
            </Table.Tr></Table.Thead>
            <Table.Tbody>
              {(result?.perChild || []).map((row) => (
                <Table.Tr key={row.itemId} onClick={() => dispatch(setSelectedItem(row.itemId))} style={{ cursor: 'pointer' }} data-testid={`funding-child-${row.itemId}`}>
                  <Table.Td>{row.name}</Table.Td><Table.Td>{row.groupName || '–'}</Table.Td><Table.Td>{row.fromZone} → {row.toZone}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{formatEuro(row.deltaMonthly)}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{formatEuro(row.deltaMonthlyParentFees)}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{formatEuro(row.deltaMonthlyTotal)}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{formatHours(row.weeklyHoursBefore)} → {formatHours(row.weeklyHoursAfter)}</Table.Td>
                  <Table.Td><IconArrowRight size={14} /></Table.Td>
                </Table.Tr>
              ))}
              {(result?.perChild || []).length === 0 ? <Table.Tr><Table.Td colSpan={8}><Text size="xs" c="dimmed">Keine betroffenen Kinder – Preise und/oder Ausschöpfungsquote unverändert.</Text></Table.Td></Table.Tr> : null}
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
              <Table.Th style={{ textAlign: 'right' }}>Δ Elternbeiträge / Monat</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Δ Gesamteinnahmen / Jahr</Table.Th>
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
                  <Table.Td style={{ textAlign: 'right' }}>{formatEuro(family.deltaYearlyTotal)}</Table.Td>
                </Table.Tr>
              ))}
              {(result?.families || []).length === 0 ? <Table.Tr><Table.Td colSpan={9}><Text size="xs" c="dimmed">Keine Familienzuordnung gefunden (erzber-Daten oder Haushalts-Fallback fehlen).</Text></Table.Td></Table.Tr> : null}
            </Table.Tbody>
          </Table>
        </Paper>
      ) : null}

      <Text size="xs" c="dimmed">
        Förderänderung = Basiswert × ZEITKAT-Faktor × Gewichtung (§ 21 BayKiBiG). Elternbeiträge werden je Kind anhand der aktuellen ZEITKAT-Staffel ausgewertet; eine Wechselquote wird nur bei identischem Simulationspreis benachbarter Staffeln angewendet.
      </Text>
    </Stack>
  );
}

export default FundingSimulationPanel;
