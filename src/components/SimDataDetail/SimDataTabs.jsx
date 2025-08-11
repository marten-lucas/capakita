import {
  Typography,
  Box,
  Tabs,
  Tab,
  Button
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonIcon from '@mui/icons-material/Person';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import GroupIcon from '@mui/icons-material/Group';
import EuroIcon from '@mui/icons-material/Euro';
import BugReportIcon from '@mui/icons-material/BugReport';
import SimDataGeneralTab from './SimDataGeneralTab';
import SimDataBookingTab from './Bookings/SimDataBookingTab';
import SimDataGroupsTab from './Groups/SimDataGroupsTab';
import SimDataFinanceTab from './Financials/SimDataFinanceTab';
import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { useOverlayData } from '../../hooks/useOverlayData';

function SimDataTabs() {
  const [activeTab, setActiveTab] = useState(0);

  // Get selected scenario and item id from Redux
  const scenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const selectedItemId = useSelector(state => state.simScenario.selectedItems?.[scenarioId]);

  // Use overlay hook to get effective data
  const { getEffectiveDataItem } = useOverlayData();
  const item = getEffectiveDataItem(selectedItemId);

  // Guard: If no item selected or no effective item found
  if (!selectedItemId || !item) {
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
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        minHeight: 0
      }}
    >
      <Tabs
        value={activeTab}
        onChange={(_, newTab) => setActiveTab(newTab)}
        variant="fullWidth"
        sx={{ mb: 2, flex: '0 0 auto' }}
      >
        <Tab icon={<PersonIcon />} label="Allgemein" />
        <Tab icon={<AccessTimeIcon />} label="Zeiten" />
        <Tab icon={<GroupIcon />} label="Gruppen" />
        <Tab icon={<EuroIcon />} label="Finanzen" />
      </Tabs>
      
      <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {activeTab === 0 && <SimDataGeneralTab />}
        {activeTab === 1 && <SimDataBookingTab />}
        {activeTab === 2 && <SimDataGroupsTab />}
        {activeTab === 3 && <SimDataFinanceTab item={item} />}
      </Box>

      
    </Box>
  );
}

export default SimDataTabs;