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
import SimDataGeneralTab from './SimDataGeneralTab';
import SimDataBookingTab from './SimDataBookingTab';
import SimDataGroupsTab from './SimDataGroupsTab';
import useSimScenarioDataStore from '../../store/simScenarioStore';

function SimulationDataTab({ 
  item, 
  lastAddedBookingIdx, 
  lastAddedGroupIdx, 
  importedBookingCount, 
  importedGroupCount}) {
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
    setSelectedItem,
    getQualiDefs
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
    getQualiDefs: state.getQualiDefs,
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


  // Lokaler State für Name und Bemerkungen
  const [, setLocalName] = useState(itemName);
  const [, setLocalNote] = useState(itemNote);
  const [, setLocalGeburtsdatum] = useState(geburtsdatum);
  const [, setLocalQualification] = useState(itemQualification);

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

  // Get scenario-based qualidefs for radio options
  const qualiDefs = getQualiDefs ? getQualiDefs() : [];

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
        <SimDataGeneralTab
          item={item}
          pausedState={pausedState}
          startDate={startDate}
          endDate={endDate}
          initialStartDate={initialStartDate}
          initialEndDate={initialEndDate}
          geburtsdatum={geburtsdatum}
          initialGeburtsdatum={initialGeburtsdatum}
          itemName={itemName}
          itemNote={itemNote}
          itemQualification={itemQualification}
          initialQualification={initialQualification}
          qualiDefs={qualiDefs}
          isManualEntry={isManualEntry}
          handleDeleteItem={handleDeleteItem}
          handleGeburtsdatumChange={handleGeburtsdatumChange}
          handleRestoreGeburtsdatum={handleRestoreGeburtsdatum}
          handleRestoreQualification={handleRestoreQualification}
          handleStartDateChange={handleStartDateChange}
          handleEndDateChange={handleEndDateChange}
          handleRestoreStartDate={handleRestoreStartDate}
          handleRestoreEndDate={handleRestoreEndDate}
          handlePauseChange={handlePauseChange}
          updateItemName={updateItemName}
          updateItemNote={updateItemNote}
          updateItemQualification={updateItemQualification}
        />
      )}
      {activeTab === 1 && (
        <SimDataBookingTab
          item={item}
          bookings={bookings}
          lastAddedBookingIdx={lastAddedBookingIdx}
          importedBookingCount={importedBookingCount}
          handleAddBooking={handleAddBooking}
          handleDeleteBooking={handleDeleteBooking}
          handleRestoreBooking={updateItemBookings}
        />
      )}
      {activeTab === 2 && (
        <SimDataGroupsTab
          item={item}
          groups={groups}
          lastAddedGroupIdx={lastAddedGroupIdx}
          importedGroupCount={importedGroupCount}
          handleAddGroup={handleAddGroup}
          handleDeleteGroup={handleDeleteGroup}
          handleRestoreGroup={handleRestoreGroup}
        />
      )}
    </Box>
  );
}

export default SimulationDataTab;
   