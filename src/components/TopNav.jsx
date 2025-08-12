import * as React from 'react'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Container from '@mui/material/Container'
import Button from '@mui/material/Button'
import { NavLink } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux';
import { isSaveAllowed, setSaveDialogOpen, setLoadDialogOpen } from '../store/simScenarioSlice';
import StorageIcon from '@mui/icons-material/Storage'
import BarChartIcon from '@mui/icons-material/BarChart'
import SettingsIcon from '@mui/icons-material/Settings'
import MoreVertIcon from '@mui/icons-material/MoreVert';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import ScenarioSaveDialog from './modals/ScenarioSaveDialog';
import DataImportModal from './modals/DataImportModal';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import SaveIcon from '@mui/icons-material/Save';
import ScenarioPicker from './ScenarioManager/ScenarioPicker';

const pages = [
  { label: 'Simulationsdaten', path: '/data', icon: <StorageIcon sx={{ mr: 1 }} /> },
  { label: 'Visualisierung', path: '/visu', icon: <BarChartIcon sx={{ mr: 1 }} /> },
  { label: 'Einstellungen', path: '/settings', icon: <SettingsIcon sx={{ mr: 1 }} /> },
];

function TopNav() {
  const dispatch = useDispatch();
  const isSaveAllowedValue = useSelector(isSaveAllowed);
  const scenarios = useSelector(state => state.simScenario.scenarios);

  const [anchorEl, setAnchorEl] = React.useState(null);
  const [importDialogOpen, setImportDialogOpen] = React.useState(false);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };
  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleSaveClick = () => {
    dispatch(setSaveDialogOpen(true));
    handleMenuClose();
  };

  const handleLoadClick = () => {
    dispatch(setLoadDialogOpen(true));
    handleMenuClose();
  };

  const handleImportClick = () => {
    setImportDialogOpen(true);
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
          {/* ScenarioPicker inserted here */}

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
          <Box sx={{ mr: 3, flexShrink: 0 }}>
            <ScenarioPicker />
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
              <MenuItem onClick={handleImportClick}>
                <FileUploadIcon sx={{ mr: 1 }} />
                Adebis-Daten importieren
              </MenuItem>
              <MenuItem onClick={handleLoadClick}>
                <FolderOpenIcon sx={{ mr: 1 }} />
                Szenarien laden
              </MenuItem>
              <MenuItem
                onClick={handleSaveClick}
                disabled={!isSaveAllowedValue}
              >
                <SaveIcon sx={{ mr: 1 }} />
                Szenarien speichern
              </MenuItem>
              {/* ...add more menu items here if needed... */}
            </Menu>
            <DataImportModal
              open={importDialogOpen}
              onClose={() => setImportDialogOpen(false)}
              onImport={() => setImportDialogOpen(false)}
            />
            <ScenarioSaveDialog />
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  )
}

export default TopNav