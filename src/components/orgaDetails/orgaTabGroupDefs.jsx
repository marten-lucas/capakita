import React from 'react';
import { Stack, Button, Text, Group, Badge, ActionIcon, TextInput, Select, Switch, NumberInput } from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useSelector, useDispatch } from 'react-redux';
import { addGroupDef, updateGroupDef, deleteGroupDef } from '../../store/simGroupSlice';
import { useOverlayData } from '../../hooks/useOverlayData';
import TabbedListDetail from '../common/TabbedListDetail';
import GroupIcon from '../common/GroupIcon';
import GroupIconPicker from './GroupIconPicker';
import { DEFAULT_GROUP_ICON, normalizeGroupIcon } from '../../utils/groupIcons';

const GROUP_TYPE_OPTIONS = [
  { value: 'Krippe', label: 'Krippe (0-3 Jahre)' },
  { value: 'Regelgruppe', label: 'Regelgruppe (3-6 Jahre)' },
  { value: 'Schulkindgruppe', label: 'Schulkindgruppe (6+ Jahre)' },
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
          fillUp: false,
          maxFacilityCount: '',
          maxSchoolGrade: '',
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
            <GroupIcon icon={item.icon} size={22} />
            <div>
              <Text fw={500}>{item.name || 'Gruppe'}</Text>
              <Group gap="xs">
                {item.type && <Badge size="xs">{item.type}</Badge>}
              </Group>
            </div>
          </Group>
        )}
        detailTitle={(item) => item?.name || 'Gruppe'}
        detailContent={(item) => (
          <Stack gap="md">
            {(() => {
              const isSchoolGroup = String(item?.type || '') === 'Schulkindgruppe';
              const fillUpEnabled = Boolean(item?.fillUp) && isSchoolGroup;
              return (
                <>
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
                      fillUp: value === 'Schulkindgruppe' ? Boolean(item?.fillUp) : false,
                    },
                  })
                )
              }
            />
            {isSchoolGroup ? (
              <Switch
                label="Auffuellen aktivieren"
                checked={Boolean(item?.fillUp)}
                onChange={(event) =>
                  dispatch(
                    updateGroupDef({
                      scenarioId: selectedScenarioId,
                      groupId: item.id,
                      updates: { fillUp: event.currentTarget.checked },
                    })
                  )
                }
              />
            ) : null}
            {fillUpEnabled ? (
              <>
                <NumberInput
                  label="Maximal zulaessige Anzahl von Kindern in der Einrichtung"
                  value={item?.maxFacilityCount ?? ''}
                  onChange={(value) =>
                    dispatch(
                      updateGroupDef({
                        scenarioId: selectedScenarioId,
                        groupId: item.id,
                        updates: { maxFacilityCount: value ?? '' },
                      })
                    )
                  }
                  min={0}
                  allowDecimal={false}
                  allowNegative={false}
                  placeholder="Optional"
                />
                <Select
                  label="Schulkindbetreuung endet nach dem Schuljahr"
                  value={item?.maxSchoolGrade ? String(item.maxSchoolGrade) : ''}
                  onChange={(value) =>
                    dispatch(
                      updateGroupDef({
                        scenarioId: selectedScenarioId,
                        groupId: item.id,
                        updates: { maxSchoolGrade: value || '' },
                      })
                    )
                  }
                  data={[
                    { value: '1', label: '1. Klasse' },
                    { value: '2', label: '2. Klasse' },
                    { value: '3', label: '3. Klasse' },
                    { value: '4', label: '4. Klasse' },
                  ]}
                  placeholder="Klasse waehlen"
                  clearable
                />
              </>
            ) : null}
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                Icon
              </Text>
              <div data-testid="group-icon-picker">
                <GroupIconPicker
                  value={normalizeGroupIcon(item?.icon)}
                  onChange={(value) =>
                    dispatch(
                      updateGroupDef({
                        scenarioId: selectedScenarioId,
                        groupId: item.id,
                        updates: { icon: value || DEFAULT_GROUP_ICON },
                      })
                    )
                  }
                  defaultValue={DEFAULT_GROUP_ICON}
                />
              </div>
            </Stack>
                </>
              );
            })()}
          </Stack>
        )}
        actions={(item) => (
          <ActionIcon
            color="red"
            variant="subtle"
            onClick={() => {
              dispatch(deleteGroupDef({ scenarioId: selectedScenarioId, groupId: item.id }));
              dispatch({ type: 'simFinance/deleteGroupFeeCatalog', payload: { scenarioId: selectedScenarioId, groupId: item.id } });
            }}
          >
            <IconTrash size={18} />
          </ActionIcon>
        )}
      />
    </Stack>
  );
}

export default OrgaTabGroupDefs;
