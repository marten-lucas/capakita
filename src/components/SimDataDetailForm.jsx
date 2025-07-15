import {
  Typography, Box, Tabs, Tab, TextField, Paper, Accordion, AccordionSummary, AccordionDetails, Switch, Slider, Divider, Radio, RadioGroup, FormControlLabel, FormControl, FormLabel, Select, MenuItem, InputLabel, Button
} from '@mui/material';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CommentIcon from '@mui/icons-material/Comment';
import DataObjectIcon from '@mui/icons-material/DataObject';
import AddIcon from '@mui/icons-material/Add';
import { useState, useEffect } from 'react';
import GroupCards from './SimDataDetail/GroupCards';
import BookingCards from './SimDataDetail/BookingCards';
import ModMonitor from './SimDataDetail/ModMonitor';

function SimDataDetailForm({ item, allGroups }) {
  const [tab, setTab] = useState(0);
  const [startDate, setStartDate] = useState(
    item?.parseddata?.startdate
      ? item.parseddata.startdate.split('.').reverse().join('-')
      : ''
  );
  const [endDate, setEndDate] = useState(
    item?.parseddata?.enddate
      ? item.parseddata.enddate.split('.').reverse().join('-')
      : ''
  );
  // --- Pause State ---
  const [pauseEnabled, setPauseEnabled] = useState(false);
  const [pauseStart, setPauseStart] = useState('');
  const [pauseEnd, setPauseEnd] = useState('');
  const [localItem, setLocalItem] = useState(item);
  const [lastAddedBookingIdx, setLastAddedBookingIdx] = useState(null);
  const [lastAddedGroupIdx, setLastAddedGroupIdx] = useState(null);
  const [importedBookingCount, setImportedBookingCount] = useState(0);
  const [importedGroupCount, setImportedGroupCount] = useState(0);

  const initialStartDate = item?.parseddata?.startdate ? item.parseddata.startdate.split('.').reverse().join('-') : '';
  const initialEndDate = item?.parseddata?.enddate ? item.parseddata.enddate.split('.').reverse().join('-') : '';

  // Update local state if item changes
  useEffect(() => {
    setStartDate(initialStartDate);
    setEndDate(initialEndDate);
  }, [item, initialStartDate, initialEndDate]);

  useEffect(() => {
    setLocalItem(item);
    setLastAddedBookingIdx(null);
    setLastAddedGroupIdx(null);

    // Zähle importierte Buchungen/Gruppen (aus Adebis)
    if (item?.rawdata?.source === 'adebis export') {
      setImportedBookingCount(Array.isArray(item?.originalParsedData?.booking) ? item.originalParsedData.booking.length : 0);
      setImportedGroupCount(Array.isArray(item?.originalParsedData?.group) ? item.originalParsedData.group.length : 0);
    } else {
      setImportedBookingCount(0);
      setImportedGroupCount(0);
    }
  }, [item]);

  // Buchungszeitraum hinzufügen
  const handleAddBooking = () => {
    setLocalItem(prev => {
      if (!prev) return prev;
      const newBooking = {
        startdate: '',
        enddate: '',
        times: []
      };
      const newBookings = [...(prev.parseddata?.booking || []), newBooking];
      setLastAddedBookingIdx(newBookings.length - 1);
      return {
        ...prev,
        parseddata: {
          ...prev.parseddata,
          booking: newBookings
        }
      };
    });
  };

  // Buchungszeitraum löschen
  const handleDeleteBooking = (idx) => {
    setLocalItem(prev => {
      if (!prev) return prev;
      const bookings = prev.parseddata?.booking || [];
      if (bookings.length <= idx) return prev;
      const newBookings = bookings.slice(0, idx).concat(bookings.slice(idx + 1));
      return {
        ...prev,
        parseddata: {
          ...prev.parseddata,
          booking: newBookings
        }
      };
    });
    setLastAddedBookingIdx(null);
  };

  // Gruppe hinzufügen
  const handleAddGroup = () => {
    setLocalItem(prev => {
      if (!prev) return prev;
      const newGroup = {
        id: '',
        name: '',
        start: '',
        end: ''
      };
      const newGroups = [...(prev.parseddata?.group || []), newGroup];
      setLastAddedGroupIdx(newGroups.length - 1);
      return {
        ...prev,
        parseddata: {
          ...prev.parseddata,
          group: newGroups
        }
      };
    });
  };

  // Gruppe löschen
  const handleDeleteGroup = (idx) => {
    setLocalItem(prev => {
      if (!prev) return prev;
      const groups = prev.parseddata?.group || [];
      if (groups.length <= idx) return prev;
      const newGroups = groups.slice(0, idx).concat(groups.slice(idx + 1));
      return {
        ...prev,
        parseddata: {
          ...prev.parseddata,
          group: newGroups
        }
      };
    });
    setLastAddedGroupIdx(null);
  };

  // Restore-Funktionen
  const handleRestoreStartDate = () => {
    setStartDate(initialStartDate);
  };
  const handleRestoreEndDate = () => {
    setEndDate(initialEndDate);
  };

  const handleRestoreBooking = (idx) => {
    if (!item?.originalParsedData?.booking) return;
    setLocalItem(prev => {
      if (!prev) return prev;
      const orig = item.originalParsedData.booking[idx];
      if (!orig) return prev;
      const newBookings = [...(prev.parseddata?.booking || [])];
      newBookings[idx] = JSON.parse(JSON.stringify(orig));
      return {
        ...prev,
        parseddata: {
          ...prev.parseddata,
          booking: newBookings
        }
      };
    });
  };

  const handleRestoreGroup = (idx) => {
    if (!item?.originalParsedData?.group) return;
    setLocalItem(prev => {
      if (!prev) return prev;
      const orig = item.originalParsedData.group[idx];
      if (!orig) return prev;
      const newGroups = [...(prev.parseddata?.group || [])];
      newGroups[idx] = JSON.parse(JSON.stringify(orig));
      return {
        ...prev,
        parseddata: {
          ...prev.parseddata,
          group: newGroups
        }
      };
    });
  };

  // Guard: Wenn localItem nicht gesetzt, Hinweis anzeigen und return
  if (!localItem) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Typography color="text.secondary">
          Wählen Sie einen Eintrag aus, um Details anzuzeigen.
        </Typography>
      </Box>
    );
  }


  return (
    <Box
      bgcolor="background.paper"
      boxShadow={3}
      borderRadius={2}
      p={3}
      height="90%"
      display="flex"
      flexDirection="column"
      overflow="auto"
    >
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="fullWidth"
        sx={{ mb: 2 }}
      >
        <Tab icon={<CalendarTodayIcon />} label="Simulationsdaten" />
        <Tab icon={<CommentIcon />} label="Modifikationen" />
        <Tab icon={<DataObjectIcon />} label="Rohdaten" />
      </Tabs>
      {tab === 0 && (
        <Box flex={1} display="flex" flexDirection="column" gap={2} sx={{ overflowY: 'auto' }}>
          {/* Wiederhergestellte Datumsfelder für den Datensatz */}
          <Box display="flex" alignItems="center" gap={2} sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ minWidth: 90 }}>Zeitraum von</Typography>
            <TextField
              label=""
              type="date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              sx={{ width: 150 }}
            />
            <ModMonitor
              value={startDate}
              originalValue={item?.originalParsedData?.startdate ? item.originalParsedData.startdate.split('.').reverse().join('-') : ''}
              onRestore={handleRestoreStartDate}
              title="Startdatum auf importierten Wert zurücksetzen"
              confirmMsg="Startdatum auf importierten Wert zurücksetzen?"
            />
            <Typography variant="body2" sx={{ minWidth: 24, textAlign: 'center' }}>bis</Typography>
            <TextField
              label=""
              type="date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              sx={{ width: 150 }}
            />
            <ModMonitor
              value={endDate}
              originalValue={item?.originalParsedData?.enddate ? item.originalParsedData.enddate.split('.').reverse().join('-') : ''}
              onRestore={handleRestoreEndDate}
              title="Enddatum auf importierten Wert zurücksetzen"
              confirmMsg="Enddatum auf importierten Wert zurücksetzen?"
            />
          </Box>
          <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <FormControlLabel
              control={
                <Switch
                  checked={pauseEnabled}
                  onChange={e => setPauseEnabled(e.target.checked)}
                />
              }
              label="Pausieren"
              sx={{ ml: 0 }}
            />
            {pauseEnabled && (
              <Box display="flex" alignItems="center" gap={1} sx={{ mt: 1 }}>
                <TextField
                  label="von"
                  type="date"
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  value={pauseStart}
                  onChange={e => setPauseStart(e.target.value)}
                  sx={{ width: 130 }}
                />
                <Typography variant="body2" sx={{ minWidth: 24, textAlign: 'center' }}>bis</Typography>
                <TextField
                  label="bis"
                  type="date"
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  value={pauseEnd}
                  onChange={e => setPauseEnd(e.target.value)}
                  sx={{ width: 130 }}
                />
              </Box>
            )}
          </Box>
          <Box display="flex" alignItems="center" gap={2} sx={{ mb: 1 }}>
            <Typography variant="h6" sx={{ mt: 1, mb: 1, flex: 1 }}>
              Buchungszeiten:
              {(
                <ModMonitor
                  value={JSON.stringify(localItem.parseddata?.booking)}
                  originalValue={JSON.stringify(item.originalParsedData?.booking || [])}
                  onRestore={() => {
                    setLocalItem(prev => ({
                      ...prev,
                      parseddata: {
                        ...prev.parseddata,
                        booking: JSON.parse(JSON.stringify(item.originalParsedData?.booking || []))
                      }
                    }));
                  }}
                  title="Alle Buchungen auf importierte Werte zurücksetzen"
                  confirmMsg="Alle Buchungen auf importierte Adebis-Daten zurücksetzen?"
                />
              )}
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={handleAddBooking}
            >
              Buchungszeitraum hinzufügen
            </Button>
          </Box>
          <BookingCards
            bookings={localItem.parseddata?.booking}
            type={localItem.type}
            allGroups={allGroups}
            lastAddedIndex={lastAddedBookingIdx}
            onDelete={handleDeleteBooking}
            importedCount={importedBookingCount}
            originalBookings={item?.originalParsedData?.booking}
            onRestoreBooking={handleRestoreBooking}
          />
          <Box display="flex" alignItems="center" gap={2} sx={{ mt: 2, mb: 1 }}>
            <Typography variant="h6" sx={{ flex: 1 }}>
              Gruppen:
              {(
                <ModMonitor
                  value={JSON.stringify(localItem.parseddata?.group)}
                  originalValue={JSON.stringify(item.originalParsedData?.group || [])}
                  onRestore={() => {
                    setLocalItem(prev => ({
                      ...prev,
                      parseddata: {
                        ...prev.parseddata,
                        group: JSON.parse(JSON.stringify(item.originalParsedData?.group || []))
                      }
                    }));
                  }}
                  title="Alle Gruppen auf importierte Werte zurücksetzen"
                  confirmMsg="Alle Gruppen auf importierte Adebis-Daten zurücksetzen?"
                />
              )}
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={handleAddGroup}
            >
              Gruppe hinzufügen
            </Button>
          </Box>
          <GroupCards
            groups={localItem.parseddata?.group}
            allGroups={allGroups}
            lastAddedIndex={lastAddedGroupIdx}
            onDelete={handleDeleteGroup}
            importedCount={importedGroupCount}
            originalGroups={item?.originalParsedData?.group}
            onRestoreGroup={handleRestoreGroup}
          />
        </Box>
      )}
      {tab === 1 && (
        <Box flex={1} display="flex" flexDirection="column">
          <Typography variant="body2" color="text.secondary">
            Buchungen:
          </Typography>
          <pre style={{ fontSize: 12, marginTop: 8, flex: 1 }}>
            {JSON.stringify(item.parseddata?.buchungen, null, 2)}
          </pre>
        </Box>
      )}
      {tab === 2 && (
        <Box flex={1} display="flex" flexDirection="column">
          <Typography variant="body2" color="text.secondary">
            Rohdaten:
          </Typography>
          <pre style={{ fontSize: 12, marginTop: 8, flex: 1 }}>
            {JSON.stringify(item.rawdata, null, 2)}
          </pre>
        </Box>
      )}
    </Box>
  );
}



export default SimDataDetailForm;
