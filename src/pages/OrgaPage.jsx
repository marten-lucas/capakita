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
import EuroIcon from '@mui/icons-material/Euro';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import { useLocation, useNavigate } from 'react-router-dom';
import OrgaTabGroupDefs from '../components/orgaDetails/orgaTabGroupDefs';
import OrgaTabQualificationDefs from '../components/orgaDetails/orgaTabQualificatoinDefs';
import OrgaTabRateDefs from '../components/orgaDetails/orgaTabRateDefs';
import OrgaTabScenarioDefs from '../components/orgaDetails/orgaTabScenarioDefs';


function OrgaPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // Parse tab from query string
  const tabFromQuery = new URLSearchParams(location.search).get('tab');
  const [activeTab, setActiveTab] = useState(tabFromQuery === 'scenarios' ? 3 : 0);

  // Keep tab in sync with query
  React.useEffect(() => {
    if (tabFromQuery === 'scenarios' && activeTab !== 3) setActiveTab(3);
    if (tabFromQuery !== 'scenarios' && activeTab === 3) setActiveTab(0);
  }, [tabFromQuery, activeTab]);

  // Handle tab change and update query
  const handleTabChange = (_, newTab) => {
    setActiveTab(newTab);
    if (newTab === 3) {
      navigate('/orga?tab=scenarios', { replace: true });
    } else {
      navigate('/orga', { replace: true });
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#f0f2f5' }}>
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" sx={{ mb: 3 }}>Einstellungen</Typography>
        <Paper sx={{ p: 0 }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab icon={<GroupIcon />} label="Gruppen" />
            <Tab icon={<PersonIcon />} label="Qualifikationen" />
            <Tab icon={<EuroIcon />} label="Beiträge" />
            <Tab icon={<AccountTreeIcon />} label="Szenarien" />
          </Tabs>
          <Box sx={{ p: 3 }}>
            {activeTab === 0 && <OrgaTabGroupDefs />}
            {activeTab === 1 && <OrgaTabQualificationDefs />}
            {activeTab === 2 && <OrgaTabRateDefs />}
            {activeTab === 3 && <OrgaTabScenarioDefs />}
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}

export default OrgaPage;

