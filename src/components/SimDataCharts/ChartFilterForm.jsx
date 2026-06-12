import React from 'react';
import { Drawer, Stack, Text, Group, MultiSelect, Select, Button, Box, ActionIcon, NumberInput, Switch } from '@mantine/core';
import { IconAdjustmentsHorizontal } from '@tabler/icons-react';
import { useSelector, useDispatch } from 'react-redux';
import {
  setTimedimension,
  setFilterGroups,
  setFilterQualifications,
  ensureScenario,
} from '../../store/chartSlice';
import { useOverlayData } from '../../hooks/useOverlayData';
import EventPicker from '../EventCalendar/EventPicker';

const EMPTY_SELECTION = [];

function ChartFilterForm({
  showStichtag = false,
  scenarioId,
  onTimedimensionChange,
  groupsOnly = false,
  showHeatmapModeControl = false,
  heatmapMode = 'unweightedQuotient',
  onHeatmapModeChange,
  showPlannedStaffOnlyControl = false,
  plannedStaffOnly = false,
  onPlannedStaffOnlyChange,
  showMonteCarloControls = false,
  monteCarloParams = null,
  onMonteCarloParamsChange,
  onRerunMonteCarlo,
  isMonteCarloRunning = false,
  drawerOpened = false,
  onDrawerClose = null,
  showTrigger = false,
}) {
  const dispatch = useDispatch();
  const [internalOpen, setInternalOpen] = React.useState(false);

  const isDrawerOpen = showTrigger ? internalOpen : drawerOpened;
  const handleClose = showTrigger ? () => setInternalOpen(false) : (onDrawerClose ?? (() => {}));

  React.useEffect(() => {
    if (scenarioId) {
      dispatch(ensureScenario(scenarioId));
    }
  }, [dispatch, scenarioId]);

  const chartState = useSelector((state) => state.chart[scenarioId] ?? null);

  const timedimension = React.useMemo(() => chartState?.timedimension || 'month', [chartState?.timedimension]);
  const selectedGroups = React.useMemo(() => chartState?.filter?.Groups || EMPTY_SELECTION, [chartState?.filter?.Groups]);
  const selectedQualifications = React.useMemo(
    () => chartState?.filter?.Qualifications || EMPTY_SELECTION,
    [chartState?.filter?.Qualifications]
  );

  const { getEffectiveGroupDefs, getEffectiveQualificationDefs } = useOverlayData();
  const groupDefs = getEffectiveGroupDefs();
  const qualificationDefs = getEffectiveQualificationDefs();

  const groupOptions = React.useMemo(
    () => [
      ...groupDefs.map((group) => ({ value: String(group.id), label: group.name || 'Gruppe' })),
      { value: '__NO_GROUP__', label: 'Keine Gruppenzuweisung' },
    ],
    [groupDefs]
  );

  const qualificationOptions = React.useMemo(
    () => [
      ...qualificationDefs.map((qualification) => ({
        value: qualification.key,
        label: qualification.name || qualification.initial || qualification.key,
      })),
      { value: '__NO_QUALI__', label: 'Keine Qualifikation' },
    ],
    [qualificationDefs]
  );

  React.useEffect(() => {
    if (scenarioId && selectedGroups.length === 0 && groupOptions.length > 0) {
      dispatch(setFilterGroups({ scenarioId, groups: groupOptions.map((option) => option.value) }));
    }
  }, [dispatch, scenarioId, selectedGroups.length, groupOptions]);

  React.useEffect(() => {
    if (groupsOnly) return;
    if (scenarioId && selectedQualifications.length === 0 && qualificationOptions.length > 0) {
      dispatch(
        setFilterQualifications({
          scenarioId,
          qualifications: qualificationOptions.map((option) => option.value),
        })
      );
    }
  }, [dispatch, scenarioId, selectedQualifications.length, qualificationOptions, groupsOnly]);

  return (
    <>
      {showTrigger && (
        <ActionIcon
          variant="light"
          size="md"
          aria-label="Filter öffnen"
          data-testid="analysis-filter-toggle"
          onClick={() => setInternalOpen(true)}
        >
          <IconAdjustmentsHorizontal size={16} />
        </ActionIcon>
      )}

      <Drawer
        opened={isDrawerOpen}
        onClose={handleClose}
        title="Kontextfilter"
        position="right"
        size="sm"
        padding="md"
      >
        <Stack gap="md">
          <Group align="flex-start" wrap="wrap">
            <MultiSelect
              label="Gruppen"
              data={groupOptions}
              value={selectedGroups}
              onChange={(value) => dispatch(setFilterGroups({ scenarioId, groups: value }))}
              searchable
              clearable
              w="100%"
            />

            {!groupsOnly && (
              <MultiSelect
                label="Qualifikationen"
                data={qualificationOptions}
                value={selectedQualifications}
                onChange={(value) => dispatch(setFilterQualifications({ scenarioId, qualifications: value }))}
                searchable
                clearable
                w="100%"
              />
            )}

            {!groupsOnly && (
              <Select
                label="Zeitdimension"
                data={[
                  { value: 'week', label: 'Woche' },
                  { value: 'month', label: 'Monat' },
                  { value: 'quarter', label: 'Quartal' },
                  { value: 'year', label: 'Jahr' },
                ]}
                value={timedimension}
                onChange={(value) => {
                  if (!value) return;
                  dispatch(setTimedimension({ scenarioId, timedimension: value }));
                  onTimedimensionChange?.(value);
                }}
                w="100%"
              />
            )}

            {showHeatmapModeControl && (
              <Select
                label="Heatmap-Berechnung"
                data={[
                  { value: 'unweightedQuotient', label: 'Ungewichteter Quotient (Kinder / päd. MA)' },
                  { value: 'careKey', label: 'Betreuungsschlüssel' },
                  { value: 'presentStaff', label: 'Anwesende Mitarbeiter (pädagogisch)' },
                ]}
                value={heatmapMode}
                onChange={(value) => {
                  if (!value) return;
                  onHeatmapModeChange?.(value);
                }}
                w="100%"
              />
            )}

            {showPlannedStaffOnlyControl && (
              <Switch
                label="Nur geplante Mitarbeiter anzeigen"
                checked={Boolean(plannedStaffOnly)}
                onChange={(event) => onPlannedStaffOnlyChange?.(event.currentTarget.checked)}
              />
            )}
          </Group>

          {showStichtag && <EventPicker scenarioId={scenarioId} />}

          {showMonteCarloControls && monteCarloParams && (
            <Stack gap="xs" data-testid="analysis-monte-carlo-controls">
              <Text fw={600} size="sm">Monte-Carlo</Text>
              <NumberInput
                label="Läufe"
                value={monteCarloParams.runs}
                min={100}
                max={10000}
                step={100}
                onChange={(value) => {
                  const nextValue = Number(value);
                  if (!Number.isFinite(nextValue)) return;
                  onMonteCarloParamsChange?.({
                    ...monteCarloParams,
                    runs: Math.max(100, Math.min(10000, Math.round(nextValue))),
                  });
                }}
              />
              <NumberInput
                label="Basis-Ausfallwahrscheinlichkeit (%)"
                value={monteCarloParams.baseAbsenceProbabilityPct}
                min={1}
                max={80}
                step={1}
                onChange={(value) => {
                  const nextValue = Number(value);
                  if (!Number.isFinite(nextValue)) return;
                  onMonteCarloParamsChange?.({
                    ...monteCarloParams,
                    baseAbsenceProbabilityPct: Math.max(1, Math.min(80, Math.round(nextValue))),
                  });
                }}
              />
              <NumberInput
                label="Simulationswochen"
                value={monteCarloParams.simulationWeeks}
                min={4}
                max={52}
                step={1}
                onChange={(value) => {
                  const nextValue = Number(value);
                  if (!Number.isFinite(nextValue)) return;
                  onMonteCarloParamsChange?.({
                    ...monteCarloParams,
                    simulationWeeks: Math.max(4, Math.min(52, Math.round(nextValue))),
                  });
                }}
              />
              <NumberInput
                label="Max. gleichz. Ausfälle"
                value={monteCarloParams.maxConcurrentOutages}
                min={1}
                max={12}
                step={1}
                onChange={(value) => {
                  const nextValue = Number(value);
                  if (!Number.isFinite(nextValue)) return;
                  onMonteCarloParamsChange?.({
                    ...monteCarloParams,
                    maxConcurrentOutages: Math.max(1, Math.min(12, Math.round(nextValue))),
                  });
                }}
              />
              <Text fw={600} size="sm" mt={4}>Hard Constraints</Text>
              <NumberInput
                label="Mindest-Fachkräftequote (%)"
                value={monteCarloParams.minExpertRatioPct}
                min={0}
                max={100}
                step={1}
                onChange={(value) => {
                  const nextValue = Number(value);
                  if (!Number.isFinite(nextValue)) return;
                  onMonteCarloParamsChange?.({
                    ...monteCarloParams,
                    minExpertRatioPct: Math.max(0, Math.min(100, Math.round(nextValue))),
                  });
                }}
              />
              <NumberInput
                label="Max. Betreuungsschlüssel"
                value={monteCarloParams.maxCareRatio}
                min={1}
                max={30}
                step={0.5}
                decimalScale={1}
                onChange={(value) => {
                  const nextValue = Number(value);
                  if (!Number.isFinite(nextValue)) return;
                  onMonteCarloParamsChange?.({
                    ...monteCarloParams,
                    maxCareRatio: Math.max(1, Math.min(30, nextValue)),
                  });
                }}
              />
              <NumberInput
                label="Mindestbesetzung pro Gruppe (Köpfe)"
                value={monteCarloParams.minGroupHeadcount}
                min={0}
                max={10}
                step={0.5}
                decimalScale={1}
                onChange={(value) => {
                  const nextValue = Number(value);
                  if (!Number.isFinite(nextValue)) return;
                  onMonteCarloParamsChange?.({
                    ...monteCarloParams,
                    minGroupHeadcount: Math.max(0, Math.min(10, nextValue)),
                  });
                }}
              />
              {groupDefs.length > 0 && (
                <Stack gap={6}>
                  <Text size="xs" c="dimmed">
                    Individuelle Mindestbesetzung je Gruppe (überschreibt den globalen Wert)
                  </Text>
                  {groupDefs.map((group) => {
                    const groupId = String(group.id);
                    const configuredValue = Number(monteCarloParams?.minGroupHeadcountByGroup?.[groupId]);
                    const fallbackValue = Number(monteCarloParams?.minGroupHeadcount || 0);
                    const currentValue = Number.isFinite(configuredValue) ? configuredValue : fallbackValue;

                    return (
                      <NumberInput
                        key={`mc-min-headcount-${groupId}`}
                        label={`Min. Köpfe: ${group.name || groupId}`}
                        value={currentValue}
                        min={0}
                        max={10}
                        step={0.5}
                        decimalScale={1}
                        onChange={(value) => {
                          const nextValue = Number(value);
                          if (!Number.isFinite(nextValue)) return;
                          onMonteCarloParamsChange?.({
                            ...monteCarloParams,
                            minGroupHeadcountByGroup: {
                              ...(monteCarloParams?.minGroupHeadcountByGroup || {}),
                              [groupId]: Math.max(0, Math.min(10, nextValue)),
                            },
                          });
                        }}
                      />
                    );
                  })}
                </Stack>
              )}
              <NumberInput
                label="Max. tolerierte Unterdeckung (Slots/Woche)"
                value={monteCarloParams.maxUndercoverageSlots}
                min={0}
                max={200}
                step={1}
                onChange={(value) => {
                  const nextValue = Number(value);
                  if (!Number.isFinite(nextValue)) return;
                  onMonteCarloParamsChange?.({
                    ...monteCarloParams,
                    maxUndercoverageSlots: Math.max(0, Math.min(200, Math.round(nextValue))),
                  });
                }}
              />

              <Text fw={600} size="sm" mt={4}>Kompensations-Kaskade</Text>
              <NumberInput
                label="Max. Mehrstunden pro Mitarbeiter/Woche"
                value={monteCarloParams.maxOvertimeHoursPerEmployeePerWeek}
                min={0}
                max={20}
                step={0.5}
                decimalScale={1}
                onChange={(value) => {
                  const nextValue = Number(value);
                  if (!Number.isFinite(nextValue)) return;
                  onMonteCarloParamsChange?.({
                    ...monteCarloParams,
                    maxOvertimeHoursPerEmployeePerWeek: Math.max(0, Math.min(20, nextValue)),
                  });
                }}
              />
              <NumberInput
                label="Max. Zeiteinschränkung (Std./Woche)"
                value={monteCarloParams.maxTimeReductionHoursPerWeek}
                min={0}
                max={20}
                step={0.5}
                decimalScale={1}
                onChange={(value) => {
                  const nextValue = Number(value);
                  if (!Number.isFinite(nextValue)) return;
                  onMonteCarloParamsChange?.({
                    ...monteCarloParams,
                    maxTimeReductionHoursPerWeek: Math.max(0, Math.min(20, nextValue)),
                  });
                }}
              />
              <NumberInput
                label="Notbetreuung Nachfrage-Reduktion (%)"
                value={monteCarloParams.emergencyDemandReductionPct}
                min={0}
                max={80}
                step={1}
                onChange={(value) => {
                  const nextValue = Number(value);
                  if (!Number.isFinite(nextValue)) return;
                  onMonteCarloParamsChange?.({
                    ...monteCarloParams,
                    emergencyDemandReductionPct: Math.max(0, Math.min(80, Math.round(nextValue))),
                  });
                }}
              />

              <Text fw={600} size="sm" mt={4}>Dynamiken</Text>
              <Switch
                label="Saisonalität aktiv"
                checked={Boolean(monteCarloParams.seasonalityEnabled)}
                onChange={(event) => onMonteCarloParamsChange?.({
                  ...monteCarloParams,
                  seasonalityEnabled: event.currentTarget.checked,
                })}
              />
              <Switch
                label="Ansteckungseffekt aktiv"
                checked={Boolean(monteCarloParams.contagionEnabled)}
                onChange={(event) => onMonteCarloParamsChange?.({
                  ...monteCarloParams,
                  contagionEnabled: event.currentTarget.checked,
                })}
              />
              <NumberInput
                label="Ansteckungsschub (%)"
                value={monteCarloParams.contagionBoostPct}
                min={0}
                max={200}
                step={5}
                onChange={(value) => {
                  const nextValue = Number(value);
                  if (!Number.isFinite(nextValue)) return;
                  onMonteCarloParamsChange?.({
                    ...monteCarloParams,
                    contagionBoostPct: Math.max(0, Math.min(200, Math.round(nextValue))),
                  });
                }}
              />
              <NumberInput
                label="Ansteckungsdauer (Tage)"
                value={monteCarloParams.contagionDays}
                min={0}
                max={14}
                step={1}
                onChange={(value) => {
                  const nextValue = Number(value);
                  if (!Number.isFinite(nextValue)) return;
                  onMonteCarloParamsChange?.({
                    ...monteCarloParams,
                    contagionDays: Math.max(0, Math.min(14, Math.round(nextValue))),
                  });
                }}
              />
              <Switch
                label="Kinderkompensation aktiv"
                checked={Boolean(monteCarloParams.childCompensationEnabled)}
                onChange={(event) => onMonteCarloParamsChange?.({
                  ...monteCarloParams,
                  childCompensationEnabled: event.currentTarget.checked,
                })}
              />
              <NumberInput
                label="Kinderkompensation pro Ausfall (%)"
                value={monteCarloParams.childCompensationRatePct}
                min={0}
                max={30}
                step={1}
                onChange={(value) => {
                  const nextValue = Number(value);
                  if (!Number.isFinite(nextValue)) return;
                  onMonteCarloParamsChange?.({
                    ...monteCarloParams,
                    childCompensationRatePct: Math.max(0, Math.min(30, Math.round(nextValue))),
                  });
                }}
              />

              <Button
                onClick={() => onRerunMonteCarlo?.()}
                loading={isMonteCarloRunning}
                variant="light"
              >
                Simulation neu berechnen
              </Button>
            </Stack>
          )}
        </Stack>
      </Drawer>
    </>
  );
}

export default ChartFilterForm;
