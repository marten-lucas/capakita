import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Tabs, Box, Text, Center } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconUser, IconClock, IconUsers, IconTools } from '@tabler/icons-react';
import { useOverlayData } from '../../hooks/useOverlayData';
import { selectPrimarySelectedItemId } from '../../store/simScenarioSlice';
import SimDataGeneralTab from './SimDataGeneralTab';
import SimDataBookingTab from './Bookings/SimDataBookingTab';
import SimDataGroupsTab from './Groups/SimDataGroupsTab';
import SimDataFinanceTab from './SimDataFinanceTab';

function SimDataTabs() {
  const [activeTab, setActiveTab] = useState('general');
  const isMobile = useMediaQuery('(max-width: 48em)');

  // Get selected scenario and item id from Redux
  const selectedItemId = useSelector(selectPrimarySelectedItemId);

  // Use overlay hook to get effective data
  const { getEffectiveDataItem } = useOverlayData();
  const item = getEffectiveDataItem(selectedItemId);
  const isEmployee = item?.type === 'capacity';

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
    <Box h="100%" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Tabs value={activeTab} onChange={setActiveTab} variant="outline" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        <Tabs.List
          grow={!isMobile}
          style={{
            overflowX: 'auto',
            flexWrap: 'nowrap',
          }}
        >
          <Tabs.Tab value="general" leftSection={<IconUser size={16} />}>
            Allgemein
          </Tabs.Tab>
          <Tabs.Tab value="bookings" leftSection={<IconClock size={16} />}>
            {isEmployee ? 'Zeiten & Gruppen' : 'Zeiten'}
          </Tabs.Tab>
          {!isEmployee && (
            <Tabs.Tab value="groups" leftSection={<IconUsers size={16} />}>
              Gruppen
            </Tabs.Tab>
          )}
          <Tabs.Tab value="finance" leftSection={<IconTools size={16} />}>
            Finanzen
          </Tabs.Tab>
        </Tabs.List>

        <Box pt="md" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <Tabs.Panel value="general" style={{ minHeight: '100%' }}>
            <SimDataGeneralTab />
          </Tabs.Panel>
          <Tabs.Panel value="bookings" style={{ minHeight: '100%' }}>
            <SimDataBookingTab />
          </Tabs.Panel>
          {!isEmployee && (
            <Tabs.Panel value="groups" style={{ minHeight: '100%' }}>
              <SimDataGroupsTab />
            </Tabs.Panel>
          )}
          <Tabs.Panel value="finance" style={{ minHeight: '100%' }}>
            <SimDataFinanceTab />
          </Tabs.Panel>
        </Box>
      </Tabs>
    </Box>
  );
}

export default SimDataTabs;
