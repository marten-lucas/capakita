import React, { useState, useEffect } from 'react';
import { Modal, Button, Checkbox, Stack, Text, Group, FileButton } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconUpload } from '@tabler/icons-react';
import { useScenarioImport } from '../../hooks/useScenarioImport';
import { useDispatch } from 'react-redux';
import { setActivePage } from '../../store/uiSlice';

function DataImportModal({ opened, onClose }) {
  const isMobile = useMediaQuery('(max-width: 48em)');
  const [file, setFile] = useState(null);
  const [isAnonymized, setIsAnonymized] = useState(true);
  const { importScenario } = useScenarioImport();
  const dispatch = useDispatch();

  useEffect(() => {
    if (opened) {
      setFile(null);
      setIsAnonymized(true);
    }
  }, [opened]);

  const handleImport = async () => {
    if (file) {
      await importScenario({ file, isAnonymized });
      onClose();
      dispatch(setActivePage('data'));
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Daten importieren"
      centered
      fullScreen={isMobile}
      size={isMobile ? '100%' : 'md'}
    >
      <Stack>
        <FileButton onChange={setFile} accept=".zip,application/zip">
          {(props) => (
            <Button {...props} leftSection={<IconUpload size={16} />} fullWidth={isMobile}>
              ZIP-Datei auswählen
            </Button>
          )}
        </FileButton>

        {file && (
          <Text size="sm" c="dimmed" style={{ wordBreak: 'break-word' }}>
            Ausgewählte Datei: {file.name}
          </Text>
        )}

        <Checkbox
          label="Daten anonymisieren"
          checked={isAnonymized}
          onChange={(event) => setIsAnonymized(event.currentTarget.checked)}
        />

        <Group justify="flex-end" mt="md" wrap="wrap">
          <Button variant="subtle" onClick={onClose} fullWidth={isMobile}>
            Abbrechen
          </Button>
          <Button onClick={handleImport} disabled={!file} fullWidth={isMobile}>
            Importieren
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export default DataImportModal;
