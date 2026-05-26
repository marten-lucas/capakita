import React, { useMemo, useRef, useState } from 'react';
import { Group, Avatar, Badge, Text, ActionIcon, Stack, Tooltip, Checkbox, Button, Paper, TextInput, NumberInput, SimpleGrid, Switch, Menu } from '@mantine/core';
import { useSelector, useDispatch } from 'react-redux';
import { setSelectedItem, setSelectedItems, selectSelectedItemIds } from '../../store/simScenarioSlice';
import { setDataCaptureQueueMode, setDataListFilter } from '../../store/uiSlice';
import {
  deleteDataItemThunk,
  deleteDataItemsThunk,
  bulkUpdateDataItemsThunk,
  bulkSetQualificationThunk,
  bulkUpsertPersonnelCostThunk,
  updateDataItemThunk,
} from '../../store/simDataSlice';
import { useOverlayData } from '../../hooks/useOverlayData';
import { IconTrash, IconUser, IconBabyCarriage, IconChevronRight, IconCheck, IconArchive, IconArchiveOff, IconDotsVertical } from '@tabler/icons-react';
import { getDateRangeString } from '../../utils/dateUtils';
import { sumBookingHours } from '../../utils/bookingUtils';
import { shouldShowDataItemInEditor } from '../../utils/dataVisibility';
import { getEffectiveGroupAssignments, getScenarioChain } from '../../utils/overlayUtils';
import TabbedListDetail from '../common/TabbedListDetail';
import SimDataTabs from './SimDataTabs';
import GroupIcon from '../common/GroupIcon';
import QualificationPicker from './QualificationPicker';

function BulkEditPanel({ canEditCapacityOnly, onApply }) {
  const [assistantMode, setAssistantMode] = useState('validity');
  const [applyValidFrom, setApplyValidFrom] = useState(false);
  const [applyValidUntil, setApplyValidUntil] = useState(false);
  const [applyQualification, setApplyQualification] = useState(false);
  const [applySalary, setApplySalary] = useState(false);
  const [applyOnCost, setApplyOnCost] = useState(false);
  const [applyNote, setApplyNote] = useState(false);

  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [qualification, setQualification] = useState('');
  const [annualGrossSalary, setAnnualGrossSalary] = useState('');
  const [employerOnCostPercent, setEmployerOnCostPercent] = useState('');
  const [note, setNote] = useState('');

  const canApplyValidity = applyValidFrom || applyValidUntil;
  const canApplyTeam = canEditCapacityOnly && applyQualification;
  const canApplyCost = canEditCapacityOnly && (applySalary || applyOnCost || applyNote || applyValidFrom || applyValidUntil);
  const canApply = canApplyValidity || canApplyTeam || canApplyCost;

  return (
    <Stack gap="md">
      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <Text fw={600}>Mehrfachbearbeitung</Text>
          <Text size="sm" c="dimmed">
            Wähle einen Assistenzmodus. Nur aktivierte Felder werden angewendet.
          </Text>
          <SegmentedControl
            value={assistantMode}
            onChange={setAssistantMode}
            data={[
              { value: 'validity', label: 'Gültigkeit' },
              { value: 'team', label: 'Qualifikation' },
              { value: 'cost', label: 'Kosten' },
            ]}
            fullWidth
          />
        </Stack>
      </Paper>

      {assistantMode === 'validity' && (
        <Paper withBorder p="md" radius="md">
          <Stack gap="sm">
            <Text fw={600}>Assistenz: Gültigkeit</Text>
            <Group gap="xs" align="center">
              <Checkbox checked={applyValidFrom} onChange={(event) => setApplyValidFrom(event.currentTarget.checked)} />
              <Text size="sm" fw={500}>Gültig von setzen</Text>
            </Group>
            <TextInput
              placeholder="YYYY-MM-DD"
              value={validFrom}
              onChange={(event) => setValidFrom(event.currentTarget.value)}
              disabled={!applyValidFrom}
            />

            <Group gap="xs" align="center">
              <Checkbox checked={applyValidUntil} onChange={(event) => setApplyValidUntil(event.currentTarget.checked)} />
              <Text size="sm" fw={500}>Gültig bis setzen</Text>
            </Group>
            <TextInput
              placeholder="YYYY-MM-DD"
              value={validUntil}
              onChange={(event) => setValidUntil(event.currentTarget.value)}
              disabled={!applyValidUntil}
            />
          </Stack>
        </Paper>
      )}

      {assistantMode === 'team' && (
        <Paper withBorder p="md" radius="md">
          <Stack gap="sm">
            <Text fw={600}>Assistenz: Qualifikation</Text>
            {!canEditCapacityOnly && (
              <Text size="sm" c="dimmed">
                Diese Assistenz ist nur verfügbar, wenn ausschließlich Mitarbeiter ausgewählt sind.
              </Text>
            )}

            <Group gap="xs" align="center">
              <Checkbox
                checked={applyQualification}
                onChange={(event) => setApplyQualification(event.currentTarget.checked)}
                disabled={!canEditCapacityOnly}
              />
              <Text size="sm" fw={500}>Qualifikation setzen</Text>
            </Group>
            <div style={{ opacity: canEditCapacityOnly && applyQualification ? 1 : 0.5, pointerEvents: canEditCapacityOnly && applyQualification ? 'auto' : 'none' }}>
              <QualificationPicker value={qualification} onChange={(value) => setQualification(value || '')} />
            </div>
          </Stack>
        </Paper>
      )}

      {assistantMode === 'cost' && (
        <Paper withBorder p="md" radius="md">
          <Stack gap="sm">
            <Text fw={600}>Assistenz: Personalkosten</Text>
            {!canEditCapacityOnly && (
              <Text size="sm" c="dimmed">
                Diese Assistenz ist nur verfügbar, wenn ausschließlich Mitarbeiter ausgewählt sind.
              </Text>
            )}

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
              <Stack gap="xs">
                <Group gap="xs" align="center">
                  <Checkbox
                    checked={applySalary}
                    onChange={(event) => setApplySalary(event.currentTarget.checked)}
                    disabled={!canEditCapacityOnly}
                  />
                  <Text size="sm" fw={500}>Bruttojahresgehalt</Text>
                </Group>
                <NumberInput
                  value={annualGrossSalary}
                  onChange={(value) => setAnnualGrossSalary(value ?? '')}
                  disabled={!applySalary || !canEditCapacityOnly}
                  min={0}
                  suffix=" EUR"
                />
              </Stack>

              <Stack gap="xs">
                <Group gap="xs" align="center">
                  <Checkbox
                    checked={applyOnCost}
                    onChange={(event) => setApplyOnCost(event.currentTarget.checked)}
                    disabled={!canEditCapacityOnly}
                  />
                  <Text size="sm" fw={500}>AG-Nebenkosten</Text>
                </Group>
                <NumberInput
                  value={employerOnCostPercent}
                  onChange={(value) => setEmployerOnCostPercent(value ?? '')}
                  disabled={!applyOnCost || !canEditCapacityOnly}
                  min={0}
                  max={200}
                  suffix=" %"
                />
              </Stack>
            </SimpleGrid>

            <Group gap="xs" align="center">
              <Checkbox
                checked={applyNote}
                onChange={(event) => setApplyNote(event.currentTarget.checked)}
                disabled={!canEditCapacityOnly}
              />
              <Text size="sm" fw={500}>Notiz setzen</Text>
            </Group>
            <TextInput
              value={note}
              onChange={(event) => setNote(event.currentTarget.value)}
              disabled={!applyNote || !canEditCapacityOnly}
            />
          </Stack>
        </Paper>
      )}

      <Group justify="flex-end">
        <Button
          leftSection={<IconCheck size={16} />}
          disabled={!canApply}
          onClick={() =>
            onApply({
              applyValidFrom,
              applyValidUntil,
              applyQualification,
              applySalary,
              applyOnCost,
              applyNote,
              validFrom,
              validUntil,
              qualification,
              annualGrossSalary,
              employerOnCostPercent,
              note,
            })
          }
        >
          Auf Auswahl anwenden
        </Button>
      </Group>
    </Stack>
  );
}

function SimDataList() {
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const selectedItemIds = useSelector(selectSelectedItemIds);
  const selectedItemId = selectedItemIds[0] || null;
  const scenarios = useSelector(state => state.simScenario.scenarios);
  const overlaysByScenario = useSelector(state => state.simOverlay.overlaysByScenario);
  const groupsByScenario = useSelector(state => state.simGroup.groupsByScenario);

  const scenarioChain = useMemo(
    () => getScenarioChain(scenarios, selectedScenarioId),
    [scenarios, selectedScenarioId]
  );

  const {
    getEffectiveDataItems,
    hasOverlay,
    getEffectiveGroupDefs,
    getEffectiveBookings,
    getEffectiveQualificationDefs,
    getEffectiveQualificationAssignments
  } = useOverlayData();

  const effectiveDataItems = getEffectiveDataItems();
  const groupDefs = getEffectiveGroupDefs();
  const qualificationDefs = getEffectiveQualificationDefs();
  const [showArchivedItems, setShowArchivedItems] = useState(false);
  const dataListFilter = useSelector((state) => state.ui.dataListFilter || 'all');
  const dataCaptureQueueMode = useSelector((state) => state.ui.dataCaptureQueueMode || false);
  const activeFilterLabel = {
    all: 'Alle',
    incomplete: 'Unvollständig',
    missing_booking: 'Ohne Buchung',
    missing_group: 'Ohne Gruppe',
    missing_birthdate: 'Ohne Geburtsdatum',
    missing_name: 'Ohne Name',
  }[dataListFilter] || 'Alle';

  const missingReasonByItemId = useMemo(() => {
    const map = {};
    const referenceDate = new Date().toISOString().slice(0, 10);

    Object.entries(effectiveDataItems).forEach(([id, item]) => {
      const bookingsObj = getEffectiveBookings(id);
      const bookingCount = Object.keys(bookingsObj || {}).length;
      const groupAssignments = getEffectiveGroupAssignments(scenarioChain, overlaysByScenario, groupsByScenario, id);
      const assignments = Object.values(groupAssignments || {});
      const activeGroup = assignments.find((assignment) => {
        const startOk = !assignment?.start || assignment.start <= referenceDate;
        const endOk = !assignment?.end || assignment.end >= referenceDate;
        return startOk && endOk;
      });

      const reasons = {
        missingBooking: bookingCount === 0,
        missingGroup: !activeGroup,
        missingBirthDate: item.type === 'demand' && !item.dateofbirth,
        missingName: !String(item.name || '').trim(),
      };

      map[id] = reasons;
    });

    return map;
  }, [effectiveDataItems, getEffectiveBookings, scenarioChain, overlaysByScenario, groupsByScenario]);

  const data = useMemo(
    () => {
      const today = new Date().toISOString().slice(0, 10);

      return Object.entries(effectiveDataItems)
        .map(([key, item]) => ({
          ...item,
          id: key,
          _key: key,
        }))
        .filter((item) => shouldShowDataItemInEditor(item, today))
        .filter((item) => {
          const missing = missingReasonByItemId[item.id] || {};
          if (dataListFilter === 'missing_booking') return missing.missingBooking;
          if (dataListFilter === 'missing_group') return missing.missingGroup;
          if (dataListFilter === 'missing_birthdate') return missing.missingBirthDate;
          if (dataListFilter === 'missing_name') return missing.missingName;
          if (dataListFilter === 'incomplete') {
            return missing.missingBooking || missing.missingGroup || missing.missingBirthDate || missing.missingName;
          }
          return true;
        })
        .filter((item) => showArchivedItems || !item.archived);
    },
    [effectiveDataItems, showArchivedItems, dataListFilter, missingReasonByItemId]
  );

  const incompleteIds = useMemo(
    () => data
      .filter((item) => {
        const missing = missingReasonByItemId[item.id] || {};
        return missing.missingBooking || missing.missingGroup || missing.missingBirthDate || missing.missingName;
      })
      .map((item) => item.id),
    [data, missingReasonByItemId]
  );

  const selectNextIncomplete = React.useCallback(() => {
    if (incompleteIds.length === 0) return;
    const currentIndex = incompleteIds.findIndex((id) => id === selectedItemId);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % incompleteIds.length : 0;
    const nextId = incompleteIds[nextIndex];
    dispatch(setSelectedItems([nextId]));
    dispatch(setSelectedItem(nextId));
  }, [incompleteIds, selectedItemId, dispatch]);

  React.useEffect(() => {
    if (dataCaptureQueueMode && dataListFilter === 'all') {
      dispatch(setDataListFilter('incomplete'));
    }
  }, [dataCaptureQueueMode, dataListFilter, dispatch]);

  React.useEffect(() => {
    const isTypingTarget = (target) => {
      if (!target || !(target instanceof HTMLElement)) return false;
      const tagName = target.tagName.toLowerCase();
      return (
        tagName === 'input'
        || tagName === 'textarea'
        || tagName === 'select'
        || target.isContentEditable
        || target.getAttribute('role') === 'textbox'
      );
    };

    const handleKeyDown = (event) => {
      if (!dataCaptureQueueMode) return;
      if (event.defaultPrevented) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        selectNextIncomplete();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [dataCaptureQueueMode, selectNextIncomplete]);

  const selectedItems = useMemo(
    () => data.filter((item) => selectedItemIds.includes(item.id)),
    [data, selectedItemIds]
  );
  const lastSelectedIndexRef = useRef(null);

  const isMultiSelected = selectedItemIds.length > 1;
  const isCapacityOnlySelection = selectedItems.length > 0 && selectedItems.every((item) => item.type === 'capacity');

  const toggleSelectedItem = (itemId, checked) => {
    const id = String(itemId);
    const nextIds = checked
      ? Array.from(new Set([id, ...selectedItemIds]))
      : selectedItemIds.filter((existingId) => existingId !== id);
    dispatch(setSelectedItems(nextIds));
    const index = data.findIndex((item) => item.id === id);
    if (index >= 0) {
      lastSelectedIndexRef.current = index;
    }
  };

  const selectRangeToItem = (itemId, checked) => {
    const targetIndex = data.findIndex((item) => item.id === String(itemId));
    if (targetIndex < 0) return;

    const anchorIndex = lastSelectedIndexRef.current;
    if (anchorIndex === null || anchorIndex < 0 || anchorIndex >= data.length) {
      toggleSelectedItem(itemId, checked);
      return;
    }

    const from = Math.min(anchorIndex, targetIndex);
    const to = Math.max(anchorIndex, targetIndex);
    const rangeIds = data.slice(from, to + 1).map((item) => item.id);

    let nextIds;
    if (checked) {
      nextIds = Array.from(new Set([...selectedItemIds, ...rangeIds]));
    } else {
      const rangeIdSet = new Set(rangeIds);
      nextIds = selectedItemIds.filter((id) => !rangeIdSet.has(id));
    }

    dispatch(setSelectedItems(nextIds));
    lastSelectedIndexRef.current = targetIndex;
  };

  const clearSelection = () => {
    dispatch(setSelectedItems([]));
    lastSelectedIndexRef.current = null;
  };

  const handleBulkDelete = () => {
    if (!selectedScenarioId || selectedItemIds.length < 2) return;
    if (!window.confirm(`${selectedItemIds.length} Einträge wirklich löschen?`)) return;
    dispatch(deleteDataItemsThunk({ scenarioId: selectedScenarioId, itemIds: selectedItemIds }));
    clearSelection();
  };

  const handleArchiveSelected = (archived) => {
    if (!selectedScenarioId || selectedItemIds.length === 0) return;
    dispatch(bulkUpdateDataItemsThunk({
      scenarioId: selectedScenarioId,
      itemIds: selectedItemIds,
      updates: { archived: Boolean(archived) },
    }));
    if (!showArchivedItems || archived) {
      clearSelection();
    }
  };

  const handleApplyBulkEdits = (values) => {
    if (!selectedScenarioId || selectedItemIds.length < 2) return;

    const updates = {};
    if (values.applyValidFrom) updates.validFrom = values.validFrom || '';
    if (values.applyValidUntil) updates.validUntil = values.validUntil || '';

    if (Object.keys(updates).length > 0) {
      dispatch(bulkUpdateDataItemsThunk({ scenarioId: selectedScenarioId, itemIds: selectedItemIds, updates }));
    }

    if (isCapacityOnlySelection && values.applyQualification) {
      dispatch(bulkSetQualificationThunk({
        scenarioId: selectedScenarioId,
        itemIds: selectedItemIds,
        qualification: values.qualification || '',
      }));
    }

    if (isCapacityOnlySelection && (values.applySalary || values.applyOnCost || values.applyNote || values.applyValidFrom || values.applyValidUntil)) {
      const entryUpdates = {};
      if (values.applySalary) entryUpdates.annualGrossSalary = values.annualGrossSalary;
      if (values.applyOnCost) entryUpdates.employerOnCostPercent = values.employerOnCostPercent;
      if (values.applyNote) entryUpdates.note = values.note;
      if (values.applyValidFrom) entryUpdates.validFrom = values.validFrom || '';
      if (values.applyValidUntil) entryUpdates.validUntil = values.validUntil || '';

      if (Object.keys(entryUpdates).length > 0) {
        dispatch(bulkUpsertPersonnelCostThunk({ scenarioId: selectedScenarioId, itemIds: selectedItemIds, entryUpdates }));
      }
    }
  };

  const getGroupDef = (groupId) => groupId ? groupDefs.find(g => String(g.id) === String(groupId)) : null;

  const getActiveGroupAssignment = (assignments, referenceDate) => {
    if (!Array.isArray(assignments) || assignments.length === 0) return null;

    const active = assignments.find((assignment) => {
      const startOk = !assignment?.start || assignment.start <= referenceDate;
      const endOk = !assignment?.end || assignment.end >= referenceDate;
      return startOk && endOk;
    });

    if (active) return active;

    return assignments
      .slice()
      .sort((a, b) => {
        const aStart = a?.start || '';
        const bStart = b?.start || '';
        return bStart.localeCompare(aStart);
      })[0] || null;
  };

  const renderItem = (item) => {
    const referenceDate = new Date().toISOString().slice(0, 10);
    const bookings = Object.values(getEffectiveBookings(item._key));
    const subtitle = bookings.length > 0 ? getDateRangeString(bookings[0].startdate, bookings[0].enddate, sumBookingHours(bookings[0])) : '';
    
    const groupAssignments = getEffectiveGroupAssignments(scenarioChain, overlaysByScenario, groupsByScenario, item._key);
    const assignments = groupAssignments ? Object.values(groupAssignments) : [];
    const groupAssignment = getActiveGroupAssignment(assignments, referenceDate);
    const groupDef = groupAssignment ? getGroupDef(groupAssignment.groupId) : null;

    const isExpert = item.type === 'capacity' && getEffectiveQualificationAssignments(item._key).some(a => {
        const def = qualificationDefs.find(d => d.key === a.qualification);
        return def?.IsExpert !== false;
    });
    const missing = missingReasonByItemId[item.id] || {};

    return (
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Group wrap="nowrap" style={{ minWidth: 0 }}>
          <Checkbox
            checked={selectedItemIds.includes(item.id)}
            onChange={(event) => {
              event.stopPropagation();
              if (event.nativeEvent?.shiftKey) {
                selectRangeToItem(item.id, event.currentTarget.checked);
              } else {
                toggleSelectedItem(item.id, event.currentTarget.checked);
              }
            }}
            onClick={(event) => event.stopPropagation()}
          />
          <Avatar color={item.type === 'demand' ? 'cyan' : 'green'} radius="xl">
            {groupDef?.icon ? (
              <GroupIcon icon={groupDef.icon} size={16} />
            ) : item.type === 'demand' ? (
              <IconBabyCarriage size={20} />
            ) : (
              <IconUser size={20} />
            )}
          </Avatar>
          <div style={{ minWidth: 0 }}>
            <Group gap={5} wrap="wrap">
                <Text size="sm" fw={500}>{item.name}</Text>
                {hasOverlay(item._key) && <Badge size="xs" color="orange" variant="light">Neu</Badge>}
              {item.archived && <Badge size="xs" color="gray" variant="light">Archiv</Badge>}
              {missing.missingName && <Badge size="xs" color="red" variant="light">Name fehlt</Badge>}
              {missing.missingBooking && <Badge size="xs" color="yellow" variant="light">Buchung fehlt</Badge>}
              {missing.missingGroup && <Badge size="xs" color="yellow" variant="light">Gruppe fehlt</Badge>}
              {missing.missingBirthDate && <Badge size="xs" color="yellow" variant="light">Geburtsdatum fehlt</Badge>}
            </Group>
            <Text size="xs" c="dimmed" lineClamp={2}>{subtitle}</Text>
          </div>
        </Group>
        
        <Group gap={4} wrap="wrap">
            {item.type === 'capacity' && getEffectiveQualificationAssignments(item._key).map(a => (
                <Badge key={a.id} size="xs" variant="outline" color={isExpert ? 'blue' : 'gray'}>
                    {qualificationDefs.find(d => d.key === a.qualification)?.initial || a.qualification}
                </Badge>
            ))}
            <IconChevronRight size={14} color="gray" />
        </Group>
      </Group>
    );
  };

  return (
    <Stack gap="sm">
      <Paper withBorder p="sm" radius="md">
        <Stack gap="sm">
          <Group justify="space-between" wrap="wrap">
            <Group gap="xs" align="center">
              <Text size="sm" c="dimmed">Datenliste</Text>
              {dataListFilter !== 'all' && (
                <Badge size="xs" variant="light">Filter: {activeFilterLabel}</Badge>
              )}
            </Group>
            <Group gap="xs" wrap="wrap">
              <Button
                size="xs"
                variant={dataCaptureQueueMode ? 'filled' : 'light'}
                onClick={() => dispatch(setDataCaptureQueueMode(!dataCaptureQueueMode))}
              >
                Erfassungs-Queue
              </Button>
              <Button
                size="xs"
                variant="light"
                onClick={selectNextIncomplete}
                disabled={incompleteIds.length === 0}
              >
                Nächster unvollständig
              </Button>
              <Switch
                size="sm"
                checked={showArchivedItems}
                onChange={(event) => setShowArchivedItems(event.currentTarget.checked)}
                label="Archivierte anzeigen"
              />
              <Menu shadow="md" width={220} position="bottom-end">
                <Menu.Target>
                  <ActionIcon variant="subtle" aria-label="Filter öffnen">
                    <IconDotsVertical size={16} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>Filter</Menu.Label>
                  <Menu.Item onClick={() => dispatch(setDataListFilter('all'))}>Alle</Menu.Item>
                  <Menu.Item onClick={() => dispatch(setDataListFilter('incomplete'))}>Unvollständig</Menu.Item>
                  <Menu.Item onClick={() => dispatch(setDataListFilter('missing_booking'))}>Ohne Buchung</Menu.Item>
                  <Menu.Item onClick={() => dispatch(setDataListFilter('missing_group'))}>Ohne Gruppe</Menu.Item>
                  <Menu.Item onClick={() => dispatch(setDataListFilter('missing_birthdate'))}>Ohne Geburtsdatum</Menu.Item>
                  <Menu.Item onClick={() => dispatch(setDataListFilter('missing_name'))}>Ohne Name</Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          </Group>

          {dataCaptureQueueMode && (
            <Text size="xs" c="dimmed">
              Queue aktiv: {incompleteIds.length} unvollständige Einträge erkannt.
            </Text>
          )}
        </Stack>
      </Paper>

      {selectedItemIds.length > 0 && (
        <Paper withBorder p="sm" radius="md">
          <Group justify="space-between" wrap="wrap">
            <Text size="sm" fw={500}>{selectedItemIds.length} ausgewählt</Text>
            <Group gap="xs">
              <Button size="xs" variant="light" leftSection={<IconArchive size={14} />} onClick={() => handleArchiveSelected(true)}>
                Auswahl archivieren
              </Button>
              <Button size="xs" variant="light" leftSection={<IconArchiveOff size={14} />} onClick={() => handleArchiveSelected(false)}>
                Aus Archiv holen
              </Button>
              {isMultiSelected && (
                <Button size="xs" color="red" variant="light" leftSection={<IconTrash size={14} />} onClick={handleBulkDelete}>
                  Auswahl löschen
                </Button>
              )}
              <Button size="xs" variant="subtle" onClick={clearSelection}>
                Auswahl aufheben
              </Button>
            </Group>
          </Group>
        </Paper>
      )}

      <TabbedListDetail
        data={data}
        selectedId={selectedItemId}
        onSelect={(id) => dispatch(setSelectedItem(id))}
        renderItem={renderItem}
        detailTitle={(item) => (isMultiSelected ? `${selectedItemIds.length} Einträge ausgewählt` : (item?.name || 'Details'))}
        detailContent={() => (
          isMultiSelected
            ? <BulkEditPanel canEditCapacityOnly={isCapacityOnlySelection} onApply={handleApplyBulkEdits} />
            : <SimDataTabs />
        )}
        actions={(item) => (
          <Group gap="xs">
            <Tooltip label={item.archived ? 'Aus Archiv holen' : 'Archivieren'}>
              <ActionIcon
                data-testid={`toggle-archive-${item._key}`}
                color={item.archived ? 'blue' : 'gray'}
                variant="subtle"
                onClick={() => {
                  dispatch(updateDataItemThunk({
                    scenarioId: selectedScenarioId,
                    itemId: item._key,
                    updates: { archived: !item.archived },
                  }));
                  if (!showArchivedItems && !item.archived) {
                    dispatch(setSelectedItems(selectedItemIds.filter((id) => id !== item._key)));
                  }
                }}
              >
                {item.archived ? <IconArchiveOff size={18} /> : <IconArchive size={18} />}
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Löschen">
              <ActionIcon
                color="red"
                variant="subtle"
                onClick={() => {
                  dispatch(deleteDataItemThunk({ scenarioId: selectedScenarioId, itemId: item._key }));
                  dispatch(setSelectedItems(selectedItemIds.filter((id) => id !== item._key)));
                }}
              >
                <IconTrash size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        )}
      />
    </Stack>
  );
}

export default SimDataList;
