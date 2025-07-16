import { 
  Typography, 
  Box, 
  TextField, 
  Switch, 
  FormControlLabel, 
  Button 
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useState, useEffect } from 'react';
import GroupCards from './GroupCards';
import BookingCards from './BookingCards';
import ModMonitor from './ModMonitor';
import useSimulationDataStore from '../../store/simulationDataStore';

function SimulationDataTab({ 
  item, 
  localItem, 
  setLocalItem, 
  allGroups, 
  lastAddedBookingIdx, 
  lastAddedGroupIdx, 
  importedBookingCount, 
  importedGroupCount, 
  handleAddBooking, 
  handleDeleteBooking, 
  handleAddGroup, 
  handleDeleteGroup, 
  handleRestoreBooking, 
  handleRestoreGroup 
}) {
  const { updateItemPausedState, getItemPausedState } = useSimulationDataStore((state) => ({
    updateItemPausedState: state.updateItemPausedState,
    getItemPausedState: state.getItemPausedState,
  }));

  const pausedState = getItemPausedState(item.id);

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

  const initialStartDate = item?.parseddata?.startdate ? item.parseddata.startdate.split('.').reverse().join('-') : '';
  const initialEndDate = item?.parseddata?.enddate ? item.parseddata.enddate.split('.').reverse().join('-') : '';

  // Update local state if item changes
  useEffect(() => {
    setStartDate(initialStartDate);
    setEndDate(initialEndDate);
  }, [item, initialStartDate, initialEndDate]);

  // Restore-Funktionen
  const handleRestoreStartDate = () => {
    setStartDate(initialStartDate);
  };
  const handleRestoreEndDate = () => {
    setEndDate(initialEndDate);
  };

  const handlePauseChange = (enabled, start, end) => {
    updateItemPausedState(item.id, enabled, start, end);
  };

  const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format

  return (
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
              checked={pausedState.enabled}
              onChange={(e) => handlePauseChange(e.target.checked, pausedState.start, pausedState.end)}
            />
          }
          label="Pausieren"
          sx={{ ml: 0 }}
        />
        {pausedState.enabled && (
          <Box display="flex" alignItems="center" gap={1} sx={{ mt: 1 }}>
            <TextField
              label="von"
              type="date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={pausedState.start}
              onChange={(e) => handlePauseChange(pausedState.enabled, e.target.value, pausedState.end)}
              sx={{ width: 130 }}
              inputProps={{ min: today }} // Restrict to future dates
            />
            <Typography variant="body2" sx={{ minWidth: 24, textAlign: 'center' }}>bis</Typography>
            <TextField
              label="bis"
              type="date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={pausedState.end}
              onChange={(e) => handlePauseChange(pausedState.enabled, pausedState.start, e.target.value)}
              sx={{ width: 130 }}
              inputProps={{ min: today }} // Restrict to future dates
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
  );
}

export default SimulationDataTab;
