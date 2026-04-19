import { Box, Paper, Title, Text, Button, Stack, Container } from '@mantine/core';
import { IconUpload } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import WeeklyChart from '../components/SimDataCharts/WeeklyChart';
import MidtermChart from '../components/SimDataCharts/MidtermChart';
import BookingHistogram from '../components/SimDataCharts/BookingHistogram';
import AgeHistogram from '../components/SimDataCharts/AgeHistogram';
import { useSelector, useDispatch } from 'react-redux';
import { setSelectedScenarioId } from '../store/simScenarioSlice';
import React from 'react';
import ChartFilterForm from '../components/SimDataCharts/ChartFilterForm';
import { useScenarioEvents } from '../hooks/useScenarioEvents';
import { createSelector } from '@reduxjs/toolkit';
import { buildOverlayAwareData } from '../utils/overlayUtils';

const EMPTY_TOGGLES = [];

// Memoized selector for chart toggles
const selectChartToggles = createSelector(
  [
    (state, scenarioId) => state.chart[scenarioId]?.chartToggles
  ],
  (chartToggles) => chartToggles || EMPTY_TOGGLES
);

function VisuPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const scenarios = useSelector(state => state.simScenario.scenarios);
  const chartToggles = useSelector(state => selectChartToggles(state, selectedScenarioId));

  React.useEffect(() => {
    if (selectedScenarioId && scenarios.length > 0) {
      if (!scenarios.some(s => s.id === selectedScenarioId)) {
        dispatch(setSelectedScenarioId(scenarios[0].id));
      }
    } else if (!selectedScenarioId && scenarios.length > 0) {
      dispatch(setSelectedScenarioId(scenarios[0].id));
    }
  }, [selectedScenarioId, scenarios, dispatch]);

  useScenarioEvents(selectedScenarioId);

  const effectiveDataItems = useSelector(state => {
    if (!selectedScenarioId) return [];
    const overlayData = buildOverlayAwareData(selectedScenarioId, state);
    return Object.values(overlayData.effectiveDataItems || {});
  });

  if (!effectiveDataItems || effectiveDataItems.length === 0) {
    return (
      <Container size="sm" py="xl">
        <Paper shadow="xs" p="xl" withBorder style={{ textAlign: 'center' }}>
          <Stack align="center">
            <Title order={3}>Keine Daten vorhanden</Title>
            <Text c="dimmed">Um die Simulation zu starten, müssen Sie zuerst Daten importieren oder anlegen.</Text>
            <Button leftSection={<IconUpload size={16} />} onClick={() => navigate('/data')}>
              Zu Simulationsdaten wechseln
            </Button>
          </Stack>
        </Paper>
      </Container>
    );
  }

  return (
    <Stack gap="lg" pb="xl">
      <ChartFilterForm showStichtag scenarioId={selectedScenarioId} />
      
      {chartToggles.includes('weekly') && (
        <Paper p="md" withBorder>
          <Title order={4} mb="md" c="dimmed">Regelbetrieb</Title>
          <Box h={400}>
            <WeeklyChart />
          </Box>
        </Paper>
      )}

      {chartToggles.includes('midterm') && (
        <Paper p="md" withBorder>
          <Title order={4} mb="md" c="dimmed">Langzeit</Title>
          <Box h={400}>
            <MidtermChart hideFilters scenarioId={selectedScenarioId} />
          </Box>
        </Paper>
      )}

      {chartToggles.includes('ageHistogram') && (
        <Paper p="md" withBorder>
          <Title order={4} mb="md" c="dimmed">Alters-Histogramm</Title>
          <Box h={400}>
            <AgeHistogram />
          </Box>
        </Paper>
      )}

      {chartToggles.includes('histogram') && (
        <Paper p="md" withBorder>
          <Title order={4} mb="md" c="dimmed">Buchungsverteilung</Title>
          <Box h={400}>
            <BookingHistogram />
          </Box>
        </Paper>
      )}

      {chartToggles.length === 0 && (
        <Paper p="xl" withBorder style={{ textAlign: 'center' }}>
          <Text size="lg" fw={500} c="dimmed">Keine Charts ausgewählt</Text>
          <Text size="sm" c="dimmed">Wählen Sie mindestens einen Chart aus, um Daten anzuzeigen.</Text>
        </Paper>
      )}
    </Stack>
  );
}

export default VisuPage;
