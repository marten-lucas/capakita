import React from 'react';
import { Paper, Stack, Text, Group, Checkbox, MultiSelect, Select } from '@mantine/core';
import { useSelector, useDispatch } from 'react-redux';
import {
  setTimedimension,
  setChartToggles,
  setFilterGroups,
  setFilterQualifications,
  ensureScenario,
  updateWeeklyChartData,
  updateMidTermChartData,
  updateHistogramChartData,
  updateAgeHistogramData,
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

  const chartState = useSelector((state) => state.chart[scenarioId] || {});
  const timedimension = chartState.timedimension || 'month';
  const chartToggles = chartState.chartToggles || DEFAULT_CHART_TOGGLES;
  const selectedGroups = chartState.filter?.Groups || EMPTY_SELECTION;
  const selectedQualifications = chartState.filter?.Qualifications || EMPTY_SELECTION;
  const referenceDate = chartState.referenceDate || '';

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

  React.useEffect(() => {
    if (!scenarioId) return;
    dispatch(updateWeeklyChartData(scenarioId));
    dispatch(updateMidTermChartData(scenarioId));
    dispatch(updateAgeHistogramData(scenarioId));
    dispatch(updateHistogramChartData(scenarioId));
  }, [dispatch, scenarioId, timedimension, referenceDate, chartToggles, selectedGroups, selectedQualifications]);

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
