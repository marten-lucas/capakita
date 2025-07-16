import { useState } from 'react'
import { Container, Tabs, Tab, Box, Typography } from '@mui/material'
import BarChartIcon from '@mui/icons-material/BarChart'
import TimelineIcon from '@mui/icons-material/Timeline'
import WeeklyChart from '../components/SimDataCharts/WeeklyChart'
import MidtermChart from '../components/SimDataCharts/MidtermChart'

function SimulationPage() {
  const [tab, setTab] = useState(0)

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