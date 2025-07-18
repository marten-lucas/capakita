import { useState } from 'react';
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
import DataImportModal from '../components/DataImportModal';
import AddItemModal from '../components/AddItemModal';
import SimDataList from '../components/SimDataList';
import SimDataDetailForm from '../components/SimDataDetailForm';
import JSZip from 'jszip';
import useSimScenarioStore from '../store/simScenarioStore';
import useChartStore from '../store/chartStore';
import useModMonitorStore from '../store/modMonitorStore';
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

function SimDatenPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [addItemModalOpen, setAddItemModalOpen] = useState(false);
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [pwDialogMode, setPwDialogMode] = useState(''); // 'save' | 'load'
  const [pwValue, setPwValue] = useState('');
  const [pwValue2, setPwValue2] = useState('');
  const [pwError, setPwError] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pendingSave, setPendingSave] = useState(null);
  const [pendingLoad, setPendingLoad] = useState(null);

  const selectedScenarioId = useSimScenarioStore(state => state.selectedScenarioId);
  const setSelectedScenarioId = useSimScenarioStore(state => state.setSelectedScenarioId);

  // Use effective simulation data (overlay-aware)
  const simulationData = useSimScenarioStore(state => state.getEffectiveSimulationData());
  const setSimulationData = useSimScenarioStore(state => state.setSimulationData);
  const clearAllData = useSimScenarioStore(state => state.clearAllData);
  const addScenario = useSimScenarioStore(state => state.addScenario);
  const addItemToScenario = useSimScenarioStore(state => state.addItemToScenario);

  // Use AppSettingsStore for group and selected item management
  const importGroupsFromAdebis = useAppSettingsStore(state => state.importGroupsFromAdebis);
  const importQualificationsFromEmployees = useAppSettingsStore(state => state.importQualificationsFromEmployees);
  const selectedItem = useAppSettingsStore(state => state.selectedItem);
  const setSelectedItem = useAppSettingsStore(state => state.setSelectedItem);
  const lastImportAnonymized = useAppSettingsStore(state => state.lastImportAnonymized);

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
      simulationData: processedData
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

  const handleOpenAddItemModal = () => {
    setAddItemModalOpen(true);
  };

  const handleCloseAddItemModal = () => {
    setAddItemModalOpen(false);
  };

  const handleAddItem = (newItem) => {
    // Use the new method that handles both root and based scenarios
    addItemToScenario(newItem);
    setSelectedItem(newItem);
  };

  const handleRowClick = (item) => {
    if (selectedItem?.id === item.id) {
      setSelectedItem(null);
    } else {
      setSelectedItem(item);
    }
  };

  const handleResetData = () => {
    clearAllData(); // Reset all imported data
  };

  // Open password dialog for save/load
  const openPwDialog = (mode, cb) => {
    setPwDialogMode(mode);
    setPwValue('');
    setPwValue2('');
    setPwError('');
    setShowPw(false);
    if (mode === 'save') setPendingSave(() => cb);
    if (mode === 'load') setPendingLoad(() => cb);
    setPwDialogOpen(true);
  };

  // Handle dialog close
  const handlePwDialogClose = () => {
    setPwDialogOpen(false);
    setPendingSave(null);
    setPendingLoad(null);
    setPwError('');
  };

  // Handle dialog submit
  const handlePwDialogSubmit = () => {
    if (pwDialogMode === 'save') {
      if (!pwValue) {
        setPwError('Bitte Passwort eingeben.');
        return;
      }
      if (pwValue !== pwValue2) {
        setPwError('Passwörter stimmen nicht überein.');
        return;
      }
      setPwDialogOpen(false);
      if (pendingSave) pendingSave(pwValue);
      setPendingSave(null);
    } else if (pwDialogMode === 'load') {
      if (!pwValue) {
        setPwError('Bitte Passwort eingeben.');
        return;
      }
      setPwDialogOpen(false);
      if (pendingLoad) pendingLoad(pwValue);
      setPendingLoad(null);
    }
    setPwError('');
  };

  // --- Save/Load functions ---
  const saveStoresToFile = () => {
    openPwDialog('save', (password) => {
      const simState = useSimScenarioStore.getState();
      const chartData = useChartStore.getState();
      const modMonitorData = useModMonitorStore.getState();

      // Only save relevant parts
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
        },
        modMonitor: modMonitorData.modifications
      };

      // Encrypt
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
  };

  const loadStoresFromFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.enc,.txt';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const ciphertext = await file.text();
      openPwDialog('load', (password) => {
        try {
          const bytes = CryptoJS.AES.decrypt(ciphertext, password);
          const decrypted = bytes.toString(CryptoJS.enc.Utf8);
          if (!decrypted) throw new Error('Falsches Passwort oder beschädigte Datei.');
          const data = JSON.parse(decrypted);
          // Restore scenarios and selectedScenarioId
          useSimScenarioStore.setState({
            scenarios: data.scenarios || [],
            selectedScenarioId: data.selectedScenarioId || null
          });
          useChartStore.setState(data.chartStore || {});
          useModMonitorStore.setState({ modifications: data.modMonitor || {} });
          setSelectedItem(null);
        } catch (err) {
          alert('Fehler beim Entschlüsseln/Laden: ' + err.message);
        }
      });
    };
    input.click();
  };

  const actions = [
    { icon: <FileUploadIcon />, name: 'Import', onClick: handleOpenModal },
    { icon: <AddIcon />, name: 'Add', onClick: handleOpenAddItemModal },
    { icon: <RestartAltIcon />, name: 'Reset', onClick: handleResetData },
    {
      icon: <span>💾</span>,
      name: 'Speichern',
      onClick: saveStoresToFile,
      disabled: !lastImportAnonymized // Disable if not anonymized
    },
    { icon: <span>📂</span>, name: 'Laden', onClick: loadStoresFromFile },
  ];

  const scenarios = useSimScenarioStore(state => state.scenarios);

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
      <Box sx={{ px: 3, pt: 2, pb: 1, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant="subtitle1" sx={{ minWidth: 120 }}>Szenario:</Typography>
        <Select
          size="small"
          value={selectedScenarioId || ''}
          onChange={e => {
            setSelectedScenarioId(e.target.value);
            // Clear selected item when switching scenarios
            setSelectedItem(null);
          }}
          sx={{ minWidth: 280 }}
          displayEmpty
        >
          {scenarios.map(scenario => (
            <MenuItem key={scenario.id} value={scenario.id}>
              {scenario.name || `Szenario ${scenario.id}`}
              {scenario.baseScenarioId && ' (basiert auf)'}
            </MenuItem>
          ))}
        </Select>
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
            disabled={action.disabled} // <-- Add this line!
          />
        ))}
      </SpeedDial>
      <DataImportModal
        open={modalOpen}
        onClose={handleCloseModal}
        onImport={handleImport}
      />
      <AddItemModal
        open={addItemModalOpen}
        onClose={handleCloseAddItemModal}
        onAdd={handleAddItem}
      />
      <Dialog open={pwDialogOpen} onClose={handlePwDialogClose}>
        <DialogTitle>
          {pwDialogMode === 'save' ? 'Passwort zum Speichern' : 'Passwort zum Laden'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Passwort"
            type={showPw ? 'text' : 'password'}
            fullWidth
            value={pwValue}
            onChange={e => setPwValue(e.target.value)}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="Passwort anzeigen"
                    onClick={() => setShowPw(s => !s)}
                    edge="end"
                  >
                    {showPw ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
          {pwDialogMode === 'save' && (
            <TextField
              margin="dense"
              label="Passwort bestätigen"
              type={showPw ? 'text' : 'password'}
              fullWidth
              value={pwValue2}
              onChange={e => setPwValue2(e.target.value)}
              sx={{ mt: 2 }}
            />
          )}
          {pwError && (
            <Typography color="error" variant="body2" sx={{ mt: 1 }}>
              {pwError}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handlePwDialogClose}>Abbrechen</Button>
          <Button onClick={handlePwDialogSubmit} variant="contained">
            OK
          </Button>
        </DialogActions>
      </Dialog>
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
              onRowClick={handleRowClick}
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

export default SimDatenPage;

