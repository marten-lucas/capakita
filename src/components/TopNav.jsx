import React from 'react';
import { Alert, Button, Text, Menu, ActionIcon, Select, Box, Switch, Modal, Stack, Checkbox, Group, UnstyledButton } from '@mantine/core';
import { useSelector, useDispatch, useStore } from 'react-redux';
import { isSaveAllowed, setSaveDialogOpen, setLoadDialogOpen, setSelectedScenarioId } from '../store/simScenarioSlice';
import { setActivePage, setAnalysisSubPage, setBrowserAutoSaveEnabled, setSettingsSubPage, setDataSubmenu } from '../store/uiSlice';
import { IconDatabase, IconChartBar, IconSettings, IconDotsVertical, IconUpload, IconDeviceFloppy, IconFolderOpen, IconCalendarEvent, IconInfoCircle, IconRefresh, IconTrash, IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand, IconLayersIntersect, IconUsers, IconCertificate, IconTools, IconAlertTriangle, IconRoute, IconClockHour4, IconArrowsSplit, IconUser, IconBabyCarriage } from '@tabler/icons-react';
import { refreshEventsForScenario, clearEventOverridesForScenario } from '../store/eventSlice';
import { updateDatesOfInterest } from '../store/datesOfInterestSlice';
import { loadBookingsByScenario } from '../store/simBookingSlice';
import { loadGroupsByScenario } from '../store/simGroupSlice';
import { loadQualificationAssignmentsByScenario } from '../store/simQualificationSlice';
import { loadOverlaysByScenario } from '../store/simOverlaySlice';
import { loadFinanceByScenario } from '../store/simFinanceSlice';
import { buildScenarioCleanupResult } from '../utils/scenarioCleanup';
import DataImportModal from './modals/DataImportModal';

const NAV_ITEMS = [
  {
    value: 'data',
    label: 'Daten',
    icon: IconDatabase,
    subItems: [
      { value: 'capacity', label: 'Mitarbeiter', icon: IconUser },
      { value: 'demand', label: 'Kinder', icon: IconBabyCarriage },
    ],
  },
  {
    value: 'visu',
    label: 'Analyse',
    icon: IconChartBar,
    subItems: [
      { value: 'quality', label: 'Datenqualität', icon: IconAlertTriangle },
      { value: 'status', label: 'Bedarfsdeckung', icon: IconChartBar },
      { value: 'transitions', label: 'Resilienz', icon: IconRoute },
      { value: 'cohort', label: 'Finanzen', icon: IconClockHour4 },
      { value: 'compare', label: 'Ausblick', icon: IconArrowsSplit },
      { value: 'options', label: 'Optionen-Check', icon: IconTools },
      { value: 'trends', label: 'Trend-Radar', icon: IconChartBar },
    ],
  },
  {
    value: 'settings',
    label: 'Optionen',
    icon: IconSettings,
    subItems: [
      { value: 'scenarios', label: 'Szenarien', icon: IconLayersIntersect },
      { value: 'groups', label: 'Gruppen', icon: IconUsers },
      { value: 'qualifications', label: 'Qualifikationen', icon: IconCertificate },
      { value: 'events', label: 'Ereignisse', icon: IconCalendarEvent },
      { value: 'finance-funding', label: 'Förderung', icon: IconTools },
      { value: 'finance-absence', label: 'Bezahlte Abwesenheit', icon: IconTools },
      { value: 'finance-fees', label: 'Beiträge', icon: IconTools },
    ],
  },
  { value: 'events', label: 'Ereignisse', icon: IconCalendarEvent },
];

function NavigationItem({ item, active, compact = false, collapsed = false, onClick }) {
  const Icon = item.icon;

  return (
    <UnstyledButton
      type="button"
      onClick={onClick}
      className={`app-nav-item ${active ? 'is-active' : ''} ${compact ? 'is-compact' : ''} ${collapsed ? 'is-collapsed' : ''}`}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
    >
      <Icon size={compact ? 18 : 20} stroke={1.8} />
      <Text className="app-nav-item-label" size={compact ? 'xs' : 'sm'} fw={active ? 700 : 600}>
        {item.label}
      </Text>
    </UnstyledButton>
  );
}

function ActionMenu({
  browserAutoSaveEnabled,
  canSave,
  handleAutoSaveToggle,
  onImport,
  onSave,
  onLoad,
  onCleanup,
}) {
  return (
    <Menu shadow="md" width={220} position="bottom-end">
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
        <Menu.Item leftSection={<IconUpload size={16} />} onClick={onImport}>
          Adebis Import
        </Menu.Item>
        <Menu.Item leftSection={<IconDeviceFloppy size={16} />} onClick={onSave}>
          Szenario speichern
        </Menu.Item>
        <Menu.Item leftSection={<IconFolderOpen size={16} />} onClick={onLoad}>
          Szenario laden
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item
          leftSection={<IconTrash size={16} />}
          rightSection={<IconRefresh size={14} />}
          onClick={onCleanup}
        >
          Bereinigen / neu berechnen
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

function TopNav({ variant = 'sidebar', sidebarCollapsed = false, onToggleSidebar }) {
  const dispatch = useDispatch();
  const canSave = useSelector(isSaveAllowed);
  const scenarios = useSelector((state) => state.simScenario.scenarios);
  const selectedScenarioId = useSelector((state) => state.simScenario.selectedScenarioId);
  const activePage = useSelector((state) => state.ui.activePage);
  const dataSubmenu = useSelector((state) => state.ui.dataSubmenu || 'capacity');
  const activeSettingsSubPage = useSelector((state) => state.ui.settingsSubPage || 'groups');
  const normalizedSettingsSubPage = activeSettingsSubPage === 'finance' ? 'finance-funding' : activeSettingsSubPage;
  const activeAnalysisSubPage = useSelector((state) => state.ui.analysisSubPage || 'quality');
  const normalizedAnalysisSubPage = activeAnalysisSubPage === 'demography' ? 'compare' : activeAnalysisSubPage;
  const browserAutoSaveEnabled = useSelector((state) => state.ui.browserAutoSaveEnabled);
  const store = useStore();
  const [importModalOpen, setImportModalOpen] = React.useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = React.useState(false);
  const [cleanupModalOpen, setCleanupModalOpen] = React.useState(false);
  const [resetEventOverrides, setResetEventOverrides] = React.useState(true);
  const showScenarioSelector = (scenarios?.length || 0) > 1;

  React.useEffect(() => {
    if (activeAnalysisSubPage === normalizedAnalysisSubPage) return;
    dispatch(setAnalysisSubPage(normalizedAnalysisSubPage));
  }, [activeAnalysisSubPage, dispatch, normalizedAnalysisSubPage]);

  React.useEffect(() => {
    if (activeSettingsSubPage === normalizedSettingsSubPage) return;
    dispatch(setSettingsSubPage(normalizedSettingsSubPage));
  }, [activeSettingsSubPage, normalizedSettingsSubPage, dispatch]);

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

  const openActionMenu = (
    <ActionMenu
      browserAutoSaveEnabled={browserAutoSaveEnabled}
      canSave={canSave}
      handleAutoSaveToggle={handleAutoSaveToggle}
      onImport={() => setImportModalOpen(true)}
      onSave={() => dispatch(setSaveDialogOpen(true))}
      onLoad={() => dispatch(setLoadDialogOpen(true))}
      onCleanup={() => setCleanupModalOpen(true)}
    />
  );

  const navigation = (
    <Stack gap="xs">
      {NAV_ITEMS.map((item) => (
        <Stack key={item.value} gap={4}>
          <NavigationItem
            item={item}
            active={activePage === item.value}
            collapsed={variant === 'sidebar' && sidebarCollapsed}
            onClick={() => {
              dispatch(setActivePage(item.value));
              if (item.value === 'visu' && !activeAnalysisSubPage) {
                dispatch(setAnalysisSubPage('quality'));
              }
              if (item.value === 'settings' && !activeSettingsSubPage) {
                dispatch(setSettingsSubPage('groups'));
              }
            }}
          />

          {variant === 'sidebar' && !sidebarCollapsed && activePage === item.value && Array.isArray(item.subItems) && (
            <Stack gap={2} className="app-nav-submenu">
              {item.subItems.map((subItem) => (
                <UnstyledButton
                  key={subItem.value}
                  className={`app-nav-subitem ${(
                    item.value === 'settings'
                      ? normalizedSettingsSubPage
                      : item.value === 'data'
                        ? dataSubmenu
                        : normalizedAnalysisSubPage
                  ) === subItem.value ? 'is-active' : ''}`}
                  onClick={() => {
                    dispatch(setActivePage(item.value));
                    if (item.value === 'settings') {
                      dispatch(setSettingsSubPage(subItem.value));
                    }
                    if (item.value === 'data') {
                      dispatch(setDataSubmenu(subItem.value));
                    }
                    if (item.value === 'visu') {
                      dispatch(setAnalysisSubPage(subItem.value));
                    }
                  }}
                >
                  <subItem.icon size={14} stroke={1.8} />
                  <Text
                    size="xs"
                    fw={(
                      item.value === 'settings'
                        ? normalizedSettingsSubPage
                        : item.value === 'data'
                          ? dataSubmenu
                          : normalizedAnalysisSubPage
                    ) === subItem.value ? 700 : 600}
                  >
                    {subItem.label}
                  </Text>
                </UnstyledButton>
              ))}
            </Stack>
          )}
        </Stack>
      ))}
    </Stack>
  );

  return (
    <>
      {variant === 'mobile-header' ? (
        <Box className="app-mobile-topbar">
          <Group justify="space-between" align="center" wrap="nowrap" h="100%" gap="sm">
            <Text className="app-mobile-brand" fw={700}>
              CapaKita
            </Text>

            <Group wrap="nowrap" gap="xs" style={{ flex: 1, minWidth: 0, justifyContent: 'flex-end' }}>
              {showScenarioSelector && (
                <Select
                  aria-label="Szenario auswählen"
                  placeholder="Szenario wählen"
                  data={scenarioOptions}
                  value={selectedScenarioId ? String(selectedScenarioId) : null}
                  onChange={(value) => value && dispatch(setSelectedScenarioId(value))}
                  allowDeselect={false}
                  size="xs"
                  className="app-mobile-scenario-select"
                />
              )}
              {openActionMenu}
            </Group>
          </Group>
        </Box>
      ) : (
        <Box className={`app-sidebar ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
          <Stack gap="lg" className="app-sidebar-stack">
            <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
              <div className="app-sidebar-brand-wrap">
                <Text className="app-sidebar-brand" fw={800}>
                  {sidebarCollapsed ? 'CK' : 'CapaKita'}
                </Text>
                {!sidebarCollapsed && (
                  <Text size="xs" c="dimmed" mt={4}>
                    Arbeitsbereiche
                  </Text>
                )}
              </div>
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={onToggleSidebar}
                aria-label={sidebarCollapsed ? 'Seitenleiste ausklappen' : 'Seitenleiste einklappen'}
                title={sidebarCollapsed ? 'Ausklappen' : 'Einklappen'}
              >
                {sidebarCollapsed ? <IconLayoutSidebarLeftExpand size={16} /> : <IconLayoutSidebarLeftCollapse size={16} />}
              </ActionIcon>
            </Group>

            {!sidebarCollapsed && showScenarioSelector && (
              <Select
                aria-label="Szenario auswählen"
                placeholder="Szenario wählen"
                data={scenarioOptions}
                value={selectedScenarioId ? String(selectedScenarioId) : null}
                onChange={(value) => value && dispatch(setSelectedScenarioId(value))}
                allowDeselect={false}
                size="sm"
              />
            )}

            {navigation}

            <Box className="app-sidebar-spacer" />

            <Stack gap="xs">
              {!sidebarCollapsed ? (
                <>
                  <Button
                    variant="light"
                    size="sm"
                    fullWidth
                    justify="flex-start"
                    leftSection={<IconUpload size={16} />}
                    onClick={() => setImportModalOpen(true)}
                  >
                    Import
                  </Button>
                  <Button
                    variant="light"
                    size="sm"
                    fullWidth
                    justify="flex-start"
                    leftSection={<IconFolderOpen size={16} />}
                    onClick={() => dispatch(setLoadDialogOpen(true))}
                  >
                    Laden
                  </Button>
                  <Button
                    variant="light"
                    size="sm"
                    fullWidth
                    justify="flex-start"
                    leftSection={<IconTrash size={16} />}
                    onClick={() => setCleanupModalOpen(true)}
                  >
                    Bereinigen
                  </Button>
                </>
              ) : (
                <Group justify="center" gap="xs" wrap="nowrap">
                  <ActionIcon variant="light" size="lg" onClick={() => setImportModalOpen(true)} aria-label="Import" title="Import">
                    <IconUpload size={16} />
                  </ActionIcon>
                  <ActionIcon variant="light" size="lg" onClick={() => dispatch(setLoadDialogOpen(true))} aria-label="Laden" title="Laden">
                    <IconFolderOpen size={16} />
                  </ActionIcon>
                </Group>
              )}

              <Group justify="space-between" align="center" wrap="nowrap" className="app-sidebar-menu-row">
                {!sidebarCollapsed && (
                  <Text size="xs" c="dimmed">
                    Weitere Aktionen
                  </Text>
                )}
                {openActionMenu}
              </Group>
            </Stack>
          </Stack>
        </Box>
      )}

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
    </>
  );
}

export function MobileBottomNav() {
  const dispatch = useDispatch();
  const activePage = useSelector((state) => state.ui.activePage);
  const dataSubmenu = useSelector((state) => state.ui.dataSubmenu || 'capacity');
  const activeSettingsSubPage = useSelector((state) => state.ui.settingsSubPage || 'groups');
  const normalizedSettingsSubPage = activeSettingsSubPage === 'finance' ? 'finance-funding' : activeSettingsSubPage;
  const activeAnalysisSubPage = useSelector((state) => state.ui.analysisSubPage || 'quality');
  const normalizedAnalysisSubPage = activeAnalysisSubPage === 'demography' ? 'compare' : activeAnalysisSubPage;

  const mobileItems = React.useMemo(
    () => NAV_ITEMS.map((item) => {
      if (item.value === 'data') {
        const activeSub = item.subItems?.find((entry) => entry.value === dataSubmenu);
        return {
          ...item,
          label: activeSub ? `Daten: ${activeSub.label}` : item.label,
        };
      }
      if (item.value === 'visu') {
        const activeSub = item.subItems?.find((entry) => entry.value === normalizedAnalysisSubPage);
        return {
          ...item,
          label: activeSub ? `Analyse: ${activeSub.label}` : item.label,
        };
      }
      if (item.value !== 'settings') return item;
      const activeSub = item.subItems?.find((entry) => entry.value === normalizedSettingsSubPage);
      return {
        ...item,
        label: activeSub ? `Optionen: ${activeSub.label}` : item.label,
      };
    }),
    [dataSubmenu, normalizedSettingsSubPage, normalizedAnalysisSubPage]
  );

  return (
    <Box className="app-mobile-bottomnav">
      <Group grow align="stretch" gap={0} wrap="nowrap" h="100%">
        {mobileItems.map((item) => (
          <NavigationItem
            key={item.value}
            item={item}
            compact
            active={activePage === item.value}
            onClick={() => dispatch(setActivePage(item.value))}
          />
        ))}
      </Group>
    </Box>
  );
}

export default TopNav;
