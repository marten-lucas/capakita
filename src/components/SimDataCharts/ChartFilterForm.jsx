import React from 'react';
import { Paper, Stack, Text, Group, Checkbox, MultiSelect, Select } from '@mantine/core';
import { useSelector, useDispatch } from 'react-redux';
import {
  setTimedimension,
  setChartToggles,
  setFilterGroups,
  setFilterQualifications,
  ensureScenario,
} from '../../store/chartSlice';
import { useOverlayData } from '../../hooks/useOverlayData';
import EventPicker from '../EventCalendar/EventPicker';

const DEFAULT_CHART_TOGGLES = ['weekly', 'midterm', 'ageHistogram', 'histogram'];
const EMPTY_SELECTION = [];

function ChartFilterForm({ showStichtag = false, scenarioId, onTimedimensionChange }) {
  const dispatch = useDispatch();

  React.useEffect(() => {
    if (scenarioId) {
      dispatch(ensureScenario(scenarioId));
    }
  }, [dispatch, scenarioId]);

  const chartState = useSelector((state) => state.chart[scenarioId] ?? null);
  
  // Memoize selections to prevent new references every render
  const timedimension = React.useMemo(() => chartState?.timedimension || 'month', [chartState?.timedimension]);
  const chartToggles = React.useMemo(() => chartState?.chartToggles || DEFAULT_CHART_TOGGLES, [chartState?.chartToggles]);
  const selectedGroups = React.useMemo(() => chartState?.filter?.Groups || EMPTY_SELECTION, [chartState?.filter?.Groups]);
  const selectedQualifications = React.useMemo(() => chartState?.filter?.Qualifications || EMPTY_SELECTION, [chartState?.filter?.Qualifications]);
  const referenceDate = React.useMemo(() => chartState?.referenceDate || '', [chartState?.referenceDate]);

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
    if (scenarioId && selectedQualifications.length === 0 && qualificationOptions.length > 0) {
      dispatch(
        setFilterQualifications({
          scenarioId,
          qualifications: qualificationOptions.map((option) => option.value),
        })
      );
    }
  }, [dispatch, scenarioId, selectedQualifications.length, qualificationOptions]);

  return (
    <Paper withBorder p="md">
      <Stack gap="md">
        <Text fw={600}>Filter</Text>

        <Checkbox.Group
          value={chartToggles}
          onChange={(value) => dispatch(setChartToggles({ scenarioId, toggles: value }))}
        >
          <Group>
            <Checkbox value="weekly" label="Regelbetrieb" />
            <Checkbox value="midterm" label="Langzeit" />
            <Checkbox value="ageHistogram" label="Alters-Histogramm" />
            <Checkbox value="histogram" label="Buchungsverteilung" />
          </Group>
        </Checkbox.Group>

        <Group align="flex-start" grow>
          <MultiSelect
            label="Gruppen"
            data={groupOptions}
            value={selectedGroups}
            onChange={(value) => dispatch(setFilterGroups({ scenarioId, groups: value }))}
            searchable
            clearable
          />

          <MultiSelect
            label="Qualifikationen"
            data={qualificationOptions}
            value={selectedQualifications}
            onChange={(value) => dispatch(setFilterQualifications({ scenarioId, qualifications: value }))}
            searchable
            clearable
          />

          {chartToggles.includes('midterm') && (
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
            />
          )}

          {showStichtag && (chartToggles.includes('weekly') || chartToggles.includes('histogram')) && (
            <EventPicker scenarioId={scenarioId} />
          )}
        </Group>
      </Stack>
    </Paper>
  );
}

export default ChartFilterForm;
