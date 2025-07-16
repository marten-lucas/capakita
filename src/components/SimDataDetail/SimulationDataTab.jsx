import { 
  Typography, 
  Box, 
  TextField, 
  Switch, 
  FormControlLabel, 
  Button 
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import GroupCards from './GroupCards';
import BookingCards from './BookingCards';
import ModMonitor from './ModMonitor';
import useSimulationDataStore from '../../store/simulationDataStore';

function SimulationDataTab({ 
  item, 
  allGroups, 
  lastAddedBookingIdx, 
  lastAddedGroupIdx, 
  importedBookingCount, 
  importedGroupCount, 
  handleRestoreBooking 
}) {
  const { updateItemPausedState, getItemPausedState, getItemBookings, updateItemBookings, getItemGroups, updateItemGroups, updateItemDates, getItemDates } = useSimulationDataStore((state) => ({
    updateItemPausedState: state.updateItemPausedState,
    getItemPausedState: state.getItemPausedState,
    getItemBookings: state.getItemBookings,
    updateItemBookings: state.updateItemBookings,
    getItemGroups: state.getItemGroups,
    updateItemGroups: state.updateItemGroups,
    updateItemDates: state.updateItemDates,
    getItemDates: state.getItemDates,
  }));

  const pausedState = getItemPausedState(item.id);
  const bookings = getItemBookings(item.id);
  const groups = getItemGroups(item.id);
  const currentDates = getItemDates(item.id);

  // Convert dates to input format
  const startDate = currentDates?.startdate
    ? currentDates.startdate.split('.').reverse().join('-')
    : '';
  const endDate = currentDates?.enddate
    ? currentDates.enddate.split('.').reverse().join('-')
    : '';

  const initialStartDate = item?.originalParsedData?.startdate ? item.originalParsedData.startdate.split('.').reverse().join('-') : '';
  const initialEndDate = item?.originalParsedData?.enddate ? item.originalParsedData.enddate.split('.').reverse().join('-') : '';

  // Restore-Funktionen
  const handleRestoreStartDate = () => {
    const originalStartDate = item?.originalParsedData?.startdate || '';
    const originalEndDate = currentDates?.enddate || '';
    updateItemDates(item.id, originalStartDate, originalEndDate);
  };
  
  const handleRestoreEndDate = () => {
    const originalEndDate = item?.originalParsedData?.enddate || '';
    const currentStartDate = currentDates?.startdate || '';
    updateItemDates(item.id, currentStartDate, originalEndDate);
  };

  const handlePauseChange = (enabled, start, end) => {
    updateItemPausedState(item.id, enabled, start, end);
  };

  const handleAddBooking = () => {
    const newBooking = {
      startdate: '',
      enddate: '',
      times: []
    };
    updateItemBookings(item.id, [...bookings, newBooking]);
  };

  const handleDeleteBooking = (index) => {
    const updatedBookings = bookings.filter((_, idx) => idx !== index);
    updateItemBookings(item.id, updatedBookings);
  };

  const handleAddGroup = () => {
    const newGroup = {
      id: '',
      name: '',
      start: '',
      end: ''
    };
    updateItemGroups(item.id, [...groups, newGroup]);
  };

  const handleDeleteGroup = (index) => {
    const updatedGroups = groups.filter((_, idx) => idx !== index);
    updateItemGroups(item.id, updatedGroups);
  };

  const handleRestoreGroup = () => {
    const originalGroups = item.originalParsedData?.group || [];
    updateItemGroups(item.id, originalGroups);
  };

  const handleStartDateChange = (newStartDate) => {
    const formattedDate = newStartDate.split('-').reverse().join('.');
    updateItemDates(item.id, formattedDate, currentDates?.enddate || '');
  };

  const handleEndDateChange = (newEndDate) => {
    const formattedDate = newEndDate.split('-').reverse().join('.');
    updateItemDates(item.id, currentDates?.startdate || '', formattedDate);
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
          onChange={(e) => handleStartDateChange(e.target.value)}
          sx={{ width: 150 }}
        />
        <ModMonitor
          itemId={item.id}
          field="startdate"
          value={startDate}
          originalValue={initialStartDate}
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
          onChange={(e) => handleEndDateChange(e.target.value)}
          sx={{ width: 150 }}
        />
        <ModMonitor
          itemId={item.id}
          field="enddate"
          value={endDate}
          originalValue={initialEndDate}
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
              itemId={item.id}
              field="bookings"
              value={JSON.stringify(bookings)}
              originalValue={JSON.stringify(item.originalParsedData?.booking || [])}
              onRestore={() => {
                updateItemBookings(item.id, JSON.parse(JSON.stringify(item.originalParsedData?.booking || [])));
              }}
              title="Alle Buchungen auf importierte Werte zurücksetzen"
              confirmMsg="Alle Buchungen auf importierten Wert zurücksetzen?"
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
        itemId={item.id}
        type={item.type}
        allGroups={allGroups}
        lastAddedIndex={lastAddedBookingIdx}
        importedCount={importedBookingCount}
        originalBookings={item?.originalParsedData?.booking}
        onRestoreBooking={handleRestoreBooking}
        onDelete={handleDeleteBooking} // Pass handleDeleteBooking
      />
      <Box display="flex" alignItems="center" gap={2} sx={{ mt: 2, mb: 1 }}>
        <Typography variant="h6" sx={{ flex: 1 }}>
          Gruppen:
          {(
            <ModMonitor
              itemId={item.id}
              field="groups"
              value={JSON.stringify(groups)}
              originalValue={JSON.stringify(item.originalParsedData?.group || [])}
              onRestore={() => updateItemGroups(item.id, JSON.parse(JSON.stringify(item.originalParsedData?.group || [])))}
              title="Alle Gruppen auf importierte Werte zurücksetzen"
              confirmMsg="Alle Gruppen auf importierten Wert zurücksetzen?"
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
        itemId={item.id}
        groups={groups}
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


