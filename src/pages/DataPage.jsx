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
import JSZip from 'jszip';
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
  const importGroupsFromAdebis = useAppSettingsStore(state => state.importGroupsFromAdebis);
  const importQualificationsFromEmployees = useAppSettingsStore(state => state.importQualificationsFromEmployees);
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

  // Prüft, ob Datum leer oder in der Zukunft liegt
  const isFutureOrEmptyDate = (dateString) => {
    if (!dateString || dateString.trim() === '') {
      return true;
    }
    const date = parseDate(dateString);
    if (!date) return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return date >= now;
  };

  // ZEITEN-String in Segmente pro Tag parsen (wie in simulator_poc.html)
  function parseZeiten(zeitenString) {
    if (!zeitenString) return [];
    const daysRaw = zeitenString.split('#').filter(s => s.trim() !== '');
    const parsedDays = [];
    const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

    daysRaw.forEach((dayStr, dayIndex) => {
      if (dayIndex >= 5) return; // Nur Mo-Fr
      const parts = dayStr.split('|').map(p => p.trim());
      const segments = [];
      for (let i = 0; i < parts.length; i += 2) {
        const start = parts[i];
        const end = parts[i + 1];
        if (start && end) {
          segments.push({ booking_start: start, booking_end: end, groupId: '' });
        }
      }
      if (segments.length > 0) {
        parsedDays.push({
          day: dayIndex + 1,
          day_name: dayNames[dayIndex],
          segments
        });
      }
    });
    return parsedDays;
  }

  // --- Hauptfunktion: ZIP-Parsing wie in simulator_poc.html ---
  const extractZipFile = async (file, isAnonymized) => {
    const JSZipLib = JSZip;
    const zip = await JSZipLib.loadAsync(file);

    // Dateinamen finden
    let kindXml, gruppeXml, grukiXml, belegungXml, anstellXml;
    for (const fname in zip.files) {
      // Nur Dateien berücksichtigen, keine Verzeichnisse
      if (zip.files[fname].dir) {
        continue;
      }

      const l = fname.toLowerCase();
      if (l.endsWith('kind.xml')) kindXml = fname;
      else if (l.endsWith('gruppe.xml')) gruppeXml = fname;
      else if (l.endsWith('gruki.xml')) grukiXml = fname;
      else if (l.endsWith('belegung.xml')) belegungXml = fname;
      else if (l.endsWith('anstell.xml')) anstellXml = fname;
    }

    // Helper: decode XML file
    const decodeXml = async (fname) => {
      if (!fname) return null;
      const ab = await zip.files[fname].async('arraybuffer');
      const dec = new TextDecoder('windows-1252');
      return dec.decode(ab);
    };
    // Parse XML to DOM
    const parseXml = (str) => new window.DOMParser().parseFromString(str, 'text/xml');
    // Helper: get text content by tag name
    const getXmlValue = (el, tag) => el.getElementsByTagName(tag)[0]?.textContent.trim() || '';

    // --- Gruppen-Lookup aufbauen ---
    const newGroupsLookup = {};
    if (gruppeXml) {
      const xml = parseXml(await decodeXml(gruppeXml));
      Array.from(xml.getElementsByTagName('GRUPPE')).forEach((g) => {
        const id = getXmlValue(g, 'GRUNR');
        const name = getXmlValue(g, 'BEZ');
        if (id) newGroupsLookup[id] = name;
      });
    }
    // Import groups into AppSettingsStore
    importGroupsFromAdebis(newGroupsLookup);

    // Use the updated groups lookup for simulation data

    // --- GRUKI (Gruppenzuordnung) filtern wie simulator_poc ---
    let grukiList = [];
    if (grukiXml) {
      const grukiDoc = parseXml(await decodeXml(grukiXml));
      grukiList = Array.from(grukiDoc.getElementsByTagName('GRUPPENZUORDNUNG'))
        .map(grukiEl => ({
          KINDNR: getXmlValue(grukiEl, 'KINDNR'),
          GRUNR: getXmlValue(grukiEl, 'GRUNR'),
          GKVON: getXmlValue(grukiEl, 'GKVON'),
          GKBIS: getXmlValue(grukiEl, 'GKBIS')
        }))
        .filter(g => isFutureOrEmptyDate(g.GKBIS));
    }

    // --- BELEGUNG filtern wie simulator_poc ---
    let belegungList = [];
    if (belegungXml) {
      const belegungDoc = parseXml(await decodeXml(belegungXml));
      belegungList = Array.from(belegungDoc.getElementsByTagName('BELEGUNGSBUCHUNG'))
        .map(belegungEl => ({
          IDNR: getXmlValue(belegungEl, 'IDNR'),
          KINDNR: getXmlValue(belegungEl, 'KINDNR'),
          BELVON: getXmlValue(belegungEl, 'BELVON'),
          BELBIS: getXmlValue(belegungEl, 'BELBIS'),
          ZEITEN: getXmlValue(belegungEl, 'ZEITEN')
        }))
        .filter(b => isFutureOrEmptyDate(b.BELBIS));
    }

    // --- KIND filtern wie simulator_poc ---
    let kindList = [];
    if (kindXml) {
      const kindDoc = parseXml(await decodeXml(kindXml));
      kindList = Array.from(kindDoc.getElementsByTagName('KIND'))
        .map(kindEl => ({
          KINDNR: getXmlValue(kindEl, 'KINDNR'),
          AUFNDAT: getXmlValue(kindEl, 'AUFNDAT'),
          AUSTRDAT: getXmlValue(kindEl, 'AUSTRDAT'),
          GRUNR: getXmlValue(kindEl, 'GRUNR'),
          GEBDATUM: getXmlValue(kindEl, 'GEBDATUM'),
          FNAME: getXmlValue(kindEl, 'FNAME')
        }))
        .filter(k => isFutureOrEmptyDate(k.AUSTRDAT));
    }

    // --- ANSTELLUNG filtern wie simulator_poc ---
    let anstellList = [];
    if (anstellXml) {
      const anstellDoc = parseXml(await decodeXml(anstellXml));
      anstellList = Array.from(anstellDoc.getElementsByTagName('ANSTELLUNG'))
        .map(anstellEl => ({
          IDNR: getXmlValue(anstellEl, 'IDNR'),
          BEGINNDAT: getXmlValue(anstellEl, 'BEGINNDAT'),
          ENDDAT: getXmlValue(anstellEl, 'ENDDAT'),
          ARBZEIT: getXmlValue(anstellEl, 'ARBZEIT'),
          URLAUB: getXmlValue(anstellEl, 'URLAUB'),
          QUALIFIK: getXmlValue(anstellEl, 'QUALIFIK'),
          VERTRAGART: getXmlValue(anstellEl, 'VERTRAGART'),
          ZEITEN: getXmlValue(anstellEl, 'ZEITEN')
        }))
        .filter(a => isFutureOrEmptyDate(a.ENDDAT));
    }

    // --- Build simulationData ---
    let idCounter = 1;
    const processedData = [];

    // Kids (demand)
    for (const kind of kindList) {
      // Find all group assignments for this child (gefiltert)
      const groups = grukiList.filter(g => g.KINDNR === kind.KINDNR).map(g => ({
        id: parseInt(g.GRUNR),
        name: newGroupsLookup[g.GRUNR] || `Gruppe ${g.GRUNR}`,
        start: g.GKVON,
        end: g.GKBIS
      }));
      // Find all bookings for this child (gefiltert)
      const bookings = belegungList.filter(b => b.KINDNR === kind.KINDNR).map(b => ({
        startdate: b.BELVON,
        enddate: b.BELBIS,
        times: parseZeiten(b.ZEITEN)
      }));

      processedData.push({
        id: idCounter++,
        type: "demand",
        name: isAnonymized ? `Kind ${kind.KINDNR}` : kind.FNAME,
        rawdata: {
          source: "adebis export",
          data: {
            KIND: {
              KINDNR: kind.KINDNR,
              AUFNDAT: kind.AUFNDAT,
              AUSTRDAT: kind.AUSTRDAT,
              GRUNR: kind.GRUNR,
              GEBDATUM: kind.GEBDATUM,
              FNAME: isAnonymized ? '' : kind.FNAME
            }
          }
        },
        parseddata: {
          startdate: kind.AUFNDAT,
          enddate: kind.AUSTRDAT,
          geburtsdatum: kind.GEBDATUM,
          group: groups,
          booking: bookings
        },
        originalParsedData: JSON.parse(JSON.stringify({
          startdate: kind.AUFNDAT,
          enddate: kind.AUSTRDAT,
          geburtsdatum: kind.GEBDATUM,
          group: groups,
          booking: bookings
        }))
      });
    }

    // Employees (capacity)
    const employeeItems = [];
    for (const a of anstellList) {
      const initialBookingTimes = parseZeiten(a.ZEITEN).map(dayTime => ({
        ...dayTime,
        segments: dayTime.segments.map(segment => ({ ...segment, groupId: '' }))
      }));

      const employeeItem = {
        id: idCounter++,
        type: "capacity",
        name: `Mitarbeiter ${a.IDNR}`,
        rawdata: {
          source: "adebis export",
          data: {
            ANSTELLUNG: {
              IDNR: a.IDNR,
              BEGINNDAT: a.BEGINNDAT,
              ENDDAT: a.ENDDAT,
              ARBZEIT: a.ARBZEIT,
              URLAUB: a.URLAUB,
              QUALIFIK: a.QUALIFIK,
              VERTRAGART: a.VERTRAGART,
              ZEITEN: a.ZEITEN
            }
          }
        },
        parseddata: {
          startdate: a.BEGINNDAT,
          enddate: a.ENDDAT,
          qualification: a.QUALIFIK,
          vacation: a.URLAUB,
          worktime: a.ARBZEIT,
          booking: [{
            startdate: a.BEGINNDAT,
            enddate: a.ENDDAT,
            times: initialBookingTimes
          }],
          group: []
        },
        originalParsedData: JSON.parse(JSON.stringify({
          startdate: a.BEGINNDAT,
          enddate: a.ENDDAT,
          qualification: a.QUALIFIK,
          vacation: a.URLAUB,
          worktime: a.ARBZEIT,
          booking: [{
            startdate: a.BEGINNDAT,
            enddate: a.ENDDAT,
            times: initialBookingTimes
          }],
          group: []
        }))
      };
      processedData.push(employeeItem);
      employeeItems.push(employeeItem);
    }

    // Import qualifications from employees
    importQualificationsFromEmployees(employeeItems);

    // Instead, return processedData for scenario creation
    return processedData;
  };

  const handleImport = async ({ file, isAnonymized }) => {
    const processedData = await extractZipFile(file, isAnonymized);
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

