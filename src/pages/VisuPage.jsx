import { Box, Typography, Paper, Button } from '@mui/material'
import FileUploadIcon from '@mui/icons-material/FileUpload'
import { useNavigate } from 'react-router-dom'
import WeeklyChart from '../components/SimDataCharts/WeeklyChart'
import MidtermChart from '../components/SimDataCharts/MidtermChart'
import FinancialChart from '../components/SimDataCharts/FinancialChart'
import BookingHistogram from '../components/SimDataCharts/BookingHistogram'
import { useSelector, useDispatch } from 'react-redux';
import { setSelectedScenarioId } from '../store/simScenarioSlice';
import React from 'react'
import ScenarioSaveDialog from '../components/modals/ScenarioSaveDialog'
import ChartFilterForm from '../components/SimDataCharts/ChartFilterForm'
import { useScenarioEvents } from '../hooks/useScenarioEvents';
import { createSelector } from '@reduxjs/toolkit';
import { buildOverlayAwareData } from '../utils/overlayUtils'; // <-- import overlay utils

const EMPTY_TOGGLES = [];

// Memoized selector for chart toggles
const selectChartToggles = createSelector(
  [
    (state, scenarioId) => state.chart[scenarioId]?.chartToggles
  ],
  (chartToggles) => chartToggles || EMPTY_TOGGLES
);

// Memoized selector for chart state
const selectChartState = createSelector(
  [
    (state, scenarioId) => state.chart[scenarioId]
  ],
  (chartState) => chartState || {}
);

function VisuPage() {
  const navigate = useNavigate();

  // Scenario management
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const scenarios = useSelector(state => state.simScenario.scenarios);
  const dispatch = useDispatch();

  // Use memoized selector for chartToggles to prevent rerenders
  const chartToggles = useSelector(state => selectChartToggles(state, selectedScenarioId));

  // Track timedimension for financial chart
  const chartState = useSelector(state => selectChartState(state, selectedScenarioId));
  const timedimension = chartState.timedimension || 'month';

  // Check if selected scenario still exists, if not select the first available one
  React.useEffect(() => {
    if (selectedScenarioId && scenarios.length > 0) {
      const scenarioExists = scenarios.some(s => s.id === selectedScenarioId);
      if (!scenarioExists) {
        dispatch(setSelectedScenarioId(scenarios[0].id));
      }
    } else if (!selectedScenarioId && scenarios.length > 0) {
      dispatch(setSelectedScenarioId(scenarios[0].id));
    }
  }, [selectedScenarioId, scenarios, dispatch]);

  // Use scenario events hook for selected scenario
  useScenarioEvents(selectedScenarioId);

  // Overlay-aware: get effective data items for selected scenario
  const effectiveDataItems = useSelector(state => {
    if (!selectedScenarioId) return [];
    const overlayData = buildOverlayAwareData(selectedScenarioId, state);
    return Object.values(overlayData.effectiveDataItems || {});
  });

  // Prüfe ob Daten vorhanden sind (overlay-aware)
  if (!effectiveDataItems || effectiveDataItems.length === 0) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 85px)', bgcolor: '#f0f2f5' }}>
        <Paper
          sx={{
            m: 'auto',
            p: 4,
            textAlign: 'center',
            bgcolor: '#f5f5f5',
            border: '2px dashed #ccc',
            maxWidth: 480
          }}
        >
          <Typography variant="h6" gutterBottom>
            Keine Daten vorhanden
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Um die Simulation zu starten, müssen Sie zuerst Daten importieren oder anlegen.
          </Typography>
          <Button
            variant="contained"
            startIcon={<FileUploadIcon />}
            onClick={() => navigate('/data')}
            size="large"
          >
            Zu Simulationsdaten wechseln
          </Button>
        </Paper>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 85px)', bgcolor: '#f0f2f5', overflow: 'hidden' }}>
      {/* Chart Filter Form added here */}
      <Box sx={{ px: 3, pt: 2, flex: '0 0 auto' }}>
        <ChartFilterForm showStichtag scenarioId={selectedScenarioId} />
      </Box>

      <Box sx={{ flex: 1, p: 3, display: 'flex', flexDirection: 'column', gap: 3, overflow: 'auto', minHeight: 0 }}>
        {chartToggles.includes('weekly') && (
          <Box sx={{ minHeight: '400px' }}>
            <Typography variant="h6" sx={{ mb: 2, color: 'text.secondary' }}>
              Weekly Chart
            </Typography>
            <WeeklyChart  />
          </Box>
        )}
        {chartToggles.includes('midterm') && (
          <Box sx={{ minHeight: '400px' }}>
            <Typography variant="h6" sx={{ mb: 2, color: 'text.secondary' }}>
              Midterm Chart
            </Typography>
            <MidtermChart hideFilters scenarioId={selectedScenarioId} />
          </Box>
        )}
        {chartToggles.includes('financial') && (
          <Box sx={{ minHeight: '400px' }}>
            <Typography variant="h6" sx={{ mb: 2, color: 'text.secondary' }}>
              Financial Chart
            </Typography>
            <FinancialChart scenarioId={selectedScenarioId} timedimension={timedimension} />
          </Box>
        )}
        {chartToggles.includes('histogram') && (
          <Box sx={{ minHeight: '400px' }}>
            <Typography variant="h6" sx={{ mb: 2, color: 'text.secondary' }}>
              Booking Histogram
            </Typography>
            <BookingHistogram />
          </Box>
        )}
        {chartToggles.length === 0 && (
          <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#f5f5f5' }}>
            <Typography variant="h6" color="text.secondary">
              Keine Charts ausgewählt
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Wählen Sie mindestens einen Chart aus, um Daten anzuzeigen.
            </Typography>
          </Paper>
        )}
      </Box>
    </Box>
  )
}

export default VisuPage