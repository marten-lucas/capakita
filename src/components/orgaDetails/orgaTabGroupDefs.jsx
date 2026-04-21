import React from 'react';
import { Stack, Button, Text, Group, Badge, ActionIcon, TextInput, Checkbox, Select } from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { IconPicker } from 'mantine-icon-picker';
import { IconsClassName } from 'tabler-dynamic-icon';
import { useSelector, useDispatch } from 'react-redux';
import { addGroupDef, updateGroupDef, deleteGroupDef } from '../../store/simGroupSlice';
import { useOverlayData } from '../../hooks/useOverlayData';
import TabbedListDetail from '../common/TabbedListDetail';
import TablerIcon from '../common/TablerIcon';
import { DEFAULT_GROUP_ICON, normalizeGroupIcon } from '../../utils/groupIcons';

const GROUP_TYPE_OPTIONS = [
  { value: 'Krippe', label: 'Krippe (0-3 Jahre)' },
  { value: 'Regelgruppe', label: 'Regelgruppe (3-6 Jahre)' },
  { value: 'Schulkindgruppe', label: 'Schulkind-Betreuung (6+ Jahre)' },
];

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
          icon: DEFAULT_GROUP_ICON,
          type: 'Regelgruppe',
          isSchoolKidGroup: false,
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
            <TablerIcon icon={item.icon} size={22} />
            <div>
              <Text fw={500}>{item.name || 'Gruppe'}</Text>
              <Group gap="xs">
                {item.type && <Badge size="xs">{item.type}</Badge>}
                {item.isSchoolKidGroup && <Badge size="xs" color="blue">Schulkind</Badge>}
              </Group>
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
              label="Gruppentyp"
              data={GROUP_TYPE_OPTIONS}
              value={item?.type || 'Regelgruppe'}
              onChange={(value) =>
                dispatch(
                  updateGroupDef({
                    scenarioId: selectedScenarioId,
                    groupId: item.id,
                    updates: { 
                      type: value || 'Regelgruppe',
                      isSchoolKidGroup: value === 'Schulkindgruppe',
                    },
                  })
                )
              }
            />
            <Stack gap="xs">
              <Text size="sm" fw={500}>Icon</Text>
              <div data-testid="group-icon-picker">
                <IconPicker
                  value={normalizeGroupIcon(item?.icon)}
                  onSelect={(value) =>
                    dispatch(
                      updateGroupDef({
                        scenarioId: selectedScenarioId,
                        groupId: item.id,
                        updates: { icon: value || DEFAULT_GROUP_ICON },
                      })
                    )
                  }
                  defaultIcon={DEFAULT_GROUP_ICON}
                  iconsList={IconsClassName}
                  showSearchBar
                  searchPlaceholder="Tabler-Icon suchen"
                  height={320}
                  itemPerColumn={8}
                  iconSize={18}
                />
              </div>
            </Stack>
            <Checkbox
              label="Schulkind-Gruppe (veraltet - nutze Gruppentyp statt dem)"
              checked={!!item?.isSchoolKidGroup}
              onChange={(event) =>
                dispatch(
                  updateGroupDef({
                    scenarioId: selectedScenarioId,
                    groupId: item.id,
                    updates: { 
                      isSchoolKidGroup: event.currentTarget.checked,
                      type: event.currentTarget.checked ? 'Schulkindgruppe' : 'Regelgruppe',
                    },
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
