import { useState } from 'react'
import { Container, Tabs, Tab, Box, Typography, Paper, Button } from '@mui/material'
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
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Simulation
        </Typography>
        <Paper 
          sx={{ 
            p: 4, 
            textAlign: 'center', 
            bgcolor: '#f5f5f5',
            border: '2px dashed #ccc'
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
      </Container>
    )
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Simulation
      </Typography>
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
      <Box>
        {tab === 0 && <WeeklyChart />}
        {tab === 1 && <MidtermChart />}
      </Box>
    </Container>
  )
}

export default SimulationPage