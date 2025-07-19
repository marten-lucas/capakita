import * as React from 'react'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Container from '@mui/material/Container'
import Button from '@mui/material/Button'
import { NavLink } from 'react-router-dom'
import useSimScenarioStore from '../store/simScenarioStore'
import StorageIcon from '@mui/icons-material/Storage'
import BarChartIcon from '@mui/icons-material/BarChart'
import SettingsIcon from '@mui/icons-material/Settings'
import MoreVertIcon from '@mui/icons-material/MoreVert';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import ScenarioSaveDialog from './modals/ScenarioSaveDialog';
import useChartStore from '../store/chartStore';
import CryptoJS from 'crypto-js';
import useAppSettingsStore from '../store/appSettingsStore';

const pages = [
  { label: 'Szenarien & Daten', path: '/data', icon: <StorageIcon sx={{ mr: 1 }} /> },
  { label: 'Visualisierung', path: '/simulation', icon: <BarChartIcon sx={{ mr: 1 }} /> },
  { label: 'Organisation', path: '/settings', icon: <SettingsIcon sx={{ mr: 1 }} /> },
];

function TopNav() {
  const isSaveAllowed = useSimScenarioStore(state => state.isSaveAllowed());
  const scenarios = useSimScenarioStore(state => state.scenarios);

  // Prüfe, ob alle importierten Szenarien anonymisiert sind oder keine Imports vorliegen

  // State for menu anchor
  const [anchorEl, setAnchorEl] = React.useState(null);

  // Use store for dialog state
  const scenarioSaveDialogOpen = useAppSettingsStore(state => state.scenarioSaveDialogOpen);
  const setScenarioSaveDialogOpen = useAppSettingsStore(state => state.setScenarioSaveDialogOpen);
  const scenarioSaveDialogPending = useAppSettingsStore(state => state.scenarioSaveDialogPending);
  const setScenarioSaveDialogPending = useAppSettingsStore(state => state.setScenarioSaveDialogPending);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };
  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleSaveClick = () => {
    setScenarioSaveDialogOpen(true);
    setScenarioSaveDialogPending(() => (password) => {
      const simState = useSimScenarioStore.getState();
      const chartData = useChartStore.getState();

      const data = {
        scenarios: simState.scenarios,
        selectedScenarioId: simState.selectedScenarioId,
        chartStore: {
          stichtag: chartData.stichtag,
          selectedGroups: chartData.selectedGroups,
          selectedQualifications: chartData.selectedQualifications,
          availableGroups: chartData.availableGroups,
          availableQualifications: chartData.availableQualifications,
          midtermTimeDimension: chartData.midtermTimeDimension,
          midtermSelectedGroups: chartData.midtermSelectedGroups,
          midtermSelectedQualifications: chartData.midtermSelectedQualifications
        }
      };

      const json = JSON.stringify(data, null, 2);
      const ciphertext = CryptoJS.AES.encrypt(json, password).toString();

      const blob = new Blob([ciphertext], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'kiga-simulator-data.enc';
      a.click();
      URL.revokeObjectURL(url);
    });
    handleMenuClose();
  };

  // Wenn keine Szenarien vorhanden sind, nur leerer Balken anzeigen
  if (!scenarios || scenarios.length === 0) {
    return (
      <AppBar position="static" sx={{ bgcolor: '#f5f5f5', boxShadow: 'none' }}>
        <Toolbar disableGutters />
      </AppBar>
    );
  }

  return (
    <AppBar position="static" sx={{ bgcolor: '#f2e7a5ff', boxShadow: 'none' }}>
      <Container maxWidth="xl" disableGutters>
        <Toolbar >
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 6, ml: 2 }}>
            <img
              src="/CapaKita_Icon.svg"
              alt="CapaKita Icon"
              style={{ width: 36, height: 36, marginRight: 12 }}
            />
            <Typography
              variant="h6"
              noWrap
              component={NavLink}
              to="/"
              end
              sx={{
                fontFamily: 'sans-serif',
                fontWeight: 700,
                letterSpacing: '.1em',
                color: '#111',
                textDecoration: 'none',
                fontSize: '1.5rem',
              }}
            >
              CapaKita
            </Typography>
          </Box>
          <Box sx={{ flexGrow: 1, display: 'flex' }}>
            {pages.map((page) => (
              <Button
                key={page.label}
                component={NavLink}
                to={page.path}
                sx={{
                  my: 2,
                  color: '#222',
                  display: 'flex',
                  alignItems: 'center',
                  fontFamily: 'sans-serif',
                  fontWeight: 500,
                  '&.active': {
                    bgcolor: '#e0e0e0',
                  },
                }}
              >
                {page.icon}
                {page.label}
              </Button>
            ))}
          </Box>
          {/* Dot menu for save */}
          <Box>
            <IconButton
              aria-label="Mehr"
              onClick={handleMenuOpen}
              size="large"
              sx={{ ml: 1 }}
            >
              <MoreVertIcon />
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
            >
              <MenuItem
                onClick={handleSaveClick}
                disabled={!isSaveAllowed}
              >
                💾 Szenarien speichern
              </MenuItem>
              {/* ...add more menu items here if needed... */}
            </Menu>
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
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  )
}

export default TopNav