import React from 'react';
import { Stack, Button, Text, Group, Badge, ActionIcon, TextInput, Checkbox } from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useSelector, useDispatch } from 'react-redux';
import {
  addQualificationDef,
  updateQualificationDef,
  deleteQualificationDef,
} from '../../store/simQualificationSlice';
import { useOverlayData } from '../../hooks/useOverlayData';
import TabbedListDetail from '../common/TabbedListDetail';

function OrgaTabQualificationDefs() {
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector((state) => state.simScenario.selectedScenarioId);
  const { getEffectiveQualificationDefs } = useOverlayData();
  const qualificationDefs = getEffectiveQualificationDefs().map((item) => ({ ...item, id: item.key }));

  const handleAddQualification = () => {
    const key = `Q${Date.now()}`;
    dispatch(
      addQualificationDef({
        scenarioId: selectedScenarioId,
        qualiDef: { key, initial: 'Q', name: 'Neue Qualifikation', IsExpert: true },
      })
    );
  };

  return (
    <Stack gap="md">
      <Group justify="flex-end">
        <Button leftSection={<IconPlus size={16} />} onClick={handleAddQualification}>
          Neue Qualifikation
        </Button>
      </Group>

      <TabbedListDetail
        data={qualificationDefs}
        emptyText="Keine Qualifikationen vorhanden."
        renderItem={(item) => (
          <Group gap="sm">
            <Badge radius="xl" variant="light">{item.initial || item.name?.slice(0, 1) || 'Q'}</Badge>
            <div>
              <Text fw={500}>{item.name || 'Qualifikation'}</Text>
              {item.IsExpert !== false && <Badge size="xs">Fachkraft</Badge>}
            </div>
          </Group>
        )}
        detailTitle={(item) => item?.name || 'Qualifikation'}
        detailContent={(item) => (
          <Stack gap="md">
            <TextInput
              label="Kurzname"
              value={item?.initial || ''}
              onChange={(event) =>
                dispatch(
                  updateQualificationDef({
                    scenarioId: selectedScenarioId,
                    qualiKey: item.key,
                    updates: { initial: event.currentTarget.value },
                  })
                )
              }
            />
            <TextInput
              label="Anzeigename"
              value={item?.name || ''}
              onChange={(event) =>
                dispatch(
                  updateQualificationDef({
                    scenarioId: selectedScenarioId,
                    qualiKey: item.key,
                    updates: { name: event.currentTarget.value },
                  })
                )
              }
            />
            <Checkbox
              label="Fachkraft-Qualifikation"
              checked={item?.IsExpert !== false}
              onChange={(event) =>
                dispatch(
                  updateQualificationDef({
                    scenarioId: selectedScenarioId,
                    qualiKey: item.key,
                    updates: { IsExpert: event.currentTarget.checked },
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
            onClick={() => dispatch(deleteQualificationDef({ scenarioId: selectedScenarioId, qualiKey: item.key }))}
          >
            <IconTrash size={18} />
          </ActionIcon>
        )}
      />
    </Stack>
  );
}

export default OrgaTabQualificationDefs;
