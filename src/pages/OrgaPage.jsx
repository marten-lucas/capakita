import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
} from '@mui/material';
import GroupIcon from '@mui/icons-material/Group';
import PersonIcon from '@mui/icons-material/Person';
import OrgaTabGroupDefs from '../components/orgaDetails/orgaTabGroupDefs';
import OrgaTabQualificationDefs from '../components/orgaDetails/orgaTabQualificatoinDefs';
import OrgaTabRateDefs from '../components/orgaDetails/orgTabRateDefs';

function OrgaPage() {
  const [activeTab, setActiveTab] = useState(0);


  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#f0f2f5' }}>
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" sx={{ mb: 3 }}>Einstellungen</Typography>
        <Paper sx={{ p: 0 }}>
          <Tabs
            value={activeTab}
            onChange={(_, newTab) => setActiveTab(newTab)}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab icon={<GroupIcon />} label="Gruppen" />
            <Tab icon={<PersonIcon />} label="Qualifikationen" />
            <Tab label="Beiträge" />
          </Tabs>
          <Box sx={{ p: 3 }}>
            {activeTab === 0 && <OrgaTabGroupDefs />}
            {activeTab === 1 && <OrgaTabQualificationDefs />}
            {activeTab === 2 && <OrgaTabRateDefs />}
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}

export default OrgaPage;

  