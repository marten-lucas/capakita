import React from 'react';
import { Group, Button, Text, Menu, ActionIcon, Container, Select, Box, Switch, Modal, Alert, Stack, Checkbox } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useSelector, useDispatch, useStore } from 'react-redux';
import { isSaveAllowed, setSaveDialogOpen, setLoadDialogOpen, setSelectedScenarioId } from '../store/simScenarioSlice';
import { setActivePage, setBrowserAutoSaveEnabled } from '../store/uiSlice';
import { IconDatabase, IconChartBar, IconSettings, IconDotsVertical, IconUpload, IconDeviceFloppy, IconFolderOpen, IconCalendarEvent, IconInfoCircle, IconRefresh, IconTrash } from '@tabler/icons-react';
import { refreshEventsForScenario, clearEventOverridesForScenario } from '../store/eventSlice';
import { updateDatesOfInterest } from '../store/datesOfInterestSlice';
import { loadBookingsByScenario } from '../store/simBookingSlice';
import { loadGroupsByScenario } from '../store/simGroupSlice';
import { loadQualificationAssignmentsByScenario } from '../store/simQualificationSlice';
import { loadOverlaysByScenario } from '../store/simOverlaySlice';
import { loadFinanceByScenario } from '../store/simFinanceSlice';
import { buildScenarioCleanupResult } from '../utils/scenarioCleanup';
import DataImportModal from './modals/DataImportModal';

function TopNav() {
  const dispatch = useDispatch();
  const isTablet = useMediaQuery('(max-width: 75em)');
  const isMobile = useMediaQuery('(max-width: 48em)');
  const canSave = useSelector(isSaveAllowed);
  const scenarios = useSelector((state) => state.simScenario.scenarios);
  const selectedScenarioId = useSelector((state) => state.simScenario.selectedScenarioId);
  const browserAutoSaveEnabled = useSelector((state) => state.ui.browserAutoSaveEnabled);
  const store = useStore();
  const [importModalOpen, setImportModalOpen] = React.useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = React.useState(false);
  const [cleanupModalOpen, setCleanupModalOpen] = React.useState(false);
  const [resetEventOverrides, setResetEventOverrides] = React.useState(true);
  const showScenarioSelector = (scenarios?.length || 0) > 1;

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

  const handleCleanupAndRecompute = ({ resetEventOverrides: shouldResetEventOverrides }) => {
    if (!selectedScenarioId) return;
    const appState = store.getState();

    const cleaned = buildScenarioCleanupResult(appState, selectedScenarioId);

    dispatch(loadBookingsByScenario(cleaned.bookingsByScenario));
    dispatch(loadGroupsByScenario(cleaned.groupsByScenario));
    dispatch(loadQualificationAssignmentsByScenario(cleaned.qualificationAssignmentsByScenario));
    dispatch(loadOverlaysByScenario(cleaned.overlaysByScenario));
    dispatch(loadFinanceByScenario(cleaned.financeByScenario));
    if (shouldResetEventOverrides) {
      dispatch(clearEventOverridesForScenario({ scenarioId: selectedScenarioId }));
    }

    dispatch(
      refreshEventsForScenario({
        scenarioId: selectedScenarioId,
        simData: appState.simData,
        simBooking: { bookingsByScenario: cleaned.bookingsByScenario },
        simGroup: { groupsByScenario: cleaned.groupsByScenario },
        simScenario: appState.simScenario,
      })
    );
    dispatch(updateDatesOfInterest(selectedScenarioId));

    const stats = cleaned.stats;
    const removedTotal = [
      stats.removedBookingItemBuckets,
      stats.removedGroupItemBuckets,
      stats.removedQualificationItemBuckets,
      stats.removedOverlayBookingBuckets,
      stats.removedOverlayGroupBuckets,
      stats.removedFinanceItemEntries,
    ].reduce((sum, value) => sum + Number(value || 0), 0);

    const details = [
      `Buchungen: ${stats.removedBookingItemBuckets}`,
      `Gruppenzuweisungen: ${stats.removedGroupItemBuckets}`,
      `Qualifikationen: ${stats.removedQualificationItemBuckets}`,
      `Overlay-Buchungen: ${stats.removedOverlayBookingBuckets}`,
      `Overlay-Gruppen: ${stats.removedOverlayGroupBuckets}`,
      `Finanz-Einträge: ${stats.removedFinanceItemEntries}`,
    ].join(', ');

    const eventOverrideHint = shouldResetEventOverrides
      ? 'Manuell deaktivierte Events wurden ebenfalls zurückgesetzt.'
      : 'Manuell deaktivierte Events wurden beibehalten.';

    alert(`Bereinigung abgeschlossen. Entfernte Artefakte: ${removedTotal}. ${details}. Auto-Events wurden neu berechnet. ${eventOverrideHint}`);

    setCleanupModalOpen(false);
  };

  const navButtonProps = {
    variant: 'subtle',
    size: isMobile ? 'xs' : 'sm',
    px: isTablet ? 'xs' : 'sm',
    style: { flexShrink: 0 },
  };

  return (
    <Container fluid px={{ base: 'xs', sm: 'md' }} h="100%">
      <Group justify="space-between" h="100%" wrap="nowrap" align="center">
        <Text size="xl" fw={700} variant="gradient" gradient={{ from: 'blue', to: 'cyan' }} style={{ flexShrink: 0 }}>
          CapaKita
        </Text>

        <Group wrap="nowrap" align="center" style={{ flex: 1, minWidth: 0, justifyContent: 'flex-end' }}>
          <Box style={{ flex: 1, minWidth: 0, overflowX: 'auto', overflowY: 'hidden' }}>
            <Group gap="xs" wrap="nowrap" align="center" style={{ minWidth: 'max-content', marginLeft: 'auto', width: 'max-content' }}>
              {showScenarioSelector && (
                <Select
                  aria-label="Szenario auswählen"
                  placeholder="Szenario wählen"
                  data={scenarioOptions}
                  value={selectedScenarioId ? String(selectedScenarioId) : null}
                  onChange={(value) => value && dispatch(setSelectedScenarioId(value))}
                  allowDeselect={false}
                  w={isMobile ? 170 : isTablet ? 220 : 280}
                  size="sm"
                />
              )}
              <Button
                onClick={() => dispatch(setActivePage('data'))}
                leftSection={<IconDatabase size={20} />}
                {...navButtonProps}
              >
                Daten
              </Button>
              <Button
                onClick={() => dispatch(setActivePage('visu'))}
                leftSection={<IconChartBar size={20} />}
                {...navButtonProps}
              >
                Analyse
              </Button>
              <Button
                onClick={() => dispatch(setActivePage('settings'))}
                leftSection={<IconSettings size={20} />}
                {...navButtonProps}
              >
                Optionen
              </Button>
              <Button
                onClick={() => dispatch(setActivePage('events'))}
                leftSection={<IconCalendarEvent size={20} />}
                {...navButtonProps}
              >
                Ereignisse
              </Button>
            </Group>
          </Box>

          {!isMobile && (
            <Group gap="xs" wrap="nowrap" className="topnav-quick-actions">
              <Button
                variant="light"
                size="sm"
                leftSection={<IconUpload size={16} />}
                onClick={() => setImportModalOpen(true)}
              >
                Import
              </Button>
              <Button
                variant="light"
                size="sm"
                leftSection={<IconFolderOpen size={16} />}
                onClick={() => dispatch(setLoadDialogOpen(true))}
              >
                Laden
              </Button>
              <Button
                variant="light"
                size="sm"
                leftSection={<IconTrash size={16} />}
                onClick={() => setCleanupModalOpen(true)}
              >
                Bereinigen
              </Button>
            </Group>
          )}

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
                  disabled={!canSave && !browserAutoSaveEnabled}
                  onClick={() => handleAutoSaveToggle(!browserAutoSaveEnabled)}
                >
                  <Group justify="space-between" w="100%" wrap="nowrap" gap="md">
                    <Stack gap={0} miw={0}>
                      <Text size="sm">Auto-Save im Browser</Text>
                      {!canSave && (
                        <Text size="xs" c="dimmed">
                          Nur für anonymisierte Imports
                        </Text>
                      )}
                    </Stack>
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
                <Menu.Divider />
                <Menu.Item
                  leftSection={<IconTrash size={16} />}
                  rightSection={<IconRefresh size={14} />}
                  onClick={() => setCleanupModalOpen(true)}
                >
                  Bereinigen / neu berechnen
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
        </Group>
      </Group>

      <DataImportModal opened={importModalOpen} onClose={() => setImportModalOpen(false)} />

      <Modal
        opened={cleanupModalOpen}
        onClose={() => setCleanupModalOpen(false)}
        title="Datensatz bereinigen"
        centered
      >
        <Stack gap="md">
          <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
            Entfernt verwaiste Artefakte und berechnet Auto-Events sowie Stichtage neu.
          </Alert>

          <Checkbox
            checked={resetEventOverrides}
            onChange={(event) => setResetEventOverrides(event.currentTarget.checked)}
            label="Manuell deaktivierte Events zurücksetzen"
          />

          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setCleanupModalOpen(false)}>
              Abbrechen
            </Button>
            <Button
              leftSection={<IconRefresh size={16} />}
              onClick={() => handleCleanupAndRecompute({ resetEventOverrides })}
            >
              Bereinigen starten
            </Button>
          </Group>
        </Stack>
      </Modal>

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
