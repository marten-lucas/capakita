import { Box, Paper, Title, Text, Button, Stack, Container } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconUpload } from '@tabler/icons-react';
import WeeklyChart from '../components/SimDataCharts/WeeklyChart';
import MidtermChart from '../components/SimDataCharts/MidtermChart';
import BookingHistogram from '../components/SimDataCharts/BookingHistogram';
import AgeHistogram from '../components/SimDataCharts/AgeHistogram';
import { useSelector, useDispatch } from 'react-redux';
import { setSelectedScenarioId } from '../store/simScenarioSlice';
import { setActivePage } from '../store/uiSlice';
import React from 'react';
import ChartFilterForm from '../components/SimDataCharts/ChartFilterForm';
import { useScenarioEvents } from '../hooks/useScenarioEvents';
import { buildOverlayAwareData } from '../utils/overlayUtils';
import ChartErrorBoundary from '../components/common/ChartErrorBoundary';
import { selectWeeklyChartDataByGroup } from '../store/chartSelectors';

const EMPTY_TOGGLES = [];

// Memoized selector for chart toggles

function VisuView() {
  const dispatch = useDispatch();
  const isMobile = useMediaQuery('(max-width: 48em)');
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const scenarios = useSelector(state => state.simScenario.scenarios);
  const chartState = useSelector((state) => state.chart[selectedScenarioId] ?? null);
  const chartToggles = chartState?.chartToggles || EMPTY_TOGGLES;
  const weeklyChartsByGroup = useSelector(selectWeeklyChartDataByGroup);
  const weeklySyncGroupKey = selectedScenarioId ? `weekly-sync-${selectedScenarioId}` : null;

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

  // Memoize selector to prevent new array reference each render
  const effectiveDataItems = useSelector(
    (state) => {
      if (!selectedScenarioId) return [];
      const overlayData = buildOverlayAwareData(selectedScenarioId, state);
      return Object.values(overlayData.effectiveDataItems || {});
    },
    (prev, next) => {
      // Custom equality: compare by ID if available
      if (!prev || !next) return prev === next;
      if (prev.length !== next.length) return false;
      return prev.every((item, idx) => item?.id === next[idx]?.id);
    }
  );

  if (!effectiveDataItems || effectiveDataItems.length === 0) {
    return (
      <Container size="sm" py="xl">
        <Paper shadow="xs" p="xl" withBorder style={{ textAlign: 'center' }}>
          <Stack align="center">
            <Title order={3}>Keine Daten vorhanden</Title>
            <Text c="dimmed">Um die Simulation zu starten, müssen Sie zuerst Daten importieren oder anlegen.</Text>
            <Button leftSection={<IconUpload size={16} />} onClick={() => dispatch(setActivePage('data'))}>
              Zu Simulationsdaten wechseln
            </Button>
          </Stack>
        </Paper>
      </Container>
    );
  }

  return (
    <Stack gap={isMobile ? 'md' : 'lg'} pb="xl">
      <ChartFilterForm showStichtag scenarioId={selectedScenarioId} />
      
      {chartToggles.includes('weekly') && (
        <Paper p="md" withBorder style={{ overflow: 'visible' }}>
          <Title order={4} mb="md" c="dimmed">Regelbetrieb</Title>
          <ChartErrorBoundary>
            <WeeklyChart syncGroupKey={weeklySyncGroupKey} />
          </ChartErrorBoundary>
          <Stack gap="lg" mt="lg" style={{ overflow: 'visible' }}>
            {weeklyChartsByGroup.map((groupChart) => (
              <Paper key={groupChart.groupId} p="sm" withBorder style={{ overflow: 'visible' }}>
                <Title order={5} mb="sm" c="dimmed">Gruppe: {groupChart.groupName}</Title>
                <ChartErrorBoundary>
                  <WeeklyChart chartData={groupChart.chartData} syncGroupKey={weeklySyncGroupKey} showRatioChart={false} />
                </ChartErrorBoundary>
              </Paper>
            ))}
          </Stack>
        </Paper>
      )}

      {chartToggles.includes('midterm') && (
        <Paper p="md" withBorder>
          <Title order={4} mb="md" c="dimmed">Langzeit</Title>
          <ChartErrorBoundary>
            <MidtermChart hideFilters scenarioId={selectedScenarioId} />
          </ChartErrorBoundary>
        </Paper>
      )}

      {chartToggles.includes('ageHistogram') && (
        <Paper p="md" withBorder>
          <Title order={4} mb="md" c="dimmed">Alters-Histogramm</Title>
          <Box h={{ base: 300, sm: 350, lg: 400 }}>
            <ChartErrorBoundary>
              <AgeHistogram />
            </ChartErrorBoundary>
          </Box>
        </Paper>
      )}

      {chartToggles.includes('histogram') && (
        <Paper p="md" withBorder>
          <Title order={4} mb="md" c="dimmed">Buchungsverteilung</Title>
          <Box h={{ base: 300, sm: 350, lg: 400 }}>
            <ChartErrorBoundary>
              <BookingHistogram />
            </ChartErrorBoundary>
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

export default VisuView;
