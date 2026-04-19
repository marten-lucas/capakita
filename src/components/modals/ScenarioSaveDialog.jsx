import React, { useState } from 'react';
import { Modal, Button, Stack, Text, Group, PasswordInput, Loader } from '@mantine/core';
import { useSaveLoad } from '../../hooks/useSaveLoad';
import { useSelector, useDispatch } from 'react-redux';
import { setSaveDialogOpen } from '../../store/simScenarioSlice';

function ScenarioSaveDialog() {
  const dispatch = useDispatch();
  const opened = useSelector(state => state.simScenario.saveDialogOpen);
  const { saveData } = useSaveLoad();
  
  const [pwValue, setPwValue] = useState('');
  const [pwValue2, setPwValue2] = useState('');
  const [pwError, setPwError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    if (pwValue !== pwValue2) {
      setPwError('Passwörter stimmen nicht überein.');
      return;
    }

    setIsSaving(true);
    const result = await saveData(pwValue);
    
    if (result.success) {
      setPwValue('');
      setPwValue2('');
      setPwError('');
      dispatch(setSaveDialogOpen(false));
    } else {
      setPwError(result.error);
    }
    setIsSaving(false);
  };

  const handleClose = () => {
    if (isSaving) return;
    setPwValue('');
    setPwValue2('');
    setPwError('');
    dispatch(setSaveDialogOpen(false));
  };

  return (
    <Modal opened={opened} onClose={handleClose} title="Szenarien speichern" centered>
      <Stack>
        <PasswordInput
          label="Passwort"
          placeholder="Passwort eingeben"
          value={pwValue}
          onChange={(event) => setPwValue(event.currentTarget.value)}
          disabled={isSaving}
          error={pwError && !pwValue2 ? pwError : null}
        />
        <PasswordInput
          label="Passwort bestätigen"
          placeholder="Passwort bestätigen"
          value={pwValue2}
          onChange={(event) => setPwValue2(event.currentTarget.value)}
          disabled={isSaving}
          error={pwError && pwValue2 ? pwError : null}
        />

        <Text size="xs" c="dimmed">
          Das Passwort muss mindestens 8 Zeichen lang sein und Groß- und Kleinbuchstaben, 
          Zahlen sowie Sonderzeichen enthalten.
        </Text>

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={handleClose} disabled={isSaving}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving || !pwValue || !pwValue2}>
            {isSaving ? <Loader size="xs" color="white" /> : 'Speichern'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export default ScenarioSaveDialog;
