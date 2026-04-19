import React from 'react';
import { Stack, Button, Text, Group, Badge, ActionIcon, TextInput, Textarea, Slider, Select } from '@mantine/core';
import { IconPlus, IconTrash, IconGitBranch } from '@tabler/icons-react';
import { useSelector, useDispatch } from 'react-redux';
import TabbedListDetail from '../common/TabbedListDetail';
import { addScenario, updateScenario, deleteScenario, setSelectedScenarioId } from '../../store/simScenarioSlice';

function getDescendantScenarioIds(scenarioId, scenarios) {
  const descendants = [];

  const visit = (parentId) => {
    scenarios.forEach((scenario) => {
      if (scenario.baseScenarioId === parentId) {
        descendants.push(scenario.id);
        visit(scenario.id);
      }
    });
  };

  visit(scenarioId);
  return descendants;
}

function flattenScenarioTree(scenarios) {
  const map = {};
  scenarios.forEach((scenario) => {
    map[scenario.id] = { ...scenario, children: [] };
  });
  scenarios.forEach((scenario) => {
    if (scenario.baseScenarioId && map[scenario.baseScenarioId]) {
      map[scenario.baseScenarioId].children.push(map[scenario.id]);
    }
  });
  const roots = scenarios.filter((scenario) => !scenario.baseScenarioId).map((scenario) => map[scenario.id]);
  const result = [];
  const walk = (node, level) => {
    result.push({ ...node, _level: level });
    node.children.forEach((child) => walk(child, level + 1));
  };
  roots.forEach((root) => walk(root, 0));
  return result;
}

function OrgaTabScenarioDefs() {
  const dispatch = useDispatch();
  const scenarios = useSelector((state) => state.simScenario.scenarios);
  const scenarioItems = React.useMemo(() => flattenScenarioTree(scenarios), [scenarios]);

  const addRootScenario = () => {
    dispatch(addScenario({ name: 'Neues Szenario', baseScenarioId: null, makeNameUnique: true }));
  };

  return (
    <Stack gap="md">
      <Group justify="flex-end">
        <Button leftSection={<IconPlus size={16} />} onClick={addRootScenario}>
          Neues Szenario
        </Button>
      </Group>

      <TabbedListDetail
        data={scenarioItems}
        emptyText="Keine Szenarien vorhanden."
        renderItem={(item) => (
          <Group gap="sm" style={{ paddingLeft: `${item._level * 16}px` }}>
            <IconGitBranch size={16} />
            <div>
              <Text fw={500}>{item.name || 'Szenario'}</Text>
              {item.baseScenarioId && <Badge size="xs" variant="light">abgeleitet</Badge>}
            </div>
          </Group>
        )}
        detailTitle={(item) => item?.name || 'Szenario'}
        detailContent={(item) => {
          const disallowedBaseIds = new Set(getDescendantScenarioIds(item.id, scenarios));
          const baseOptions = [{ value: '', label: 'Keines' }].concat(
            scenarios
              .filter((scenario) => scenario.id !== item.id && !disallowedBaseIds.has(scenario.id))
              .map((scenario) => ({ value: scenario.id, label: scenario.name }))
          );

          return (
            <Stack gap="md">
              <TextInput
                label="Name"
                value={item?.name || ''}
                onChange={(event) =>
                  dispatch(updateScenario({ scenarioId: item.id, updates: { name: event.currentTarget.value } }))
                }
              />
              <Select
                label="Basis-Szenario"
                data={baseOptions}
                value={item?.baseScenarioId || ''}
                onChange={(value) => dispatch(updateScenario({ scenarioId: item.id, updates: { baseScenarioId: value || null } }))}
              />
              <Textarea
                label="Bemerkung"
                value={item?.remark || ''}
                onChange={(event) =>
                  dispatch(updateScenario({ scenarioId: item.id, updates: { remark: event.currentTarget.value } }))
                }
                minRows={4}
              />
              <div>
                <Text size="sm" fw={500} mb="xs">Wahrscheinlichkeit: {item?.likelihood ?? 50}%</Text>
                <Slider
                  value={Number(item?.likelihood ?? 50)}
                  min={0}
                  max={100}
                  onChangeEnd={(value) => dispatch(updateScenario({ scenarioId: item.id, updates: { likelihood: value } }))}
                />
              </div>
              <div>
                <Text size="sm" fw={500} mb="xs">Gewünschtheit: {item?.desirability ?? 50}%</Text>
                <Slider
                  value={Number(item?.desirability ?? 50)}
                  min={0}
                  max={100}
                  onChangeEnd={(value) => dispatch(updateScenario({ scenarioId: item.id, updates: { desirability: value } }))}
                />
              </div>
              <div>
                <Text size="sm" fw={500} mb="xs">Belastbarkeit: {item?.confidence ?? 50}%</Text>
                <Slider
                  value={Number(item?.confidence ?? 50)}
                  min={0}
                  max={100}
                  onChangeEnd={(value) => dispatch(updateScenario({ scenarioId: item.id, updates: { confidence: value } }))}
                />
              </div>
            </Stack>
          );
        }}
        actions={(item) => (
          <Group gap="xs">
            <ActionIcon
              variant="subtle"
              onClick={() => {
                dispatch(addScenario({ name: 'Neues Szenario', baseScenarioId: item.id, makeNameUnique: true }));
                dispatch(setSelectedScenarioId(item.id));
              }}
            >
              <IconPlus size={18} />
            </ActionIcon>
            <ActionIcon color="red" variant="subtle" onClick={() => dispatch(deleteScenario(item.id))}>
              <IconTrash size={18} />
            </ActionIcon>
          </Group>
        )}
      />
    </Stack>
  );
}

export default OrgaTabScenarioDefs;