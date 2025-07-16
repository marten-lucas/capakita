import {
  Typography, Box, Tabs, Tab, Paper
} from '@mui/material';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CommentIcon from '@mui/icons-material/Comment';
import DataObjectIcon from '@mui/icons-material/DataObject';
import { useState, useEffect } from 'react';
import SimulationDataTab from './SimDataDetail/SimulationDataTab';
import ModificationsTab from './SimDataDetail/ModificationsTab';
import useSimulationDataStore from '../store/simulationDataStore';

function SimDataDetailForm({ item, allGroups }) {
  const updateItemDates = useSimulationDataStore(state => state.updateItemDates); // Move hook call to top

  const [tab, setTab] = useState(0);
  const [localItem, setLocalItem] = useState(item);
  const [lastAddedBookingIdx, setLastAddedBookingIdx] = useState(null);
  const [lastAddedGroupIdx, setLastAddedGroupIdx] = useState(null);
  const [importedBookingCount, setImportedBookingCount] = useState(0);
  const [importedGroupCount, setImportedGroupCount] = useState(0);

  // Update local state if item changes
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
        <SimulationDataTab 
          item={item}
          allGroups={allGroups}
          lastAddedBookingIdx={lastAddedBookingIdx}
          lastAddedGroupIdx={lastAddedGroupIdx}
          importedBookingCount={importedBookingCount}
          importedGroupCount={importedGroupCount}
          updateItemDates={updateItemDates} // Pass updateItemDates directly
        />
      )}
      {tab === 1 && (
        <ModificationsTab item={item} />
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

