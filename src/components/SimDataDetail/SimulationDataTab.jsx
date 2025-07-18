import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Box, 
  TextField, 
  Switch, 
  FormControlLabel, 
  Button,
  FormControl,
  FormLabel,
  RadioGroup,
  Radio,
  Tabs,
  Tab
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonIcon from '@mui/icons-material/Person';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import GroupIcon from '@mui/icons-material/Group';
import GroupCards from './GroupCards';
import BookingCards from './BookingCards';
import ModMonitor from './ModMonitor';
import useSimScenarioDataStore from '../../store/simScenarioStore';

function SimulationDataTab({ 
  item, 
  lastAddedBookingIdx, 
  lastAddedGroupIdx, 
  importedBookingCount, 
  importedGroupCount, 
  handleRestoreBooking}) {
  const [activeTab, setActiveTab] = useState(0);

  const { 
    updateItemPausedState, 
    getItemPausedState, 
    getItemBookings, 
    updateItemBookings, 
    getItemGroups, 
    updateItemGroups, 
    updateItemDates, 
    getItemDates,
    updateItemName,
    getItemName,
    updateItemNote,
    getItemNote,
    updateItemGeburtsdatum,
    getItemGeburtsdatum,
    updateItemQualification,
    getItemQualification,
    deleteItem,
    setSelectedItem
  } = useSimScenarioDataStore((state) => ({
    updateItemPausedState: state.updateItemPausedState,
    getItemPausedState: state.getItemPausedState,
    getItemBookings: state.getItemBookings,
    updateItemBookings: state.updateItemBookings,
    getItemGroups: state.getItemGroups,
    updateItemGroups: state.updateItemGroups,
    updateItemDates: state.updateItemDates,
    getItemDates: state.getItemDates,
    updateItemName: state.updateItemName,
    getItemName: state.getItemName,
    updateItemNote: state.updateItemNote,
    getItemNote: state.getItemNote,
    updateItemGeburtsdatum: state.updateItemGeburtsdatum,
    getItemGeburtsdatum: state.getItemGeburtsdatum,
    updateItemQualification: state.updateItemQualification,
    getItemQualification: state.getItemQualification,
    deleteItem: state.deleteItem,
    getEffectiveSimulationData: state.getEffectiveSimulationData,
    selectedItem: state.selectedItem,
    setSelectedItem: state.setSelectedItem,
  }));

  const pausedState = getItemPausedState(item.id);
  const bookings = getItemBookings(item.id);
  const groups = getItemGroups(item.id);
  const currentDates = getItemDates(item.id);
  const itemNameFromStore = getItemName ? getItemName(item.id) : '';
  const itemName = itemNameFromStore || item.name || '';
  const itemNoteFromStore = getItemNote ? getItemNote(item.id) : '';
  const itemNote = itemNoteFromStore || item.note || '';

  // Convert dates to input format
  const startDate = currentDates?.startdate
    ? currentDates.startdate.split('.').reverse().join('-')
    : '';
  const endDate = currentDates?.enddate
    ? currentDates.enddate.split('.').reverse().join('-')
    : '';

  const initialStartDate = item?.originalParsedData?.startdate ? item.originalParsedData.startdate.split('.').reverse().join('-') : '';
  const initialEndDate = item?.originalParsedData?.enddate ? item.originalParsedData.enddate.split('.').reverse().join('-') : '';

  const itemGeburtsdatumFromStore = getItemGeburtsdatum ? getItemGeburtsdatum(item.id) : '';
  const itemGeburtsdatum = itemGeburtsdatumFromStore || '';
  
  // Convert geburtsdatum to input format
  const geburtsdatum = itemGeburtsdatum
    ? itemGeburtsdatum.split('.').reverse().join('-')
    : '';
  
  const initialGeburtsdatum = item?.originalParsedData?.geburtsdatum ? item.originalParsedData.geburtsdatum.split('.').reverse().join('-') : '';

  const itemQualificationFromStore = getItemQualification ? getItemQualification(item.id) : '';
  const itemQualification = itemQualificationFromStore || '';
  const initialQualification = item?.originalParsedData?.qualification || '';

  // Check if item is manually added
  const isManualEntry = item?.rawdata?.source === 'manual entry';

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
    const updatedGroups = [...groups, newGroup];
    updateItemGroups(item.id, updatedGroups);
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

  // Lokaler State für Name und Bemerkungen
  const [localName, setLocalName] = useState(itemName);
  const [localNote, setLocalNote] = useState(itemNote);
  const [localGeburtsdatum, setLocalGeburtsdatum] = useState(geburtsdatum);
  const [localQualification, setLocalQualification] = useState(itemQualification);

  // Synchronisiere lokalen State, wenn Item wechselt
  useEffect(() => { setLocalName(itemName); }, [itemName]);
  useEffect(() => { setLocalNote(itemNote); }, [itemNote]);
  useEffect(() => { setLocalGeburtsdatum(geburtsdatum); }, [geburtsdatum]);
  useEffect(() => { setLocalQualification(itemQualification); }, [itemQualification]);

  const handleGeburtsdatumChange = (newGeburtsdatum) => {
    const formattedDate = newGeburtsdatum.split('-').reverse().join('.');
    updateItemGeburtsdatum(item.id, formattedDate);
  };

  const handleRestoreGeburtsdatum = () => {
    const originalGeburtsdatum = item?.originalParsedData?.geburtsdatum || '';
    updateItemGeburtsdatum(item.id, originalGeburtsdatum);
  };

  const handleRestoreQualification = () => {
    const originalQualification = item?.originalParsedData?.qualification || '';
    updateItemQualification(item.id, originalQualification);
  };

  const handleDeleteItem = () => {
    if (window.confirm(`Möchten Sie "${item.name}" wirklich löschen?`)) {
      deleteItem(item.id);
      setSelectedItem(null);
    }
  };

  // Allgemein Tab Content
  const AllgemeinTab = () => (
    <Box flex={1} display="flex" flexDirection="column" gap={2} sx={{ overflowY: 'auto' }}>
      {/* Delete button for manually added items */}
      {isManualEntry && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleDeleteItem}
            size="small"
          >
            Eintrag löschen
          </Button>
        </Box>
      )}

      {/* Editable Name and Note Fields */}
      <Box display="flex" alignItems="center" gap={2} sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ minWidth: 90 }}>Name</Typography>
        <TextField
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          onBlur={() => updateItemName(item.id, localName)}
          size="small"
          sx={{ width: 300 }}
          InputLabelProps={{ shrink: true }}
        />
        <Typography variant="body2" sx={{ minWidth: 90 }}>Bemerkungen</Typography>
        <TextField
          value={localNote}
          onChange={(e) => setLocalNote(e.target.value)}
          onBlur={() => updateItemNote(item.id, localNote)}
          size="small"
          sx={{ width: 300 }}
          multiline
          minRows={2}
          maxRows={4}
          InputLabelProps={{ shrink: true }}
        />
      </Box>

      {/* Geburtsdatum nur für Kinder (demand) */}
      {item.type === 'demand' && (
        <Box display="flex" alignItems="center" gap={2} sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ minWidth: 90 }}>Geburtsdatum</Typography>
          <TextField
            type="date"
            value={localGeburtsdatum}
            onChange={(e) => setLocalGeburtsdatum(e.target.value)}
            onBlur={() => handleGeburtsdatumChange(localGeburtsdatum)}
            size="small"
            sx={{ width: 150 }}
            InputLabelProps={{ shrink: true }}
          />
          <ModMonitor
            itemId={item.id}
            field="geburtsdatum"
            value={localGeburtsdatum}
            originalValue={initialGeburtsdatum}
            onRestore={handleRestoreGeburtsdatum}
            title="Geburtsdatum auf importierten Wert zurücksetzen"
            confirmMsg="Geburtsdatum auf importierten Wert zurücksetzen?"
          />
        </Box>
      )}

      {/* Qualifikation nur für Mitarbeiter (capacity) */}
      {item.type === 'capacity' && (
        <Box sx={{ mb: 2 }}>
          <FormControl component="fieldset">
            <Box display="flex" alignItems="center" gap={1}>
              <FormLabel component="legend">Qualifikation</FormLabel>
              <ModMonitor
                itemId={item.id}
                field="qualification"
                value={localQualification}
                originalValue={initialQualification}
                onRestore={handleRestoreQualification}
                title="Qualifikation auf importierten Wert zurücksetzen"
                confirmMsg="Qualifikation auf importierten Wert zurücksetzen?"
              />
            </Box>
            <RadioGroup
              row
              value={localQualification}
              onChange={(e) => setLocalQualification(e.target.value)}
              onBlur={() => updateItemQualification(item.id, localQualification)}
            >
              <FormControlLabel value="E" control={<Radio />} label="Erzieher (E)" />
              <FormControlLabel value="K" control={<Radio />} label="Kinderpfleger (K)" />
              <FormControlLabel value="H" control={<Radio />} label="Hilfskraft (H)" />
              <FormControlLabel value="P" control={<Radio />} label="Praktikant (P)" />
              <FormControlLabel value="" control={<Radio />} label="Keine Qualifikation" />
            </RadioGroup>
          </FormControl>
        </Box>
      )}

      {/* Zeitraum */}
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

      {/* Pausieren */}
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
              inputProps={{ min: today }}
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
              inputProps={{ min: today }}
            />
          </Box>
        )}
      </Box>
    </Box>
  );

  // Zeiten Tab Content
  const ZeitenTab = () => (
    <Box flex={1} display="flex" flexDirection="column" gap={2} sx={{ overflowY: 'auto' }}>
      <Box display="flex" alignItems="center" gap={2} sx={{ mb: 1 }}>
        <Typography variant="h6" sx={{ mt: 1, mb: 1, flex: 1 }}>
          Buchungszeiten:
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
        lastAddedIndex={lastAddedBookingIdx}
        importedCount={importedBookingCount}
        originalBookings={item?.originalParsedData?.booking}
        onRestoreBooking={handleRestoreBooking}
        onDelete={handleDeleteBooking}
        isManualEntry={isManualEntry}
      />
    </Box>
  );

  // Gruppen Tab Content
  const GruppenTab = () => (
    <Box flex={1} display="flex" flexDirection="column" gap={2} sx={{ overflowY: 'auto' }}>
      <Box display="flex" alignItems="center" gap={2} sx={{ mt: 2, mb: 1 }}>
        <Typography variant="h6" sx={{ flex: 1 }}>
          Gruppen:
          <ModMonitor
            itemId={item.id}
            field="groups"
            value={JSON.stringify(groups)}
            originalValue={JSON.stringify(item.originalParsedData?.group || [])}
            onRestore={() => updateItemGroups(item.id, JSON.parse(JSON.stringify(item.originalParsedData?.group || [])))}
            title="Alle Gruppen auf importierte Werte zurücksetzen"
            confirmMsg="Alle Gruppen auf importierten Wert zurücksetzen?"
          />
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
        lastAddedIndex={lastAddedGroupIdx}
        onDelete={handleDeleteGroup}
        importedCount={importedGroupCount}
        originalGroups={item?.originalParsedData?.group}
        onRestoreGroup={handleRestoreGroup}
        isManualEntry={isManualEntry}
      />
    </Box>
  );

  return (
    <Box flex={1} display="flex" flexDirection="column">
      <Tabs
        value={activeTab}
        onChange={(_, newTab) => setActiveTab(newTab)}
        variant="fullWidth"
        sx={{ mb: 2 }}
      >
        <Tab icon={<PersonIcon />} label="Allgemein" />
        <Tab icon={<AccessTimeIcon />} label="Zeiten" />
        <Tab icon={<GroupIcon />} label="Gruppen" />
      </Tabs>
      
      {activeTab === 0 && (
        <Box flex={1} display="flex" flexDirection="column" gap={2} sx={{ overflowY: 'auto' }}>
          {/* Delete button for manually added items */}
          {isManualEntry && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={handleDeleteItem}
                size="small"
              >
                Eintrag löschen
              </Button>
            </Box>
          )}

          {/* Editable Name and Note Fields */}
          <Box display="flex" alignItems="center" gap={2} sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ minWidth: 90 }}>Name</Typography>
            <TextField
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              onBlur={() => updateItemName(item.id, localName)}
              size="small"
              sx={{ width: 300 }}
              InputLabelProps={{ shrink: true }}
            />
            <Typography variant="body2" sx={{ minWidth: 90 }}>Bemerkungen</Typography>
            <TextField
              value={localNote}
              onChange={(e) => setLocalNote(e.target.value)}
              onBlur={() => updateItemNote(item.id, localNote)}
              size="small"
              sx={{ width: 300 }}
              multiline
              minRows={2}
              maxRows={4}
              InputLabelProps={{ shrink: true }}
            />
          </Box>

          {/* Geburtsdatum nur für Kinder (demand) */}
          {item.type === 'demand' && (
            <Box display="flex" alignItems="center" gap={2} sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ minWidth: 90 }}>Geburtsdatum</Typography>
              <TextField
                type="date"
                value={localGeburtsdatum}
                onChange={(e) => setLocalGeburtsdatum(e.target.value)}
                onBlur={() => handleGeburtsdatumChange(localGeburtsdatum)}
                size="small"
                sx={{ width: 150 }}
                InputLabelProps={{ shrink: true }}
              />
              <ModMonitor
                itemId={item.id}
                field="geburtsdatum"
                value={localGeburtsdatum}
                originalValue={initialGeburtsdatum}
                onRestore={handleRestoreGeburtsdatum}
                title="Geburtsdatum auf importierten Wert zurücksetzen"
                confirmMsg="Geburtsdatum auf importierten Wert zurücksetzen?"
              />
            </Box>
          )}

          {/* Qualifikation nur für Mitarbeiter (capacity) */}
          {item.type === 'capacity' && (
            <Box sx={{ mb: 2 }}>
              <FormControl component="fieldset">
                <Box display="flex" alignItems="center" gap={1}>
                  <FormLabel component="legend">Qualifikation</FormLabel>
                  <ModMonitor
                    itemId={item.id}
                    field="qualification"
                    value={localQualification}
                    originalValue={initialQualification}
                    onRestore={handleRestoreQualification}
                    title="Qualifikation auf importierten Wert zurücksetzen"
                    confirmMsg="Qualifikation auf importierten Wert zurücksetzen?"
                  />
                </Box>
                <RadioGroup
                  row
                  value={localQualification}
                  onChange={(e) => setLocalQualification(e.target.value)}
                  onBlur={() => updateItemQualification(item.id, localQualification)}
                >
                  <FormControlLabel value="E" control={<Radio />} label="Erzieher (E)" />
                  <FormControlLabel value="K" control={<Radio />} label="Kinderpfleger (K)" />
                  <FormControlLabel value="H" control={<Radio />} label="Hilfskraft (H)" />
                  <FormControlLabel value="P" control={<Radio />} label="Praktikant (P)" />
                  <FormControlLabel value="" control={<Radio />} label="Keine Qualifikation" />
                </RadioGroup>
              </FormControl>
            </Box>
          )}

          {/* Zeitraum */}
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

          {/* Pausieren */}
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
                  inputProps={{ min: today }}
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
                  inputProps={{ min: today }}
                />
              </Box>
            )}
          </Box>
        </Box>
      )}
      {activeTab === 1 && <ZeitenTab />}
      {activeTab === 2 && <GruppenTab />}
    </Box>
  );
}

export default SimulationDataTab;



