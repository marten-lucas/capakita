import React from 'react';
import { Paper, Stack, Text, Group, MultiSelect, Select, Button, Box, Badge, NumberInput } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';
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
  compactBar = false,
  groupsOnly = false,
  showMonteCarloControls = false,
  monteCarloParams = null,
  onMonteCarloParamsChange,
  onRerunMonteCarlo,
  isMonteCarloRunning = false,
}) {
  const dispatch = useDispatch();
  const isMobile = useMediaQuery('(max-width: 62em)');
  const [filtersOpen, setFiltersOpen] = React.useState(false);

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
    <Paper withBorder={!compactBar} p={compactBar ? 'xs' : 'md'} className={compactBar ? 'analysis-filter-compact-shell' : undefined}>
      <Stack gap={compactBar ? 'xs' : 'md'}>
        <Group justify="space-between" align="center">
          <Group gap="xs">
            <Text fw={600}>Kontextfilter</Text>
            {!compactBar && <Badge variant="light" size="sm">dezent</Badge>}
          </Group>
          <Button
            variant="subtle"
            size="compact-sm"
            onClick={() => setFiltersOpen((open) => !open)}
            rightSection={filtersOpen ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
            data-testid="analysis-filter-toggle"
            aria-expanded={filtersOpen}
          >
            {filtersOpen ? 'Filter einklappen' : 'Filter ausklappen'}
          </Button>
        </Group>

        {filtersOpen && (
          <Box data-testid="analysis-filter-content">
            <Stack gap="md">
              <Group align="flex-start" grow={!isMobile} wrap={isMobile ? 'wrap' : 'nowrap'}>
                <MultiSelect
                  label="Gruppen"
                  data={groupOptions}
                  value={selectedGroups}
                  onChange={(value) => dispatch(setFilterGroups({ scenarioId, groups: value }))}
                  searchable
                  clearable
                  size={compactBar ? 'xs' : 'sm'}
                  w={isMobile ? '100%' : undefined}
                />

                {!groupsOnly && (
                  <MultiSelect
                    label="Qualifikationen"
                    data={qualificationOptions}
                    value={selectedQualifications}
                    onChange={(value) => dispatch(setFilterQualifications({ scenarioId, qualifications: value }))}
                    searchable
                    clearable
                    size={compactBar ? 'xs' : 'sm'}
                    w={isMobile ? '100%' : undefined}
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
                    size={compactBar ? 'xs' : 'sm'}
                    w={isMobile ? '100%' : undefined}
                  />
                )}
              </Group>

              {!groupsOnly && showStichtag && <EventPicker scenarioId={scenarioId} />}

              {showMonteCarloControls && monteCarloParams && (
                <Stack gap="xs" data-testid="analysis-monte-carlo-controls">
                  <Text fw={600} size={compactBar ? 'xs' : 'sm'}>Monte-Carlo</Text>
                  <Group align="flex-end" grow={!isMobile} wrap={isMobile ? 'wrap' : 'nowrap'}>
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
                      size={compactBar ? 'xs' : 'sm'}
                      w={isMobile ? '100%' : undefined}
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
                      size={compactBar ? 'xs' : 'sm'}
                      w={isMobile ? '100%' : undefined}
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
                      size={compactBar ? 'xs' : 'sm'}
                      w={isMobile ? '100%' : undefined}
                    />
                    <Button
                      onClick={() => onRerunMonteCarlo?.()}
                      loading={isMonteCarloRunning}
                      size={compactBar ? 'xs' : 'sm'}
                      variant="light"
                    >
                      Simulation wiederholen
                    </Button>
                  </Group>
                </Stack>
              )}
            </Stack>
          </Box>
        )}
      </Stack>
    </Paper>
  );
}

export default ChartFilterForm;
