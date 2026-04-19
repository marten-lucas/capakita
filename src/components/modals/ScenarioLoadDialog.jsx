import React, { useState, useEffect } from 'react';
import { Modal, Button, Checkbox, Stack, Text, Group, FileButton, PasswordInput, Loader } from '@mantine/core';
import { IconUpload } from '@tabler/icons-react';
import { useSaveLoad } from '../../hooks/useSaveLoad';
import { useSelector, useDispatch } from 'react-redux';
import { setLoadDialogOpen } from '../../store/simScenarioSlice';

function ScenarioLoadDialog({ onLoaded }) {
  const dispatch = useDispatch();
  const opened = useSelector(state => state.simScenario.loadDialogOpen);
  const { loadData } = useSaveLoad();
  
  const [pwValue, setPwValue] = useState('');
  const [pwError, setPwError] = useState('');
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnonymized, setIsAnonymized] = useState(true);

  useEffect(() => {
    if (opened) {
      setIsAnonymized(true);
      setFile(null);
      setPwValue('');
      setPwError('');
    }
  }, [opened]);

  const handleLoad = async () => {
    if (!file || !pwValue) {
      setPwError('Bitte Datei und Passwort eingeben.');
      return;
    }

    setIsLoading(true);
    const result = await loadData(file, pwValue, { isAnonymized });
    
    if (result.success) {
      setPwError('');
      setPwValue('');
      setFile(null);
      dispatch(setLoadDialogOpen(false));
      if (onLoaded) onLoaded();
    } else {
      setPwError(result.error);
    }
    setIsLoading(false);
  };

  const handleClose = () => {
    if (isLoading) return;
    dispatch(setLoadDialogOpen(false));
  };

  return (
    <Modal opened={opened} onClose={handleClose} title="Szenario laden" centered>
      <Stack>
        <FileButton onChange={setFile} accept=".capakita,.enc,.txt">
          {(props) => (
            <Button {...props} leftSection={<IconUpload size={16} />} disabled={isLoading}>
              Datei auswählen
            </Button>
          )}
        </FileButton>

        {file && (
          <Text size="sm" c="dimmed">
            Ausgewählte Datei: {file.name}
          </Text>
        )}

        <Checkbox
          label="Daten anonymisieren"
          checked={isAnonymized}
          onChange={(event) => setIsAnonymized(event.currentTarget.checked)}
          disabled={isLoading}
        />

        <PasswordInput
          label="Passwort"
          placeholder="Passwort eingeben"
          value={pwValue}
          onChange={(event) => setPwValue(event.currentTarget.value)}
          error={pwError}
          disabled={isLoading}
        />

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={handleClose} disabled={isLoading}>
            Abbrechen
          </Button>
          <Button onClick={handleLoad} disabled={!file || !pwValue || isLoading}>
            {isLoading ? <Loader size="xs" color="white" /> : 'Laden'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export default ScenarioLoadDialog;
