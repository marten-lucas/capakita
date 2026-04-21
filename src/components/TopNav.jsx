import React from 'react';
import { Group, Button, Text, Menu, ActionIcon, Container, Select, Stack, Switch, Modal, Alert } from '@mantine/core';
import { useSelector, useDispatch } from 'react-redux';
import { isSaveAllowed, setSaveDialogOpen, setLoadDialogOpen, setSelectedScenarioId } from '../store/simScenarioSlice';
import { setActivePage, setBrowserAutoSaveEnabled } from '../store/uiSlice';
import { IconDatabase, IconChartBar, IconSettings, IconDotsVertical, IconUpload, IconDeviceFloppy, IconFolderOpen, IconCalendarEvent, IconInfoCircle } from '@tabler/icons-react';
import DataImportModal from './modals/DataImportModal';

function TopNav() {
  const dispatch = useDispatch();
  const canSave = useSelector(isSaveAllowed);
  const scenarios = useSelector((state) => state.simScenario.scenarios);
  const selectedScenarioId = useSelector((state) => state.simScenario.selectedScenarioId);
  const browserAutoSaveEnabled = useSelector((state) => state.ui.browserAutoSaveEnabled);
  const [importModalOpen, setImportModalOpen] = React.useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = React.useState(false);

  const scenarioOptions = React.useMemo(
    () =>
      (scenarios || []).map((scenario) => ({
        value: String(scenario.id),
        label: scenario.name || 'Unbenanntes Szenario',
      })),
    [scenarios]
  );

  const handleAutoSaveToggle = (nextEnabled) => {
    if (nextEnabled) {
      setPrivacyModalOpen(true);
      return;
    }

    dispatch(setBrowserAutoSaveEnabled(false));
  };

  const handleConfirmAutoSave = () => {
    dispatch(setBrowserAutoSaveEnabled(true));
    setPrivacyModalOpen(false);
  };

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
          <Button
            onClick={() => dispatch(setActivePage('events'))}
            variant="subtle"
            leftSection={<IconCalendarEvent size={20} />}
          >
            Ereignisse
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
                leftSection={<IconInfoCircle size={16} />}
                onClick={() => handleAutoSaveToggle(!browserAutoSaveEnabled)}
              >
                <Group justify="space-between" w="100%" wrap="nowrap" gap="md">
                  <span>Auto-Save im Browser</span>
                  <Switch checked={browserAutoSaveEnabled} readOnly size="xs" />
                </Group>
              </Menu.Item>
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

      <Modal
        opened={privacyModalOpen}
        onClose={() => setPrivacyModalOpen(false)}
        title="Datenschutzhinweis"
        centered
      >
        <Stack gap="md">
          <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
            Beim Aktivieren werden Szenarien und Arbeitsdaten unverschlüsselt im lokalen
            Browser-Speicher abgelegt.
          </Alert>
          <Text>
            Die Daten bleiben auf diesem Gerät und werden bei jeder Änderung automatisch
            aktualisiert. Deaktiviere die Funktion wieder, wenn keine lokale Speicherung mehr
            gewünscht ist.
          </Text>

          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setPrivacyModalOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleConfirmAutoSave}>Aktivieren</Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}

export default TopNav;
