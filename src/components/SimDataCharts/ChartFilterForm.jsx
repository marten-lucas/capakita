import React from 'react';
import { Drawer, Stack, Text, Group, MultiSelect, Select, Button, Box, ActionIcon, NumberInput } from '@mantine/core';
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
          </Group>

          {!groupsOnly && showStichtag && <EventPicker scenarioId={scenarioId} />}

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
                label="Ausfallrate (%)"
                value={monteCarloParams.absenceRatePct}
                min={1}
                max={80}
                step={1}
                onChange={(value) => {
                  const nextValue = Number(value);
                  if (!Number.isFinite(nextValue)) return;
                  onMonteCarloParamsChange?.({
                    ...monteCarloParams,
                    absenceRatePct: Math.max(1, Math.min(80, Math.round(nextValue))),
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
              <Button
                onClick={() => onRerunMonteCarlo?.()}
                loading={isMonteCarloRunning}
                variant="light"
              >
                Simulation wiederholen
              </Button>
            </Stack>
          )}
        </Stack>
      </Drawer>
    </>
  );
}

export default ChartFilterForm;
