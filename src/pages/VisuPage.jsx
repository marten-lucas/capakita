import { useState } from 'react'
import { Box, Typography, Paper, Button, ToggleButton, ToggleButtonGroup } from '@mui/material'
import BarChartIcon from '@mui/icons-material/BarChart'
import TimelineIcon from '@mui/icons-material/Timeline'
import FileUploadIcon from '@mui/icons-material/FileUpload'
import { useNavigate } from 'react-router-dom'
import WeeklyChart from '../components/SimDataCharts/WeeklyChart'
import MidtermChart from '../components/SimDataCharts/MidtermChart'
import useSimScenarioStore from '../store/simScenarioStore'
import ScenarioManager from '../components/ScenarioManager'
import useAppSettingsStore from '../store/appSettingsStore'
import ScenarioSaveDialog from '../components/modals/ScenarioSaveDialog'
import ChartFilterForm from '../components/SimDataCharts/ChartFilterForm'
import React from 'react'

function VisuPage() {
  const [visibleCharts, setVisibleCharts] = useState(['weekly', 'midterm'])
  const navigate = useNavigate()

  // Scenario management
  const selectedScenarioId = useSimScenarioStore(state => state.selectedScenarioId);
  const setSelectedScenarioId = useSimScenarioStore(state => state.setSelectedScenarioId);
  const scenarios = useSimScenarioStore(state => state.scenarios);

  // Use store for dialog state
  const scenarioSaveDialogOpen = useAppSettingsStore(state => state.scenarioSaveDialogOpen);
  const setScenarioSaveDialogOpen = useAppSettingsStore(state => state.setScenarioSaveDialogOpen);
  const scenarioSaveDialogPending = useAppSettingsStore(state => state.scenarioSaveDialogPending);
  const setScenarioSaveDialogPending = useAppSettingsStore(state => state.setScenarioSaveDialogPending);

  // Find the selected scenario object
  const selectedScenario = scenarios.find(s => s.id === selectedScenarioId);

  // Get simulationData for Dates of Interest selector
  const simulationData = selectedScenario?.simulationData ?? [];

  // Check if selected scenario still exists, if not select the first available one
  React.useEffect(() => {
    if (selectedScenarioId && scenarios.length > 0) {
      const scenarioExists = scenarios.some(s => s.id === selectedScenarioId);
      if (!scenarioExists) {
        // Selected scenario was deleted, select the first available one
        setSelectedScenarioId(scenarios[0].id);
      }
    } else if (!selectedScenarioId && scenarios.length > 0) {
      // No scenario selected but scenarios exist, select the first one
      setSelectedScenarioId(scenarios[0].id);
    }
  }, [selectedScenarioId, scenarios, setSelectedScenarioId]);

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

  const handleChartToggle = (event, newVisibleCharts) => {
    setVisibleCharts(newVisibleCharts)
  }

  // Determine which filters to show based on visible charts
  const showStichtag = visibleCharts.includes('weekly')
  const showZeitdimension = visibleCharts.includes('midterm')

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#f0f2f5' }}>
      {/* Scenario Selector */}
      <ScenarioManager
        selectedScenarioId={selectedScenarioId}
        setSelectedScenarioId={setSelectedScenarioId}
        scenarios={scenarios}
        setSelectedItem={() => {}} // Not used in VisuPage
      />
      
      <ScenarioSaveDialog
        open={scenarioSaveDialogOpen}
        onClose={() => { setScenarioSaveDialogOpen(false); setScenarioSaveDialogPending(null); }}
        onSave={(password) => {
          if (scenarioSaveDialogPending) {
            scenarioSaveDialogPending(password);
            setScenarioSaveDialogOpen(false);
            setScenarioSaveDialogPending(null);
          }
        }}
      />
      
      <Box sx={{ px: 3, pt: 4, pb: 2 }}>
        {/* Always show the filter form, even if no chart is selected */}
        <Box sx={{ mb: 3 }}>
          <ChartFilterForm 
            showStichtag={showStichtag}
            showZeitdimension={showZeitdimension}
            simulationData={simulationData}
            chartToggle={
              <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
                <ToggleButtonGroup
                  value={visibleCharts}
                  onChange={handleChartToggle}
                  aria-label="chart visibility"
                  size="medium"
                >
                  <ToggleButton value="weekly" aria-label="weekly chart">
                    <BarChartIcon sx={{ mr: 1 }} />
                    Weekly
                  </ToggleButton>
                  <ToggleButton value="midterm" aria-label="midterm chart">
                    <TimelineIcon sx={{ mr: 1 }} />
                    Midterm
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>
            }
          />
        </Box>
      </Box>
      
      <Box sx={{ flex: 1, p: 3, display: 'flex', flexDirection: 'column', gap: 3, overflow: 'auto' }}>
        {visibleCharts.includes('weekly') && (
          <Box sx={{ minHeight: '400px' }}>
            <Typography variant="h6" sx={{ mb: 2, color: 'text.secondary' }}>
              Weekly Chart
            </Typography>
            <WeeklyChart hideFilters scenario={selectedScenario} />
          </Box>
        )}
        {visibleCharts.includes('midterm') && (
          <Box sx={{ minHeight: '400px' }}>
            <Typography variant="h6" sx={{ mb: 2, color: 'text.secondary' }}>
              Midterm Chart
            </Typography>
            <MidtermChart hideFilters scenario={selectedScenario} />
          </Box>
        )}
        {visibleCharts.length === 0 && (
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