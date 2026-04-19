import React from 'react';
import { Stack, Text, Group, Paper, Select } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useSelector, useDispatch } from 'react-redux';
import { useOverlayData } from '../../../hooks/useOverlayData';

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
  const selectData = groupDefs.map(g => ({ value: g.id, label: g.name }));

  const startDate = group.start ? new Date(group.start) : null;
  const endDate = group.end ? new Date(group.end) : null;

  return (
    <Stack gap="md">
      <Paper withBorder p="sm" radius="md">
        <Text fw={600} mb="xs">Gruppenauswahl</Text>
        <Select
          label="Zugeordnete Gruppe"
          placeholder="Gruppe wählen"
          data={selectData}
          value={group.groupId || ''}
          onChange={(val) => {
            const def = groupDefs.find(d => d.id === val);
            handleUpdateGroup({ groupId: val, name: def?.name || '' });
          }}
          searchable
          clearable
        />
      </Paper>

      <Paper withBorder p="sm" radius="md">
        <Text fw={600} mb="xs">Zeitraum in der Gruppe</Text>
        <Group grow>
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
        </Group>
      </Paper>
    </Stack>
  );
}

export default GroupDetail;
