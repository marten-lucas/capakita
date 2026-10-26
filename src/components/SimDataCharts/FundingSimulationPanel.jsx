import React from 'react';
import { Badge, Box, Group, NumberInput, Paper, Select, Slider, Stack, Tabs, Table, Text } from '@mantine/core';
import { IconArrowRight, IconCoins, IconUsers } from '@tabler/icons-react';
import { useDispatch, useSelector } from 'react-redux';
import { setSelectedItem } from '../../store/simScenarioSlice';
import { useOverlayData } from '../../hooks/useOverlayData';
import { filterBookings } from '../../utils/chartUtils/chartUtils';
import { simulateZeitkatUpgrade } from '../../utils/foerderSimulation';
import { ZEITKAT_CATALOG } from '../../utils/adebisConstants';

const formatEuro = (value) => `${Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

// Stabile Referenz für fehlende Szenario-Finanzen (useMemo-Dependencies)
const EMPTY_FINANCE = {};

const ZONE_OPTIONS = ZEITKAT_CATALOG.map((zone) => ({
  value: zone.id,
  label: `${zone.kurzbez} (Faktor ${String(zone.faktor).replace('.', ',')})`,
}));

/**
 * Förder-Simulation „Buchungsgruppen verändern" (Story-Step 06 Optionen-Check).
 *
 * Simuliert Zeitkat-Upgrades (nächsthöhere Zone / feste Zielzone / Mindeststunden)
 * mit optionalem Nutzungsgrad (Eltern nutzen die Zusatzstunden voll/anteilig) und
 * zeigt Förder-Delta, Elternbeitrags-Bandwechsel sowie die am stärksten betroffenen
 * Kinder und Familien (Sprung ins Kind-Detail per Klick).
 *
 * Formel-Basis (RE adebisKITA 7.5): Basiswert × Buchungszeitfaktor × Gewichtungsfaktor.
 */
function FundingSimulationPanel({ accent }) {
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector((state) => state.simScenario.selectedScenarioId);
  const financeByScenario = useSelector((state) => state.simFinance?.financeByScenario || {});
  const financeScenarioEntry = financeByScenario[String(selectedScenarioId)];
  const financeScenario = financeScenarioEntry || EMPTY_FINANCE;
  const referenceDate = useSelector((state) => state.chart?.referenceDate)
    || new Date().toISOString().slice(0, 10);

  const {
    getEffectiveDataItems,
    getEffectiveBookings,
    getEffectiveGroupDefs,
    getEffectiveGroupAssignments,
    getEffectiveQualificationAssignments,
  } = useOverlayData();

  const [mode, setMode] = React.useState('nextZone');
  const [targetZeitkat, setTargetZeitkat] = React.useState('07');
  const [minHours, setMinHours] = React.useState(6);
  const [utilizationPercent, setUtilizationPercent] = React.useState(100);
  const [activeTab, setActiveTab] = React.useState('children');

  const result = React.useMemo(() => {
    const dataItems = getEffectiveDataItems();
    const groupDefs = getEffectiveGroupDefs();

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

    return simulateZeitkatUpgrade({
      demandBookings: demand,
      dataItems,
      groupDefs,
      bayKiBiGRules: financeScenario?.bayKiBiGRules || [],
      groupFeeCatalogs: financeScenario?.groupFeeCatalogs || {},
      upgrade: { mode, targetZeitkat, minHours, utilizationPercent },
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
    mode,
    targetZeitkat,
    minHours,
    utilizationPercent,
  ]);

  const totals = result?.totals || { deltaMonthlyBayKiBiG: 0, deltaYearlyBayKiBiG: 0, deltaParentFees: 0, deltaWeeklyDemandHours: 0, affectedChildren: 0, affectedFamilies: 0 };
  const hasRule = Boolean(result?.rule && Number(result.rule.baseValue) > 0);

  const kpis = [
    { label: 'Δ Förderung / Monat', value: formatEuro(totals.deltaMonthlyBayKiBiG), icon: IconCoins },
    { label: 'Δ Förderung / Jahr', value: formatEuro(totals.deltaYearlyBayKiBiG), icon: IconCoins },
    { label: 'Δ Elternbeiträge / Monat', value: formatEuro(totals.deltaParentFees), icon: IconCoins },
    { label: 'Δ Wochenbedarfsstunden', value: `+${String(totals.deltaWeeklyDemandHours).replace('.', ',')}`, icon: IconUsers },
    { label: 'Betroffene Kinder', value: String(totals.affectedChildren), icon: IconUsers },
    { label: 'Betroffene Familien', value: String(totals.affectedFamilies), icon: IconUsers },
  ];

  return (
    <Stack gap="md" h="100%" p="md" style={{ overflow: 'auto' }} data-testid="funding-simulation-panel">
      <Stack gap={2}>
        <Text fw={700} size="sm" style={{ color: accent }}>Förder-Simulation: Buchungsgruppen anheben</Text>
        <Text size="xs" c="dimmed">
          Simuliert Zeitkat-Upgrades nach der RE-verifizierten Formel Basiswert × Buchungszeitfaktor
          × Gewichtungsfaktor (§ 21 BayKiBiG). Alternativ-/Ferienbuchungen bleiben unangetastet;
          Basisdaten werden nicht verändert.
        </Text>
        {!hasRule ? (
          <Badge color="orange" variant="light" w="fit-content">
            Keine Förderregel mit Basiswert hinterlegt (Einstellungen → Förderregel) – Deltas = 0.
          </Badge>
        ) : null}
      </Stack>

      <Paper withBorder p="sm" radius="md">
        <Group align="flex-end" gap="md" wrap="wrap">
          <Select
            size="xs"
            w={220}
            label="Upgrade-Modus"
            data={[
              { value: 'nextZone', label: 'Nächsthöhere Zone (+1)' },
              { value: 'targetZone', label: 'Feste Zielzone' },
              { value: 'minHours', label: 'Mindeststunden' },
            ]}
            value={mode}
            onChange={(value) => setMode(value || 'nextZone')}
            allowDeselect={false}
          />
          {mode === 'targetZone' ? (
            <Select
              size="xs"
              w={240}
              label="Zielzone"
              data={ZONE_OPTIONS}
              value={targetZeitkat}
              onChange={(value) => setTargetZeitkat(value || '07')}
              allowDeselect={false}
            />
          ) : null}
          {mode === 'minHours' ? (
            <NumberInput
              size="xs"
              w={160}
              label="Mindeststunden/Tag"
              min={1}
              max={13}
              step={0.5}
              value={minHours}
              onChange={(value) => setMinHours(Number.isFinite(Number(value)) ? Number(value) : 6)}
            />
          ) : null}
          <Box w={280} pb={4}>
            <Text size="xs" fw={500} mb={4}>Nutzungsgrad der Eltern: {utilizationPercent} %</Text>
            <Slider
              size="sm"
              min={0}
              max={100}
              step={5}
              value={utilizationPercent}
              onChange={setUtilizationPercent}
              marks={[
                { value: 0, label: '0 %' },
                { value: 50, label: '50 %' },
                { value: 100, label: '100 %' },
              ]}
              aria-label="Nutzungsgrad der Eltern"
            />
            <Text size="xs" c="dimmed" mt={4}>
              Wirkt auf Bedarfsstunden; die Förderung ist anspruchsbasiert und unabhängig davon.
            </Text>
          </Box>
        </Group>
      </Paper>

      <Group gap="xs" wrap="wrap">
        {kpis.map((kpi) => (
          <Paper key={kpi.label} withBorder p="xs" radius="md" miw={150}>
            <Text size="xs" c="dimmed">{kpi.label}</Text>
            <Text fw={700}>{kpi.value}</Text>
          </Paper>
        ))}
      </Group>

      <Tabs value={activeTab} onChange={(value) => setActiveTab(value || 'children')}>
        <Tabs.List>
          <Tabs.Tab value="children" leftSection={<IconUsers size={14} />}>Kinder ({totals.affectedChildren})</Tabs.Tab>
          <Tabs.Tab value="families" leftSection={<IconUsers size={14} />}>Familien ({totals.affectedFamilies})</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {activeTab === 'children' ? (
        <Paper withBorder radius="md" style={{ overflow: 'auto' }}>
          <Table highlightOnHover verticalSpacing="xs" fz="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Kind</Table.Th>
                <Table.Th>Gruppe</Table.Th>
                <Table.Th>Zone</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Δ Förder €/Monat</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Δ €/Jahr</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Δ Wochenstunden</Table.Th>
                <Table.Th>Elternbeitrag</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(result?.perChild || []).map((row) => (
                <Table.Tr
                  key={row.itemId}
                  onClick={() => dispatch(setSelectedItem(row.itemId))}
                  style={{ cursor: 'pointer' }}
                  data-testid={`funding-child-${row.itemId}`}
                >
                  <Table.Td>{row.name}</Table.Td>
                  <Table.Td>{row.groupName || '–'}</Table.Td>
                  <Table.Td>{row.fromZone} → {row.toZone}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{formatEuro(row.deltaMonthly)}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{formatEuro(row.deltaYearly)}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    +{String(row.deltaWeeklyHours).replace('.', ',')} h
                  </Table.Td>
                  <Table.Td>
                    {row.feeBandChange
                      ? <Badge size="xs" color="orange" variant="light">Bandwechsel</Badge>
                      : <Text size="xs" c="dimmed">unverändert</Text>}
                  </Table.Td>
                  <Table.Td><IconArrowRight size={14} /></Table.Td>
                </Table.Tr>
              ))}
              {(result?.perChild || []).length === 0 ? (
                <Table.Tr><Table.Td colSpan={8}><Text size="xs" c="dimmed">Keine betroffenen Kinder – Zonen bereits am Ziel oder keine Basisbuchungen.</Text></Table.Td></Table.Tr>
              ) : null}
            </Table.Tbody>
          </Table>
        </Paper>
      ) : (
        <Paper withBorder radius="md" style={{ overflow: 'auto' }}>
          <Table highlightOnHover verticalSpacing="xs" fz="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Familie</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Betroffene Kinder</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Δ Förder €/Monat</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Δ €/Jahr</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Δ Wochenstunden</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(result?.families || []).map((family) => (
                <Table.Tr key={family.id}>
                  <Table.Td>{family.label}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{family.affectedChildren}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{formatEuro(family.deltaMonthly)}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>{formatEuro(family.deltaYearly)}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    +{String(family.deltaWeeklyHours).replace('.', ',')} h
                  </Table.Td>
                </Table.Tr>
              ))}
              {(result?.families || []).length === 0 ? (
                <Table.Tr><Table.Td colSpan={5}><Text size="xs" c="dimmed">Keine Familienzuordnung (erzber.xml/adressen.xml in den Export aufnehmen oder Haushalts-Fallback nutzen).</Text></Table.Td></Table.Tr>
              ) : null}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      <Text size="xs" c="dimmed">
        Hinweis: Die bestehenden Finanz-KPIs (Story-Step 04) berücksichtigen den Buchungszeitfaktor
        erst nach Aktivierung (aktuell bewusst aus, Entscheidung 26.10.2026). Die Deltas hier sind
        davon unabhängig korrekt.
      </Text>
    </Stack>
  );
}

export default FundingSimulationPanel;
