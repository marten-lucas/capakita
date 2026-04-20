import React from 'react';
import { Group, Button, Text, Menu, ActionIcon, Container, Select } from '@mantine/core';
import { useSelector, useDispatch } from 'react-redux';
import { isSaveAllowed, setSaveDialogOpen, setLoadDialogOpen, setSelectedScenarioId } from '../store/simScenarioSlice';
import { setActivePage } from '../store/uiSlice';
import { IconDatabase, IconChartBar, IconSettings, IconDotsVertical, IconUpload, IconDeviceFloppy, IconFolderOpen } from '@tabler/icons-react';
import DataImportModal from './modals/DataImportModal';

function TopNav() {
  const dispatch = useDispatch();
  const canSave = useSelector(isSaveAllowed);
  const scenarios = useSelector((state) => state.simScenario.scenarios);
  const selectedScenarioId = useSelector((state) => state.simScenario.selectedScenarioId);
  const [importModalOpen, setImportModalOpen] = React.useState(false);

  const scenarioOptions = React.useMemo(
    () =>
      (scenarios || []).map((scenario) => ({
        value: String(scenario.id),
        label: scenario.name || 'Unbenanntes Szenario',
      })),
    [scenarios]
  );

  return (
    <Container size="xl" h="100%">
      <Group justify="space-between" h="100%">
        <Group gap="md">
          <Text size="xl" fw={700} variant="gradient" gradient={{ from: 'blue', to: 'cyan' }}>
            CapaKita
          </Text>
          <Select
            aria-label="Szenario auswählen"
            placeholder="Szenario wählen"
            data={scenarioOptions}
            value={selectedScenarioId ? String(selectedScenarioId) : null}
            onChange={(value) => value && dispatch(setSelectedScenarioId(value))}
            allowDeselect={false}
            w={260}
            size="sm"
          />
        </Group>

        <Group gap="xs">
          <Button
            onClick={() => dispatch(setActivePage('data'))}
            variant="subtle"
            leftSection={<IconDatabase size={20} />}
          >
            Daten
          </Button>
          <Button
            onClick={() => dispatch(setActivePage('visu'))}
            variant="subtle"
            leftSection={<IconChartBar size={20} />}
          >
            Analyse
          </Button>
          <Button
            onClick={() => dispatch(setActivePage('settings'))}
            variant="subtle"
            leftSection={<IconSettings size={20} />}
          >
            Optionen
          </Button>

          <Menu shadow="md" width={200}>
            <Menu.Target>
              <ActionIcon variant="subtle" size="lg" aria-label="Aktionen">
                <IconDotsVertical size={20} />
              </ActionIcon>
            </Menu.Target>

            <Menu.Dropdown>
              <Menu.Label>Aktionen</Menu.Label>
              <Menu.Item
                leftSection={<IconUpload size={16} />}
                onClick={() => setImportModalOpen(true)}
              >
                Adebis Import
              </Menu.Item>
              <Menu.Item
                leftSection={<IconDeviceFloppy size={16} />}
                disabled={!canSave}
                onClick={() => dispatch(setSaveDialogOpen(true))}
              >
                Szenario speichern
              </Menu.Item>
              <Menu.Item
                leftSection={<IconFolderOpen size={16} />}
                onClick={() => dispatch(setLoadDialogOpen(true))}
              >
                Szenario laden
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>

      <DataImportModal opened={importModalOpen} onClose={() => setImportModalOpen(false)} />
    </Container>
  );
}

export default TopNav;
