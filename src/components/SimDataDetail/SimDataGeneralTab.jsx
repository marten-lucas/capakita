import React from 'react';
import { Stack, TextInput, Radio, Group, Text, Paper, Button, ActionIcon, Select, Badge, Divider } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useSelector, useDispatch } from 'react-redux';
import { IconPlus, IconTrash } from '@tabler/icons-react';
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
  const absences = Array.isArray(item.absences) ? item.absences : [];

  const handleAbsenceUpdate = (absenceId, updates) => {
    const nextAbsences = absences.map((absence) => (
      absence.id === absenceId ? { ...absence, ...updates } : absence
    ));
    handleUpdate({ absences: nextAbsences });
  };

  const handleAddAbsence = () => {
    handleUpdate({
      absences: [
        ...absences,
        {
          id: `absence-${Date.now()}`,
          start: '',
          end: '',
          payType: 'fully_paid',
        },
      ],
    });
  };

  const handleDeleteAbsence = (absenceId) => {
    handleUpdate({
      absences: absences.filter((absence) => absence.id !== absenceId),
    });
  };

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
            onChange={(date) => {
              if (!date) {
                handleUpdate({ dateofbirth: '' });
              } else if (typeof date === 'string') {
                handleUpdate({ dateofbirth: date });
              } else if (date instanceof Date) {
                handleUpdate({ dateofbirth: date.toISOString().slice(0, 10) });
              }
            }}
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
        <Stack gap="md">
          <Paper withBorder p="md" radius="md">
            <Text fw={600} mb="xs">Qualifikation</Text>
            <QualificationPicker
              value={currentQualificationAssignment?.qualification || ''}
              onChange={handleQualificationChange}
            />
          </Paper>

          <Paper withBorder p="md" radius="md">
            <Group justify="space-between" align="center" mb="xs">
              <Text fw={600}>Unterbrechungen</Text>
              <Button size="xs" leftSection={<IconPlus size={12} />} onClick={handleAddAbsence}>
                Unterbrechung hinzufügen
              </Button>
            </Group>
            <Text size="xs" c="dimmed" mb="md">
              Hier lassen sich mehrere Zeiträume erfassen, in denen die Mitarbeiterin oder der Mitarbeiter nicht verfügbar ist, z. B. Elternzeit.
            </Text>
            {absences.length === 0 ? (
              <Text size="sm" c="dimmed">
                Noch keine Unterbrechung erfasst.
              </Text>
            ) : (
              <Stack gap="sm">
                {absences.map((absence) => (
                  <Paper key={absence.id} withBorder radius="md" p="sm" bg="gray.0">
                    <Stack gap="sm">
                      <Group justify="space-between" align="center">
                        <Badge variant="light" color="orange">Unterbrechung</Badge>
                        <ActionIcon variant="subtle" color="red" onClick={() => handleDeleteAbsence(absence.id)} aria-label="Unterbrechung löschen">
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                      <Group grow>
                        <DatePickerInput
                          label="Von"
                          placeholder="Datum wählen"
                          value={absence.start ? new Date(absence.start) : null}
                          onChange={(date) => handleAbsenceUpdate(absence.id, { start: date ? date.toISOString().slice(0, 10) : '' })}
                          clearable
                        />
                        <DatePickerInput
                          label="Bis"
                          placeholder="Datum wählen"
                          value={absence.end ? new Date(absence.end) : null}
                          onChange={(date) => handleAbsenceUpdate(absence.id, { end: date ? date.toISOString().slice(0, 10) : '' })}
                          clearable
                        />
                      </Group>
                      <Select
                        label="Bezahlung"
                        data={[
                          { value: 'fully_paid', label: 'Voll bezahlt' },
                          { value: 'partially_paid', label: 'Teilweise bezahlt' },
                          { value: 'unpaid', label: 'Unbezahlt' },
                        ]}
                        value={absence.payType || 'fully_paid'}
                        onChange={(value) => handleAbsenceUpdate(absence.id, { payType: value || 'fully_paid' })}
                        allowDeselect={false}
                      />
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
          </Paper>
        </Stack>
      )}
    </Stack>
  );
}

export default SimDataGeneralTab;
