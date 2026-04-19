import React from 'react';
import { Stack, Button, Text, Group, Badge, ActionIcon, TextInput, Checkbox, Select } from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useSelector, useDispatch } from 'react-redux';
import { addGroupDef, updateGroupDef, deleteGroupDef } from '../../store/simGroupSlice';
import { useOverlayData } from '../../hooks/useOverlayData';
import TabbedListDetail from '../common/TabbedListDetail';

const ICON_OPTIONS = ['👥', '🧒', '🏫', '⭐', '🌈', '🚀'].map((icon) => ({ value: icon, label: icon }));

function OrgaTabGroupDefs() {
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector((state) => state.simScenario.selectedScenarioId);
  const { getEffectiveGroupDefs } = useOverlayData();
  const groupDefs = getEffectiveGroupDefs();

  const handleAddGroup = () => {
    dispatch(
      addGroupDef({
        scenarioId: selectedScenarioId,
        groupDef: {
          id: Date.now().toString(),
          name: 'Neue Gruppe',
          icon: '👥',
          IsSchool: false,
        },
      })
    );
  };

  return (
    <Stack gap="md">
      <Group justify="flex-end">
        <Button leftSection={<IconPlus size={16} />} onClick={handleAddGroup}>
          Neue Gruppe
        </Button>
      </Group>

      <TabbedListDetail
        data={groupDefs}
        emptyText="Keine Gruppen vorhanden."
        renderItem={(item) => (
          <Group gap="sm">
            <Text size="xl">{item.icon || '👥'}</Text>
            <div>
              <Text fw={500}>{item.name || 'Gruppe'}</Text>
              {item.IsSchool && <Badge size="xs">Schulkind</Badge>}
            </div>
          </Group>
        )}
        detailTitle={(item) => item?.name || 'Gruppe'}
        detailContent={(item) => (
          <Stack gap="md">
            <TextInput
              label="Name"
              value={item?.name || ''}
              onChange={(event) =>
                dispatch(
                  updateGroupDef({
                    scenarioId: selectedScenarioId,
                    groupId: item.id,
                    updates: { name: event.currentTarget.value },
                  })
                )
              }
            />
            <Select
              label="Icon"
              data={ICON_OPTIONS}
              value={item?.icon || '👥'}
              onChange={(value) =>
                dispatch(
                  updateGroupDef({
                    scenarioId: selectedScenarioId,
                    groupId: item.id,
                    updates: { icon: value || '👥' },
                  })
                )
              }
            />
            <Checkbox
              label="Schulkind-Gruppe"
              checked={!!item?.IsSchool}
              onChange={(event) =>
                dispatch(
                  updateGroupDef({
                    scenarioId: selectedScenarioId,
                    groupId: item.id,
                    updates: { IsSchool: event.currentTarget.checked },
                  })
                )
              }
            />
          </Stack>
        )}
        actions={(item) => (
          <ActionIcon
            color="red"
            variant="subtle"
            onClick={() => dispatch(deleteGroupDef({ scenarioId: selectedScenarioId, groupId: item.id }))}
          >
            <IconTrash size={18} />
          </ActionIcon>
        )}
      />
    </Stack>
  );
}

export default OrgaTabGroupDefs;
