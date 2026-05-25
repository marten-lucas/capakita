import React from 'react';
import { Stack, Text, Group, Paper, Select, SimpleGrid, Alert, Button, ActionIcon, TextInput, Badge } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconAlertTriangle, IconPlus, IconTrash } from '@tabler/icons-react';
import { useSelector, useDispatch } from 'react-redux';
import { useOverlayData } from '../../../hooks/useOverlayData';
import { getSegmentOverlapIssues, minutesToTime, normalizeTimeInput, timeToMinutes } from '../../../utils/timeUtils';

const MULTIPLE_GROUP_VALUE = '__MULTIPLE_GROUPS__';

function createSegmentId(prefix = 'segment') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function cloneSegments(segments) {
  return Array.isArray(segments)
    ? segments.map((segment) => ({ ...segment }))
    : [];
}

function getSuggestedSegmentRange(existingSegments) {
  const sorted = cloneSegments(existingSegments)
    .map((segment) => ({
      start: timeToMinutes(segment.startTime),
      end: timeToMinutes(segment.endTime),
    }))
    .filter((segment) => segment.start !== null && segment.end !== null && segment.end > segment.start)
    .sort((a, b) => a.end - b.end);

  if (sorted.length === 0) {
    return { startTime: '08:00', endTime: '09:00' };
  }

  const last = sorted[sorted.length - 1];
  const nextStart = Math.min(last.end, 23 * 60);
  const nextEnd = Math.min(nextStart + 60, 23 * 60 + 59);

  return {
    startTime: minutesToTime(nextStart),
    endTime: minutesToTime(Math.max(nextStart + 15, nextEnd)),
  };
}

function GroupDetail({ group }) {
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const selectedItemId = useSelector(state => state.simScenario.selectedItems?.[selectedScenarioId]);
  const { isBasedScenario, getEffectiveGroupDefs } = useOverlayData();

  const handleUpdateGroup = (updates) => {
    if (!group) return;
    const updatedGroup = { ...group, ...updates };

    if (isBasedScenario) {
      // In a more robust scenario, we'd check against base data from Redux state directly.
      // For now, we follow the pattern of setting the overlay.
      dispatch({
        type: 'simOverlay/setGroupAssignmentOverlay',
        payload: {
          scenarioId: selectedScenarioId,
          itemId: selectedItemId,
          groupId: group.id,
          overlayData: updatedGroup
        }
      });
    } else {
      dispatch({
        type: 'simGroup/updateGroup',
        payload: {
          scenarioId: selectedScenarioId,
          dataItemId: selectedItemId,
          groupId: group.id,
          updates: updatedGroup
        }
      });
    }
  };

  const groupDefs = getEffectiveGroupDefs();
  const groupSelectData = groupDefs.map(g => ({ value: String(g.id), label: g.name }));
  const selectData = [...groupSelectData, { value: MULTIPLE_GROUP_VALUE, label: 'Mehrere' }];

  const startDate = group.start ? new Date(group.start) : null;
  const endDate = group.end ? new Date(group.end) : null;
  const isMultipleMode = group.assignmentMode === 'multiple';
  const segments = cloneSegments(group.timeSegments);

  const normalizedOverlapSegments = segments.map((segment) => ({
    booking_start: segment.startTime,
    booking_end: segment.endTime,
  }));
  const overlapIssues = getSegmentOverlapIssues(normalizedOverlapSegments);
  const hasInvalidSegments = segments.some((segment) => {
    const start = timeToMinutes(segment.startTime);
    const end = timeToMinutes(segment.endTime);
    return start === null || end === null || end <= start || !segment.groupId;
  });

  const updateSegment = (segmentId, updates) => {
    const nextSegments = segments.map((segment) => (
      segment.id === segmentId ? { ...segment, ...updates } : segment
    ));
    handleUpdateGroup({ timeSegments: nextSegments });
  };

  const handleAddSegment = () => {
    const suggestedRange = getSuggestedSegmentRange(segments);
    handleUpdateGroup({
      timeSegments: [
        ...segments,
        {
          id: createSegmentId(group.id || 'group'),
          startTime: suggestedRange.startTime,
          endTime: suggestedRange.endTime,
          groupId: '',
        }
      ]
    });
  };

  const handleRemoveSegment = (segmentId) => {
    handleUpdateGroup({
      timeSegments: segments.filter((segment) => segment.id !== segmentId),
    });
  };

  return (
    <Stack gap="md">
      <Paper withBorder p="sm" radius="md">
        <Text fw={600} mb="xs">Gruppenauswahl</Text>
        <Select
          label="Zugeordnete Gruppe"
          placeholder="Gruppe wählen"
          data={selectData}
          value={isMultipleMode ? MULTIPLE_GROUP_VALUE : (group.groupId || '')}
          onChange={(val) => {
            if (val === MULTIPLE_GROUP_VALUE) {
              handleUpdateGroup({
                assignmentMode: 'multiple',
                groupId: '',
                name: 'Mehrere Gruppen',
                timeSegments: segments.length > 0
                  ? segments
                  : [{ id: createSegmentId(group.id || 'group'), startTime: '08:00', endTime: '09:00', groupId: '' }],
              });
              return;
            }

            const def = groupDefs.find(d => String(d.id) === String(val));
            handleUpdateGroup({
              assignmentMode: 'single',
              groupId: val || '',
              name: def?.name || '',
              timeSegments: [],
            });
          }}
          searchable
          clearable
        />
      </Paper>

      {isMultipleMode && (
        <Paper withBorder p="sm" radius="md">
          <Group justify="space-between" align="center" mb="xs">
            <Text fw={600}>Zeitliche Gruppenaufteilung</Text>
            <Button size="xs" leftSection={<IconPlus size={12} />} onClick={handleAddSegment}>
              Segment hinzufügen
            </Button>
          </Group>

          <Text size="xs" c="dimmed" mb="md">
            Teile den Zeitraum in Zeitsegmente auf und ordne jedem Segment eine Gruppe zu.
          </Text>

          {(overlapIssues.length > 0 || hasInvalidSegments) && (
            <Alert icon={<IconAlertTriangle size={16} />} color="orange" variant="light" mb="md">
              {overlapIssues.length > 0
                ? 'Zeitsegmente überlappen sich. Bitte korrigieren.'
                : 'Bitte in jedem Segment gültige Uhrzeiten und eine Gruppe setzen.'}
            </Alert>
          )}

          {segments.length === 0 ? (
            <Text size="sm" c="dimmed">Noch keine Zeitsegmente definiert.</Text>
          ) : (
            <Stack gap="sm">
              {segments.map((segment, index) => (
                <Paper key={segment.id || `${group.id}-${index}`} withBorder radius="md" p="sm" bg="gray.0">
                  <Stack gap="sm">
                    <Group justify="space-between" align="center">
                      <Badge variant="light">Segment {index + 1}</Badge>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => handleRemoveSegment(segment.id)}
                        aria-label="Segment löschen"
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>

                    <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
                      <TextInput
                        label="Von"
                        placeholder="HH:MM"
                        value={segment.startTime || ''}
                        onChange={(event) => updateSegment(segment.id, { startTime: event.currentTarget.value })}
                        onBlur={() => {
                          const normalized = normalizeTimeInput(segment.startTime);
                          if (normalized) updateSegment(segment.id, { startTime: normalized });
                        }}
                      />
                      <TextInput
                        label="Bis"
                        placeholder="HH:MM"
                        value={segment.endTime || ''}
                        onChange={(event) => updateSegment(segment.id, { endTime: event.currentTarget.value })}
                        onBlur={() => {
                          const normalized = normalizeTimeInput(segment.endTime);
                          if (normalized) updateSegment(segment.id, { endTime: normalized });
                        }}
                      />
                      <Select
                        label="Gruppe"
                        placeholder="Gruppe wählen"
                        data={groupSelectData}
                        value={segment.groupId || ''}
                        onChange={(val) => updateSegment(segment.id, { groupId: val || '' })}
                        searchable
                        clearable
                      />
                    </SimpleGrid>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </Paper>
      )}

      <Paper withBorder p="sm" radius="md">
        <Text fw={600} mb="xs">Zeitraum in der Gruppe</Text>
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <DatePickerInput
            label="Zugeordnet von"
            value={startDate}
            onChange={(date) => handleUpdateGroup({ 
              start: date ? date.toISOString().split('T')[0] : '' 
            })}
            placeholder="Datum wählen"
            clearable
          />
          <DatePickerInput
            label="Zugeordnet bis"
            value={endDate}
            onChange={(date) => handleUpdateGroup({ 
              end: date ? date.toISOString().split('T')[0] : '' 
            })}
            placeholder="Datum wählen"
            clearable
          />
        </SimpleGrid>
      </Paper>
    </Stack>
  );
}

export default GroupDetail;
