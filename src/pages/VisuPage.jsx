import { Box, Typography, Paper, Button } from '@mui/material'
import FileUploadIcon from '@mui/icons-material/FileUpload'
import { useNavigate } from 'react-router-dom'
import WeeklyChart from '../components/SimDataCharts/WeeklyChart'
import MidtermChart from '../components/SimDataCharts/MidtermChart'
import { useSelector, useDispatch } from 'react-redux';
import { setSelectedScenarioId } from '../store/simScenarioSlice';
import React from 'react'
import ScenarioSaveDialog from '../components/modals/ScenarioSaveDialog'
import ChartFilterForm from '../components/SimDataCharts/ChartFilterForm'

const EMPTY_TOGGLES = [];

function VisuPage() {
  const navigate = useNavigate();

  // Scenario management
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const scenarios = useSelector(state => state.simScenario.scenarios);
  const dispatch = useDispatch();

  // Use chartToggles from store (per scenario, fallback to stable empty array)
  const chartToggles = useSelector(state => {
    const scenarioChart = state.chart[selectedScenarioId];
    return scenarioChart?.chartToggles || EMPTY_TOGGLES;
  });

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

  // Prüfe ob Szenarien vorhanden sind
  if (!scenarios || scenarios.length === 0) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#f0f2f5' }}>
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
            Kein Szenario vorhanden
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Um die Simulation zu starten, müssen Sie zuerst Daten importieren.
          </Typography>
          <Button
            variant="contained"
            startIcon={<FileUploadIcon />}
            onClick={() => navigate('/data')}
            size="large"
          >
            Zu Sim-Daten wechseln
          </Button>
        </Paper>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#f0f2f5' }}>
      {/* Chart Filter Form added here */}
      <Box sx={{ px: 3, pt: 2 }}>
        <ChartFilterForm showStichtag scenarioId={selectedScenarioId} />
      </Box>

      <Box sx={{ flex: 1, p: 3, display: 'flex', flexDirection: 'column', gap: 3, overflow: 'auto' }}>
        {chartToggles.includes('weekly') && (
          <Box sx={{ minHeight: '400px' }}>
            <Typography variant="h6" sx={{ mb: 2, color: 'text.secondary' }}>
              Weekly Chart
            </Typography>
            <WeeklyChart  />
          </Box>
        )}
        {/* {chartToggles.includes('midterm') && (
          <Box sx={{ minHeight: '400px' }}>
            <Typography variant="h6" sx={{ mb: 2, color: 'text.secondary' }}>
              Midterm Chart
            </Typography>
            <MidtermChart hideFilters scenario={selectedScenario} />
          </Box>
        )} */}
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