import {
  Typography,
  Box,

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
import SimDataBookingTab from './Bookings/SimDataBookingTab';
import SimDataGroupsTab from './Groups/SimDataGroupsTab';
import SimDataFinanceTab from './Financials/SimDataFinanceTab';
import React, { useState } from 'react';
import { useSelector } from 'react-redux';

function SimDataTabs() {
  const [activeTab, setActiveTab] = useState(0);

  // Get selected scenario and item id from Redux
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const selectedItemId = useSelector(state => state.simScenario.selectedItems?.[selectedScenarioId]);
  const dataItems = useSelector(state => state.simData.items[selectedScenarioId] || []);
  const selectedItem = dataItems?.find(item => item.id === selectedItemId);

  // Get data from all slices for debug
  const simDataItem = selectedItem;
  const bookings = useSelector(state =>
    selectedScenarioId && selectedItemId
      ? (state.simBooking.bookings[selectedScenarioId]?.[selectedItemId] || [])
      : []
  );
  const groupAssignments = useSelector(state =>
    selectedScenarioId && selectedItemId
      ? (state.simGroup.groups[selectedScenarioId] || []).filter(g =>
        g.members && Array.isArray(g.members) && g.members.includes(selectedItemId)
      )
      : []
  );
  const financials = useSelector(state =>
    selectedScenarioId && selectedItemId
      ? (state.simFinancials.financials[selectedScenarioId]?.[selectedItemId] || [])
      : []
  );
  const qualifications = useSelector(state =>
    selectedScenarioId
      ? (state.simQualification.qualifications[selectedScenarioId] || [])
      : []
  );

  // Guard: Wenn item nicht gesetzt, Hinweis anzeigen und return
  if (!selectedItemId) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Typography color="text.secondary">
          Wählen Sie einen Eintrag aus, um Details anzuzeigen.
        </Typography>
      </Box>
    );
  }

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
        {/*<Tab icon={<EuroIcon />} label="Finanzen" /> */}
        <Tab icon={<BugReportIcon />} label="Debug" />
      </Tabs>
      {activeTab === 0 && (
        <SimDataGeneralTab />
      )}
      {activeTab === 1 && (
        <SimDataBookingTab />
      )}
      {activeTab === 2 && (
        <SimDataGroupsTab />
      )}
      {/*
      {activeTab === 3 && (
        <SimDataFinanceTab
          item={item}
        />
      )} */}
      {activeTab === 3 && (
        <Box sx={{ p: 2, overflow: 'auto', maxHeight: 400 }}>
          <Typography variant="h6" gutterBottom>Simulation Item Debug</Typography>
          <Typography variant="subtitle2" sx={{ mt: 2 }}>simDataStore</Typography>
          <pre style={{
            background: '#f5f5f5',
            padding: 12,
            borderRadius: 4,
            fontSize: 13,
            overflowX: 'auto'
          }}>
            {JSON.stringify(simDataItem, null, 2)}
          </pre>
          <Typography variant="subtitle2" sx={{ mt: 2 }}>bookingStore</Typography>
          <pre style={{
            background: '#f5f5f5',
            padding: 12,
            borderRadius: 4,
            fontSize: 13,
            overflowX: 'auto'
          }}>
            {JSON.stringify(bookings, null, 2)}
          </pre>
          <Typography variant="subtitle2" sx={{ mt: 2 }}>groupStore</Typography>
          <pre style={{
            background: '#f5f5f5',
            padding: 12,
            borderRadius: 4,
            fontSize: 13,
            overflowX: 'auto'
          }}>
            {JSON.stringify(groupAssignments, null, 2)}
          </pre>
          <Typography variant="subtitle2" sx={{ mt: 2 }}>financialsStore</Typography>
          <pre style={{
            background: '#f5f5f5',
            padding: 12,
            borderRadius: 4,
            fontSize: 13,
            overflowX: 'auto'
          }}>
            {JSON.stringify(financials, null, 2)}
          </pre>
          <Typography variant="subtitle2" sx={{ mt: 2 }}>qualificationsStore</Typography>
          <pre style={{
            background: '#f5f5f5',
            padding: 12,
            borderRadius: 4,
            fontSize: 13,
            overflowX: 'auto'
          }}>
            {JSON.stringify(qualifications, null, 2)}
          </pre>
        </Box>
      )}
    </Box>
  );
}

export default SimDataTabs;
