import React from 'react';
import { Stack, TextInput, Radio, Group, Text, Paper } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useSelector, useDispatch } from 'react-redux';
import { useOverlayData } from '../../hooks/useOverlayData';
import { updateDataItemThunk } from '../../store/simDataSlice';
import {
  addQualificationAssignment,
  updateQualificationAssignment,
  deleteQualificationAssignment,
} from '../../store/simQualificationSlice';
import QualificationPicker from './QualificationPicker';

function SimDataGeneralTab() {
  const dispatch = useDispatch();
  const scenarioId = useSelector((state) => state.simScenario.selectedScenarioId);
  const selectedItemId = useSelector((state) => state.simScenario.selectedItems?.[scenarioId]);

  const {
    getEffectiveDataItem,
    getEffectiveQualificationAssignments,
  } = useOverlayData();

  const item = getEffectiveDataItem(selectedItemId);
  const qualificationAssignments = getEffectiveQualificationAssignments(selectedItemId);
  const currentQualificationAssignment = qualificationAssignments[0] || null;

  if (!item) return null;

  const handleUpdate = (updates) => {
    dispatch(updateDataItemThunk({ scenarioId, itemId: item.id, updates }));
  };

  const handleQualificationChange = (qualification) => {
    if (!qualification && currentQualificationAssignment) {
      dispatch(
        deleteQualificationAssignment({
          scenarioId,
          dataItemId: item.id,
          assignmentId: currentQualificationAssignment.id,
        })
      );
      return;
    }

    if (currentQualificationAssignment) {
      dispatch(
        updateQualificationAssignment({
          scenarioId,
          dataItemId: item.id,
          assignmentId: currentQualificationAssignment.id,
          updates: { qualification },
        })
      );
      return;
    }

    dispatch(
      addQualificationAssignment({
        scenarioId,
        dataItemId: item.id,
        assignment: {
          id: `${qualification}-${Date.now()}`,
          qualification,
          dataItemId: item.id,
        },
      })
    );
  };

  const name = item.name || '';
  const firstName = item.firstName || '';
  const itemType = item.type || 'demand';
  const validFrom = item.validFrom ? new Date(item.validFrom) : null;
  const validUntil = item.validUntil ? new Date(item.validUntil) : null;

  return (
    <Stack gap="md">
      <Paper withBorder p="md" radius="md">
        <Text fw={600} mb="xs">Stammdaten</Text>
        <Stack gap="sm">
          <TextInput
            label="Name"
            value={name}
            onChange={(event) => handleUpdate({ name: event.currentTarget.value })}
          />
          <TextInput
            label="Vorname"
            value={firstName}
            onChange={(event) => handleUpdate({ firstName: event.currentTarget.value })}
          />
          <DatePickerInput
            label="Geburtsdatum"
            placeholder="Datum wählen"
            value={item.dateofbirth ? new Date(item.dateofbirth) : null}
            onChange={(date) => handleUpdate({ dateofbirth: date ? date.toISOString().slice(0, 10) : '' })}
            clearable
          />
          <Radio.Group
            label="Typ"
            value={itemType}
            onChange={(value) => handleUpdate({ type: value })}
          >
            <Group mt="xs">
              <Radio value="demand" label="Kind" />
              <Radio value="capacity" label="Mitarbeiter" />
            </Group>
          </Radio.Group>
        </Stack>
      </Paper>

      <Paper withBorder p="md" radius="md">
        <Text fw={600} mb="xs">Gültigkeit</Text>
        <Group grow>
          <DatePickerInput
            label="Gültig von"
            placeholder="Datum wählen"
            value={validFrom}
            onChange={(date) => handleUpdate({ validFrom: date ? date.toISOString().slice(0, 10) : '' })}
            clearable
          />
          <DatePickerInput
            label="Gültig bis"
            placeholder="Datum wählen"
            value={validUntil}
            onChange={(date) => handleUpdate({ validUntil: date ? date.toISOString().slice(0, 10) : '' })}
            clearable
          />
        </Group>
      </Paper>

      {itemType === 'capacity' && (
        <Paper withBorder p="md" radius="md">
          <Text fw={600} mb="xs">Qualifikation</Text>
          <QualificationPicker
            value={currentQualificationAssignment?.qualification || ''}
            onChange={handleQualificationChange}
          />
        </Paper>
      )}
    </Stack>
  );
}

export default SimDataGeneralTab;
