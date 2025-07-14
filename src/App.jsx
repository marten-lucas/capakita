import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Box, Container } from '@mui/material'
import TopNav from './components/TopNav'
import SimDatenPage from './pages/SimDatenPage'
import SimulationPage from './pages/SimulationPage'
import './App.css'

function App() {
  // Lift state from SimDatenPage to App
  const [simulationData, setSimulationData] = useState(() => {
    const saved = localStorage.getItem('simulationData');
    return saved ? JSON.parse(saved) : [];
  });
  const [groupsLookup, setGroupsLookup] = useState(() => {
    const saved = localStorage.getItem('groupsLookup');
    return saved ? JSON.parse(saved) : {};
  });

  // Effect to persist state changes to localStorage
  useEffect(() => {
    localStorage.setItem('simulationData', JSON.stringify(simulationData));
    localStorage.setItem('groupsLookup', JSON.stringify(groupsLookup));
  }, [simulationData, groupsLookup]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width:"100vw" }}>
      <TopNav /> {/* TopNav ist jetzt außerhalb des Containers für volle Breite */}
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Container maxWidth='l'> {/* Der Container ist jetzt nur für den Inhalt */}
          <Routes>
            <Route path="/" element={<Navigate to="/data" replace />} />
            <Route
              path="/data"
              element={
                <SimDatenPage
                  simulationData={simulationData}
                  setSimulationData={setSimulationData}
                  groupsLookup={groupsLookup}
                  setGroupsLookup={setGroupsLookup}
                />
              }
            />
            <Route
              path="/simulation"
              element={
                <SimulationPage
                  simulationData={simulationData}
                  groupsLookup={groupsLookup}
                />
              }
            />
          </Routes>
        </Container>
      </Box>
    </Box>
  )
}
export default App
