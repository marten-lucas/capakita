import React, { useState } from 'react';
import { Paper, Tabs, Box } from '@mantine/core';
import { IconLayersIntersect, IconUsers, IconCertificate, IconCalendarEvent } from '@tabler/icons-react';
import { useLocation, useNavigate } from 'react-router-dom';
import OrgaTabGroupDefs from '../components/orgaDetails/orgaTabGroupDefs';
import OrgaTabQualificationDefs from '../components/orgaDetails/orgaTabQualificatoinDefs';
import OrgaTabScenarioDefs from '../components/orgaDetails/orgaTabScenarioDefs';
import OrgaTabEvents from '../components/orgaDetails/orgaTabEvents';

function SettingsPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // Parse tab from query string
  const tabFromQuery = new URLSearchParams(location.search).get('tab') || 'groups';
  const [activeTab, setActiveTab] = useState(tabFromQuery);

  const handleTabChange = (value) => {
    setActiveTab(value);
    navigate(`/settings?tab=${value}`, { replace: true });
  };

  return (
    <Paper shadow="sm" withBorder p={0}>
      <Tabs value={activeTab} onChange={handleTabChange}>
        <Tabs.List>
          <Tabs.Tab value="scenarios" leftSection={<IconLayersIntersect size={16} />}>
            Szenarien
          </Tabs.Tab>
          <Tabs.Tab value="groups" leftSection={<IconUsers size={16} />}>
            Gruppen
          </Tabs.Tab>
          <Tabs.Tab value="qualifications" leftSection={<IconCertificate size={16} />}>
            Qualifikationen
          </Tabs.Tab>
          <Tabs.Tab value="events" leftSection={<IconCalendarEvent size={16} />}>
            Ereignisse
          </Tabs.Tab>
        </Tabs.List>

        <Box p="md">
          <Tabs.Panel value="scenarios">
            <OrgaTabScenarioDefs />
          </Tabs.Panel>
          <Tabs.Panel value="groups">
            <OrgaTabGroupDefs />
          </Tabs.Panel>
          <Tabs.Panel value="qualifications">
            <OrgaTabQualificationDefs />
          </Tabs.Panel>
          <Tabs.Panel value="events">
            <OrgaTabEvents />
          </Tabs.Panel>
        </Box>
      </Tabs>
    </Paper>
  );
}

export default SettingsPage;
