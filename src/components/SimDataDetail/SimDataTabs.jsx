import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Tabs, Box, Text, Center } from '@mantine/core';
import { IconUser, IconClock, IconUsers, IconTools } from '@tabler/icons-react';
import { useOverlayData } from '../../hooks/useOverlayData';
import SimDataGeneralTab from './SimDataGeneralTab';
import SimDataBookingTab from './Bookings/SimDataBookingTab';
import SimDataGroupsTab from './Groups/SimDataGroupsTab';
import SimDataFinanceTab from './SimDataFinanceTab';

function SimDataTabs() {
  const [activeTab, setActiveTab] = useState('general');

  // Get selected scenario and item id from Redux
  const scenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const selectedItemId = useSelector(state => state.simScenario.selectedItems?.[scenarioId]);

  // Use overlay hook to get effective data
  const { getEffectiveDataItem } = useOverlayData();
  const item = getEffectiveDataItem(selectedItemId);

  useEffect(() => {
    setActiveTab('general');
  }, [selectedItemId]);

  // Guard: If no item selected or no effective item found
  if (!selectedItemId || !item) {
    return (
      <Center mih={200}>
        <Text c="dimmed">
          Wählen Sie einen Eintrag aus, um Details anzuzeigen.
        </Text>
      </Center>
    );
  }

  return (
    <Box h="100%" style={{ display: 'flex', flexDirection: 'column' }}>
      <Tabs value={activeTab} onChange={setActiveTab} variant="outline">
        <Tabs.List grow>
          <Tabs.Tab value="general" leftSection={<IconUser size={16} />}>
            Allgemein
          </Tabs.Tab>
          <Tabs.Tab value="bookings" leftSection={<IconClock size={16} />}>
            Zeiten
          </Tabs.Tab>
          <Tabs.Tab value="groups" leftSection={<IconUsers size={16} />}>
            Gruppen
          </Tabs.Tab>
          <Tabs.Tab value="finance" leftSection={<IconTools size={16} />}>
            Finanzen
          </Tabs.Tab>
        </Tabs.List>

        <Box pt="md" style={{ flex: 1, overflow: 'auto' }}>
          <Tabs.Panel value="general">
            <SimDataGeneralTab />
          </Tabs.Panel>
          <Tabs.Panel value="bookings">
            <SimDataBookingTab />
          </Tabs.Panel>
          <Tabs.Panel value="groups">
            <SimDataGroupsTab />
          </Tabs.Panel>
          <Tabs.Panel value="finance">
            <SimDataFinanceTab />
          </Tabs.Panel>
        </Box>
      </Tabs>
    </Box>
  );
}

export default SimDataTabs;
