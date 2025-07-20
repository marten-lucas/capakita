import React, { useState } from 'react';
import {
  Box,
  SpeedDial,
  SpeedDialAction,
  Paper,
  SpeedDialIcon,
  Typography,
  Button, // hinzugefügt
  MenuItem,
  Select,
} from '@mui/material';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import AddIcon from '@mui/icons-material/Add';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import DataImportModal from '../components/modals/DataImportModal';
import SimDataList from '../components/SimDataList';
import SimDataDetailForm from '../components/SimDataDetailForm';
import useSimScenarioStore from '../store/simScenarioStore';
import CryptoJS from 'crypto-js';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import useAppSettingsStore from '../store/appSettingsStore';
import ScenarioSaveDialog from '../components/modals/ScenarioSaveDialog';
import ScenarioManager from '../components/ScenarioManager';
import PersonIcon from '@mui/icons-material/Person';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import LayersIcon from '@mui/icons-material/Layers';
import { extractAdebisZipAndData } from '../utils/adebis-import';
import ChartFilterForm from '../components/SimDataCharts/ChartFilterForm';

function DataPage() {
  const [modalOpen, setModalOpen] = useState(false);
  // const [addItemModalOpen, setAddItemModalOpen] = useState(false);
  // const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  // const [pendingSave, setPendingSave] = useState(false);

  // Use store for dialog state
  const scenarioSaveDialogOpen = useAppSettingsStore(state => state.scenarioSaveDialogOpen);
  const setScenarioSaveDialogOpen = useAppSettingsStore(state => state.setScenarioSaveDialogOpen);
  const scenarioSaveDialogPending = useAppSettingsStore(state => state.scenarioSaveDialogPending);
  const setScenarioSaveDialogPending = useAppSettingsStore(state => state.setScenarioSaveDialogPending);

    const selectedScenarioId = useSimScenarioStore(state => state.selectedScenarioId);
  const setSelectedScenarioId = useSimScenarioStore(state => state.setSelectedScenarioId);
  const scenarios = useSimScenarioStore(state => state.scenarios);

  // Use effective simulation data (overlay-aware)
  const simulationData = useSimScenarioStore(state => state.getEffectiveSimulationData());
  const addScenario = useSimScenarioStore(state => state.addScenario);
  const addItemToScenario = useSimScenarioStore(state => state.addItemToScenario);

  // Use AppSettingsStore for group and selected item management
  const selectedItem = useAppSettingsStore(state => state.selectedItem);
  const setSelectedItem = useAppSettingsStore(state => state.setSelectedItem);

  // --- Hilfsfunktionen wie in simulator_poc.html ---
  // Parse DD.MM.YYYY zu Date
  const parseDate = (dateString) => {
    if (!dateString) return null;
    const parts = dateString.split('.');
    if (parts.length === 3) {
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    return null;
  };

  const handleImport = async ({ file, isAnonymized }) => {
    // Use the centralized import utility
    const { processedData } = await extractAdebisZipAndData(
      file,
      isAnonymized,
      useAppSettingsStore.getState().importGroupsFromAdebis,
      useAppSettingsStore.getState().importQualificationsFromEmployees
    );
    setModalOpen(false);

    // Create a new scenario as root after import, with simulationData
    const scenarioName = isAnonymized ? 'Importiertes Szenario (anonymisiert)' : 'Importiertes Szenario';
    const newScenario = {
      name: scenarioName,
      remark: '',
      confidence: 50,
      likelihood: 50,
      baseScenarioId: null,
      simulationData: processedData,
      imported: true,
      importedAnonymized: !!isAnonymized
    };
    addScenario(newScenario);
    // Find the new scenario's id (last added)
    const scenarios = useSimScenarioStore.getState().scenarios;
    const lastScenario = scenarios[scenarios.length - 1];
    if (lastScenario) {
      setSelectedScenarioId(lastScenario.id);
    }
  };

  const handleOpenModal = () => {
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
  };

  const handleAddCapacity = () => {
    const newItem = {
      id: Date.now(),
      type: 'capacity',
      name: 'Neuer Mitarbeiter',
      rawdata: {
        source: 'manual entry',
        data: {}
      },
      parseddata: {
        startdate: '',
        enddate: '',
        booking: [],
        group: [],
        qualification: '',
        vacation: '',
        worktime: ''
      },
      originalParsedData: {
        startdate: '',
        enddate: '',
        booking: [],
        group: [],
        qualification: '',
        vacation: '',
        worktime: ''
      },
      modifications: [],
      modifiers: {},
      simudata: {}
    };
    addItemToScenario(newItem);
    setSelectedItem(newItem);
  };

  const handleAddDemand = () => {
    const newItem = {
      id: Date.now(),
      type: 'demand',
      name: 'Neues Kind',
      rawdata: {
        source: 'manual entry',
        data: {}
      },
      parseddata: {
        startdate: '',
        enddate: '',
        booking: [],
        group: [],
        geburtsdatum: ''
      },
      originalParsedData: {
        startdate: '',
        enddate: '',
        booking: [],
        group: [],
        geburtsdatum: ''
      },
      modifications: [],
      modifiers: {},
      simudata: {}
    };
    addItemToScenario(newItem);
    setSelectedItem(newItem);
  };

  const scenarioManagerRef = React.useRef();

  // Add scenario via SpeedDial: trigger handleAdd of ScenarioManager for current scenario
  const handleAddScenario = () => {
    if (!selectedScenarioId) return;
    // Find the current scenario object
    const currentScenario = scenarios.find(s => s.id === selectedScenarioId);
    if (scenarioManagerRef.current && scenarioManagerRef.current.handleAdd) {
      scenarioManagerRef.current.handleAdd(currentScenario);
    } else {
      // fallback: add as root if ref not available
      const newScenario = {
        name: 'Neues Szenario',
        remark: '',
        confidence: 50,
        likelihood: 50,
        baseScenarioId: currentScenario?.id || null
      };
      addScenario(newScenario);
      const scenariosList = useSimScenarioStore.getState().scenarios;
      const lastScenario = scenariosList[scenariosList.length - 1];
      if (lastScenario) {
        setSelectedScenarioId(lastScenario.id);
      }
    }
  };

  const actions = [
    {
      icon: <PersonIcon />,
      name: 'Kapazität',
      onClick: handleAddCapacity
    },
    {
      icon: <ChildCareIcon />,
      name: 'Bedarf',
      onClick: handleAddDemand
    },
    {
      icon: <LayersIcon />,
      name: 'Szenario',
      onClick: handleAddScenario
    },
    {
      icon: <FileUploadIcon />,
      name: 'Import',
      onClick: handleOpenModal
    }
  ];

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

  // Show notice if no scenario exists
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
            Um mit der Simulation zu starten, importieren Sie bitte zuerst Daten.
          </Typography>
          <Button 
            variant="contained" 
            startIcon={<FileUploadIcon />}
            onClick={() => setModalOpen(true)}
            size="large"
          >
            Daten importieren
          </Button>
        </Paper>
        <DataImportModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onImport={handleImport}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#f0f2f5' }}>
      {/* Scenario Selector */}
      <ScenarioManager
        ref={scenarioManagerRef}
        selectedScenarioId={selectedScenarioId}
        setSelectedScenarioId={setSelectedScenarioId}
        scenarios={scenarios}
        setSelectedItem={setSelectedItem}
      />
      {/* Chart Filter Form always visible above data details */}
      <Box sx={{ px: 3, pt: 2 }}>
        <ChartFilterForm showStichtag simulationData={simulationData} />
      </Box>
      <SpeedDial
        ariaLabel="SpeedDial for data actions"
        sx={{ position: 'fixed', bottom: 32, right: 32 }}
        icon={<SpeedDialIcon />}
      >
        {actions.map((action) => (
          <SpeedDialAction
            key={action.name}
            icon={action.icon}
            tooltipTitle={action.name}
            onClick={action.onClick}
            disabled={action.disabled}
          />
        ))}
      </SpeedDial>
      <DataImportModal
        open={modalOpen}
        onClose={handleCloseModal}
        onImport={handleImport}
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
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'row', pt: 0 }}>
        <>
          <Box sx={{ width: 320, flexShrink: 0, borderRight: 1, borderColor: 'divider', bgcolor: 'background.paper', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {simulationData.length === 0 && (
              <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
                <Button
                  variant="outlined"
                  startIcon={<FileUploadIcon />}
                  fullWidth
                  onClick={handleOpenModal}
                >
                  Importieren
                </Button>
              </Box>
            )}
            <SimDataList
              data={simulationData}
              onRowClick={(item) => setSelectedItem(item)}
              selectedItem={selectedItem}
              selectedScenarioId={selectedScenarioId}
              onScenarioChange={setSelectedScenarioId}
            />
          </Box>
          <Box sx={{ flex: 1, p: 3, overflow: 'auto', height: '100vh', maxHeight: '100vh' }}>
            {simulationData.length > 0 && selectedItem && (
              <SimDataDetailForm item={selectedItem} />
            )}
          </Box>
        </>
      </Box>
    </Box>
  );
}

export default DataPage;