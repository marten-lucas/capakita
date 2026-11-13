import React from 'react';
import { Stack, Button, Text, Group, Badge, ActionIcon, TextInput, Select, Switch, NumberInput } from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useSelector, useDispatch } from 'react-redux';
import { addGroupDef, updateGroupDef, deleteGroupDef, importGroupDefs } from '../../store/simGroupSlice';
import { setGroupDefOverlay } from '../../store/simOverlaySlice';
import { useOverlayData } from '../../hooks/useOverlayData';
import TabbedListDetail from '../common/TabbedListDetail';
import GroupIcon from '../common/GroupIcon';
import GroupIconPicker from './GroupIconPicker';
import { DEFAULT_GROUP_ICON, normalizeGroupIcon } from '../../utils/groupIcons';
import { FORECAST_STAGES, forecastStageForGroup } from '../../utils/forecastUtilsModel';

const GROUP_TYPE_OPTIONS = [
  { value: 'Krippe', label: 'Krippe (0-3 Jahre)' },
  { value: 'Regelgruppe', label: 'Regelgruppe (3-6 Jahre)' },
  { value: 'Schulkindgruppe', label: 'Schulkindgruppe (6+ Jahre)' },
];

const FORECAST_STAGE_OPTIONS = [
  { value: 'auto', label: 'Automatisch (nicht bestätigt)' },
  { value: 'krippe', label: 'Krippe' },
  { value: 'kita', label: 'Regelgruppe' },
  { value: 'school', label: 'Schulkindbetreuung' },
  { value: 'unknown', label: 'Ungeklärt (bewusst offen)' },
];

function OrgaTabGroupDefs() {
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector((state) => state.simScenario.selectedScenarioId);
  const { getEffectiveGroupDefs, isBasedScenario } = useOverlayData();
  const hasGroupDefOverlay = useSelector((state) => Array.isArray(state.simOverlay.overlaysByScenario[selectedScenarioId]?.groupDefs)
    && state.simOverlay.overlaysByScenario[selectedScenarioId].groupDefs.length > 0);
  const hasOwnGroupDefs = useSelector((state) => Boolean(state.simGroup.groupDefsByScenario[selectedScenarioId]?.length));
  const groupDefs = getEffectiveGroupDefs();

  const updateForecastStage = (item, forecastStage) => {
    if (hasGroupDefOverlay) {
      dispatch(setGroupDefOverlay({
        scenarioId: selectedScenarioId,
        overlayData: groupDefs.map((group) => String(group.id) === String(item.id) ? { ...group, forecastStage } : group),
      }));
    } else {
      if (isBasedScenario && !hasOwnGroupDefs) {
        dispatch(importGroupDefs({ scenarioId: selectedScenarioId, defs: groupDefs }));
      }
      dispatch(updateGroupDef({ scenarioId: selectedScenarioId, groupId: item.id, updates: { forecastStage } }));
    }
  };

  const handleAddGroup = () => {
    dispatch(
      addGroupDef({
        scenarioId: selectedScenarioId,
        groupDef: {
          id: Date.now().toString(),
          name: 'Neue Gruppe',
          icon: DEFAULT_GROUP_ICON,
          type: 'Regelgruppe',
          forecastStage: 'auto',
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
            <Select
              label="Stufe für die Prognose"
              description="Unabhängig vom Gruppentyp. Automatisch schätzt anhand von Name und Typ; die Schätzung ist nicht bestätigt. Ungeklärt verhindert eine automatische Zuordnung, z. B. bei Mischgruppen. Nur eine einheitliche Stufe ausdrücklich bestätigen."
              data={FORECAST_STAGE_OPTIONS}
              value={FORECAST_STAGE_OPTIONS.some((option) => option.value === item?.forecastStage) ? item.forecastStage : (item?.forecastStage ? 'unknown' : 'auto')}
              onChange={(value) => { if (value) updateForecastStage(item, value); }}
              allowDeselect={false}
            />
            {isBasedScenario && !hasOwnGroupDefs && !hasGroupDefOverlay && (
              <Text size="sm" c="dimmed">
                Die Auswahl erstellt eine eigene Kopie aller Gruppen für dieses Szenario. Spätere Änderungen der Basisgruppen werden nicht übernommen.
              </Text>
            )}
            <Text size="sm" c="dimmed">
              Prognose verwendet: {FORECAST_STAGES[forecastStageForGroup(item)].label}
              {(!item?.forecastStage || item.forecastStage === 'auto') ? ' (automatische Schätzung, nicht bestätigt)'
                : FORECAST_STAGE_OPTIONS.some((option) => option.value === item.forecastStage) ? ' (ausgewählt)' : ' (ungültige gespeicherte Auswahl)'}
            </Text>
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
