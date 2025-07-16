import { useState } from 'react';
import {
  Box,
  SpeedDial,
  SpeedDialAction,
  Paper,
  SpeedDialIcon,
  Typography,
  Button, // hinzugefügt
} from '@mui/material';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import AddIcon from '@mui/icons-material/Add';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import DataImportModal from '../components/DataImportModal';
import SimDataList from '../components/SimDataList';
import SimDataDetailForm from '../components/SimDataDetailForm';
import JSZip from 'jszip';
import useSimulationDataStore from '../store/simulationDataStore';

function SimDatenPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const simulationData = useSimulationDataStore(state => state.simulationData);
  const groupsLookup = useSimulationDataStore(state => state.groupsLookup);
  const selectedItem = useSimulationDataStore(state => state.selectedItem);

  const setSimulationData = useSimulationDataStore(state => state.setSimulationData);
  const setGroupsLookup = useSimulationDataStore(state => state.setGroupsLookup);
  const setSelectedItem = useSimulationDataStore(state => state.setSelectedItem);
  const clearAllData = useSimulationDataStore(state => state.clearAllData); // Reset all imported data

  const handleOpenModal = () => setModalOpen(true);
  const handleCloseModal = () => setModalOpen(false);

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
    setGroupsLookup(newGroupsLookup);

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
          group: groups,
          booking: bookings
        },
        originalParsedData: JSON.parse(JSON.stringify({
          startdate: kind.AUFNDAT,
          enddate: kind.AUSTRDAT,
          group: groups,
          booking: bookings
        })),
        modifications: [],
        modifiers: {},
        simudata: {}
      });
    }

    // Employees (capacity)
    for (const a of anstellList) {
      const initialBookingTimes = parseZeiten(a.ZEITEN).map(dayTime => ({
        ...dayTime,
        segments: dayTime.segments.map(segment => ({ ...segment, groupId: '' }))
      }));

      processedData.push({
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
        })),
        modifications: [],
        modifiers: {},
        simudata: {}
      });
    }

    setSimulationData(processedData);
  };

  //   setSelectedItem(prev => (prev?.id === item.id ? null : item));
  // };


  const handleImport = async ({ file, isAnonymized }) => {
    await extractZipFile(file, isAnonymized);
    setModalOpen(false);
  };

  const handleRowClick = (item) => {
    if (selectedItem?.id === item.id) {
      console.log('Updated selected item:', null); // Log the updated selected item
      setSelectedItem(null);
    } else {
      console.log('Updated selected item:', item); // Log the updated selected item
      setSelectedItem(item);
    }
  };

  const handleResetData = () => {
    clearAllData(); // Reset all imported data
  };

  const actions = [
    { icon: <FileUploadIcon />, name: 'Import', onClick: handleOpenModal },
    { icon: <AddIcon />, name: 'Add' },
    { icon: <RestartAltIcon />, name: 'Reset', onClick: handleResetData },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#f0f2f5' }}>
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
          />
        ))}
      </SpeedDial>
      <DataImportModal
        open={modalOpen}
        onClose={handleCloseModal}
        onImport={handleImport}
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
              onRowClick={handleRowClick}
              selectedItem={selectedItem}
            />
          </Box>
          <Box sx={{ flex: 1, p: 3, overflow: 'auto', height: '100vh', maxHeight: '100vh' }}>
            {simulationData.length > 0 && selectedItem && (
              <SimDataDetailForm item={selectedItem} allGroups={groupsLookup} />
            )}
          </Box>
        </>
      </Box>
    </Box>
  );
}

export default SimDatenPage;
