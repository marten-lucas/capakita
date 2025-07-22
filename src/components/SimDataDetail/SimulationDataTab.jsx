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
import EuroIcon from '@mui/icons-material/Euro';
import BugReportIcon from '@mui/icons-material/BugReport'; // Add icon for debug tab
import SimDataGeneralTab from './SimDataGeneralTab';
import SimDataBookingTab from './SimDataBookingTab';
import SimDataGroupsTab from './SimDataGroupsTab';
import SimDataFinanceTab from './SimDataFinanceTab';

function SimulationDataTab({ 
  item, 
  scenarioId,
  simDataStore,
  simGroupStore,
  simBookingStore,
  simFinancialsStore,
  simQualificationStore,
  lastAddedBookingIdx, 
  lastAddedGroupIdx, 
  importedBookingCount, 
  importedGroupCount
}) {
  const [activeTab, setActiveTab] = useState(0);

  // Only use functions that exist on simDataStore
  const {
    getItemAbsenceStateList,
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
    getQualiDefs,
    updateDataItem // <-- Use this for updating fields
  } = simDataStore;

  // Use scenarioId when calling getItemAbsenceStateList
  const absenceStateList = getItemAbsenceStateList
    ? getItemAbsenceStateList(scenarioId, item.id) || []
    : [];

  // Use simGroupStore for groups
  const allGroups = simGroupStore.getGroups(scenarioId) || [];
  // Find groups for this item by matching group IDs in item.parseddata.group
  const groups = item.parseddata?.group || [];

  // --- FIX: getItemDates is not a function on simDataStore, so get dates from item.parseddata ---
  const currentDates = {
    startdate: item.parseddata?.startdate || '',
    enddate: item.parseddata?.enddate || ''
  };
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

  const handleAbsenceChange = (enabled, start, end) => {
    updateItemAbsenceState(item.id, enabled, start, end);
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

  // Implement updateItemAbsenceState using updateDataItem
  const updateItemAbsenceState = (itemId, absences) => {
    simDataStore.updateDataItem(scenarioId, itemId, {
      parseddata: {
        ...item.parseddata,
        absences
      }
    });
  };

  const handleAddAbsence = () => {
    updateItemAbsenceState(item.id, [...absenceStateList, { start: '', end: '' }]);
  };

  const handleUpdateAbsence = (idx, updatedAbsence) => {
    const newList = absenceStateList.map((a, i) => (i === idx ? updatedAbsence : a));
    updateItemAbsenceState(item.id, newList);
  };

  const handleDeleteAbsence = (idx) => {
    const newList = absenceStateList.filter((_, i) => i !== idx);
    updateItemAbsenceState(item.id, newList);
  };

  // Implement updateItemDates locally using simDataStore.updateDataItem
  const updateItemDates = (itemId, startdate, enddate) => {
    simDataStore.updateDataItem(scenarioId, itemId, {
      parseddata: {
        ...item.parseddata,
        startdate,
        enddate
      }
    });
  };

  return (
    <Box flex={1} display="flex" flexDirection="column">
      <Tabs
        value={activeTab}
        onChange={(_, newTab) => setActiveTab(newTab)}
        variant="fullWidth"
        sx={{ mb: 2 }}
      >
        <Tab icon={<PersonIcon />} label="Allgemein" />
        {/* <Tab icon={<AccessTimeIcon />} label="Zeiten" />
        <Tab icon={<GroupIcon />} label="Gruppen" />
        <Tab icon={<EuroIcon />} label="Finanzen" /> */}
        <Tab icon={<BugReportIcon />} label="Debug" /> 
      </Tabs>
      {activeTab === 0 && (
        <SimDataGeneralTab
          item={item}
          absenceStateList={absenceStateList}
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
          handleAbsenceChange={handleAbsenceChange}
          handleAddAbsence={handleAddAbsence}
          handleUpdateAbsence={handleUpdateAbsence}
          handleDeleteAbsence={handleDeleteAbsence}
          updateItemName={updateItemName}
          updateItemNote={updateItemNote}
          updateItemQualification={updateItemQualification}
        />
      )}
      {/* {activeTab === 1 && (
        <SimDataBookingTab
          item={item}
          lastAddedBookingIdx={lastAddedBookingIdx}
          importedBookingCount={importedBookingCount}
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
          allGroups={allGroups}
        />
      )} 
      {activeTab === 3 && (
        <SimDataFinanceTab
          item={item}
        />
      )} */}
      {activeTab === 1 && (
        <Box sx={{ p: 2, overflow: 'auto', maxHeight: 400 }}>
          <Typography variant="h6" gutterBottom>Simulation Item Debug</Typography>
          <pre style={{
            background: '#f5f5f5',
            padding: 12,
            borderRadius: 4,
            fontSize: 13,
            overflowX: 'auto'
          }}>
            {JSON.stringify(item, null, 2)}
          </pre>
        </Box>
      )}
    </Box>
  );
}

export default SimulationDataTab;

