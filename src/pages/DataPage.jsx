import React, { useState } from 'react';
import { Box, Button, Paper, Title, Text, Stack, ActionIcon, Menu, Group, Container } from '@mantine/core';
import { IconUpload, IconPlus, IconUser, IconBabyCarriage, IconLayersIntersect } from '@tabler/icons-react';
import DataImportModal from '../components/modals/DataImportModal';
import SimDataList from '../components/SimDataDetail/SimDataList';
import { useSelector, useDispatch } from 'react-redux';
import { setSelectedScenarioId, addScenario } from '../store/simScenarioSlice';
import { addDataItemAndSelect } from '../store/simDataSlice';
import { useOverlayData } from '../hooks/useOverlayData';

function DataPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const scenarios = useSelector(state => state.simScenario.scenarios);
  
  useOverlayData();

  const handleAddCapacity = () => {
    dispatch(addDataItemAndSelect({ scenarioId: selectedScenarioId, item: { type: "capacity", source: "manual entry" } }));
  };

  const handleAddDemand = () => {
    dispatch(addDataItemAndSelect({ scenarioId: selectedScenarioId, item: { type: "demand", source: "manual entry" } }));
  };

  const handleAddScenario = () => {
    dispatch(addScenario({
      name: 'Neues Szenario',
      remark: '',
      confidence: 50,
      likelihood: 50,
      baseScenarioId: selectedScenarioId || null
    }));
  };

  React.useEffect(() => {
    if (selectedScenarioId && scenarios.length > 0) {
      if (!scenarios.some(s => s.id === selectedScenarioId)) {
        dispatch(setSelectedScenarioId(scenarios[0].id));
      }
    } else if (!selectedScenarioId && scenarios.length > 0) {
      dispatch(setSelectedScenarioId(scenarios[0].id));
    }
  }, [selectedScenarioId, scenarios, dispatch]);

  if (!scenarios || scenarios.length === 0) {
    return (
      <Container size="sm" py="xl">
        <Paper shadow="xs" p="xl" withBorder style={{ textAlign: 'center' }}>
          <Stack align="center">
            <Title order={3}>Kein Szenario vorhanden</Title>
            <Text c="dimmed">Um mit der Simulation zu starten, importieren Sie bitte zuerst Daten.</Text>
            <Button leftSection={<IconUpload size={16} />} onClick={() => setModalOpen(true)}>
              Daten importieren
            </Button>
          </Stack>
        </Paper>
        <DataImportModal opened={modalOpen} onClose={() => setModalOpen(false)} />
      </Container>
    );
  }

  return (
    <Box>
      <Menu position="left-start" offset={10} shadow="md">
        <Menu.Target>
          <ActionIcon 
            size="xl" 
            radius="xl" 
            variant="filled"
            aria-label="Hinzufügen"
            style={{ position: 'fixed', bottom: 32, right: 32, zIndex: 1000 }}
          >
            <IconPlus size={24} />
          </ActionIcon>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Label>Hinzufügen</Menu.Label>
          <Menu.Item leftSection={<IconUser size={16} />} onClick={handleAddCapacity}>
            Kapazität
          </Menu.Item>
          <Menu.Item leftSection={<IconBabyCarriage size={16} />} onClick={handleAddDemand}>
            Bedarf
          </Menu.Item>
          <Menu.Item leftSection={<IconLayersIntersect size={16} />} onClick={handleAddScenario}>
            Szenario
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      <DataImportModal opened={modalOpen} onClose={() => setModalOpen(false)} />
      <SimDataList />
    </Box>
  );
}

export default DataPage;
