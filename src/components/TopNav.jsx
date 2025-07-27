import * as React from 'react'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Container from '@mui/material/Container'
import Button from '@mui/material/Button'
import { NavLink } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux';
import { setScenarioSaveDialogOpen, setScenarioSaveDialogPending, isSaveAllowed } from '../store/simScenarioSlice';
import StorageIcon from '@mui/icons-material/Storage'
import BarChartIcon from '@mui/icons-material/BarChart'
import SettingsIcon from '@mui/icons-material/Settings'
import MoreVertIcon from '@mui/icons-material/MoreVert';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import ScenarioSaveDialog from './modals/ScenarioSaveDialog';
import CryptoJS from 'crypto-js';

const pages = [
  { label: 'Szenarien & Daten', path: '/data', icon: <StorageIcon sx={{ mr: 1 }} /> },
  { label: 'Visualisierung', path: '/visu', icon: <BarChartIcon sx={{ mr: 1 }} /> },
  { label: 'Organisation', path: '/orga', icon: <SettingsIcon sx={{ mr: 1 }} /> },
];

function TopNav() {
  const dispatch = useDispatch();
  // Use selector function for isSaveAllowed
  const isSaveAllowedValue = useSelector(isSaveAllowed);
  const scenarios = useSelector(state => state.simScenario.scenarios);
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);

  // State for menu anchor
  const [anchorEl, setAnchorEl] = React.useState(null);

  // Use store for dialog state
  const scenarioSaveDialogOpen = useSelector(state => state.simScenario.scenarioSaveDialogOpen);
  const scenarioSaveDialogPending = useSelector(state => state.simScenario.scenarioSaveDialogPending);

  const chartData = useSelector(state => state.chart);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };
  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleSaveClick = () => {
    dispatch(setScenarioSaveDialogPending(() => (password) => {
      const simState = {
        scenarios,
        selectedScenarioId,
      };
      const data = {
        ...simState,
        chartStore: {
          stichtag: chartData.stichtag,
          selectedGroups: chartData.selectedGroups,
          selectedQualifications: chartData.selectedQualifications,
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
    }));
    handleMenuClose();
  };

  // Wenn keine Szenarien vorhanden sind, nur leerer Balken anzeigen
  if (!scenarios || scenarios.length === 0) {
    return (
      <AppBar position="static" sx={{ bgcolor: '#fbf5ed', boxShadow: 'none' }}>
        <Toolbar disableGutters />
      </AppBar>
    );
  }

  return (
    <AppBar position="static" sx={{ bgcolor: '#fbf5ed', boxShadow: 'none' }}>
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
                color: '#083743',
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
                  color: '#083743',
                  display: 'flex',
                  alignItems: 'center',
                  fontFamily: 'sans-serif',
                  fontWeight: 500,
                  '&.active': {
                    bgcolor: 'rgba(8, 55, 67, 0.1)',
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
              sx={{ ml: 1, color: '#083743' }}
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
                disabled={!isSaveAllowedValue}
              >
                💾 Szenarien speichern
              </MenuItem>
              {/* ...add more menu items here if needed... */}
            </Menu>
            <ScenarioSaveDialog
              open={scenarioSaveDialogOpen}
              onClose={() => { dispatch(setScenarioSaveDialogOpen(false)); dispatch(setScenarioSaveDialogPending(null)); }}
              onSave={(password) => {
                if (scenarioSaveDialogPending) {
                  scenarioSaveDialogPending(password);
                  dispatch(setScenarioSaveDialogOpen(false));
                  dispatch(setScenarioSaveDialogPending(null));
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