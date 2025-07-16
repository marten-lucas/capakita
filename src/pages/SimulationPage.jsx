import { useState } from 'react'
import { Box, Tabs, Tab, Typography, Paper, Button } from '@mui/material'
import BarChartIcon from '@mui/icons-material/BarChart'
import TimelineIcon from '@mui/icons-material/Timeline'
import FileUploadIcon from '@mui/icons-material/FileUpload'
import { useNavigate } from 'react-router-dom'
import WeeklyChart from '../components/SimDataCharts/WeeklyChart'
import MidtermChart from '../components/SimDataCharts/MidtermChart'
import useSimulationDataStore from '../store/simulationDataStore'

function SimulationPage() {
  const [tab, setTab] = useState(0)
  const navigate = useNavigate()
  const simulationData = useSimulationDataStore(state => state.simulationData)

  // Prüfe ob Simulationsdaten vorhanden sind
  if (!simulationData || simulationData.length === 0) {
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
            Keine Simulationsdaten vorhanden
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
      <Box sx={{ px: 0, pt: 4 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          aria-label="Simulation Tabs"
          centered
          sx={{ mb: 3 }}
        >
          <Tab icon={<BarChartIcon />} label="Weekly" />
          <Tab icon={<TimelineIcon />} label="Midterm" />
        </Tabs>
      </Box>
      <Box sx={{ flex: 1, p: 0, display: 'flex', flexDirection: 'column', overflow: 'auto', height: '100vh', maxHeight: '100vh' }}>
        {tab === 0 && <WeeklyChart />}
        {tab === 1 && <MidtermChart />}
      </Box>
    </Box>
  )
}

export default SimulationPage