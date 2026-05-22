import React, { useMemo, useRef, useState } from 'react';
import { Group, Avatar, Badge, Text, ActionIcon, Stack, Tooltip, Checkbox, Button, Paper, TextInput, NumberInput, SimpleGrid, Switch } from '@mantine/core';
import { useSelector, useDispatch } from 'react-redux';
import { setSelectedItem, setSelectedItems, selectSelectedItemIds } from '../../store/simScenarioSlice';
import {
  deleteDataItemThunk,
  deleteDataItemsThunk,
  bulkUpdateDataItemsThunk,
  bulkSetQualificationThunk,
  bulkUpsertPersonnelCostThunk,
  updateDataItemThunk,
} from '../../store/simDataSlice';
import { useOverlayData } from '../../hooks/useOverlayData';
import { IconTrash, IconUser, IconBabyCarriage, IconChevronRight, IconCheck, IconArchive, IconArchiveOff } from '@tabler/icons-react';
import { getDateRangeString } from '../../utils/dateUtils';
import { sumBookingHours } from '../../utils/bookingUtils';
import { shouldShowDataItemInEditor } from '../../utils/dataVisibility';
import { getEffectiveGroupAssignments, getScenarioChain } from '../../utils/overlayUtils';
import TabbedListDetail from '../common/TabbedListDetail';
import SimDataTabs from './SimDataTabs';
import GroupIcon from '../common/GroupIcon';
import QualificationPicker from './QualificationPicker';

function BulkEditPanel({ canEditCapacityOnly, onApply }) {
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

  const canApply =
    applyValidFrom ||
    applyValidUntil ||
    (canEditCapacityOnly && (applyQualification || applySalary || applyOnCost || applyNote));

  return (
    <Stack gap="md">
      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <Text fw={600}>Mehrfachbearbeitung</Text>
          <Text size="sm" c="dimmed">
            Nur aktivierte Felder werden auf alle ausgewählten Einträge angewendet.
          </Text>
        </Stack>
      </Paper>

      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
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

      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <Text fw={600}>Nur Mitarbeiter</Text>
          {!canEditCapacityOnly && (
            <Text size="sm" c="dimmed">
              Qualifikation und Personalkosten sind nur verfügbar, wenn ausschließlich Mitarbeiter ausgewählt sind.
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
        .filter((item) => showArchivedItems || !item.archived);
    },
    [effectiveDataItems, showArchivedItems]
  );

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
        <Group justify="space-between" wrap="wrap">
          <Text size="sm" c="dimmed">Datenliste</Text>
          <Switch
            size="sm"
            checked={showArchivedItems}
            onChange={(event) => setShowArchivedItems(event.currentTarget.checked)}
            label="Archivierte anzeigen"
          />
        </Group>
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
