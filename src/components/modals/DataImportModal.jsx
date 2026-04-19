import React, { useState, useEffect } from 'react';
import { Modal, Button, Checkbox, Stack, Text, Group, FileButton } from '@mantine/core';
import { IconUpload } from '@tabler/icons-react';
import { useScenarioImport } from '../../hooks/useScenarioImport';
import { useNavigate } from 'react-router-dom';

function DataImportModal({ opened, onClose }) {
  const [file, setFile] = useState(null);
  const [isAnonymized, setIsAnonymized] = useState(true);
  const { importScenario } = useScenarioImport();
  const navigate = useNavigate();

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
      navigate('/data');
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Daten importieren" centered>
      <Stack>
        <FileButton onChange={setFile} accept=".zip,application/zip">
          {(props) => (
            <Button {...props} leftSection={<IconUpload size={16} />}>
              ZIP-Datei auswählen
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
        />

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={onClose}>
            Abbrechen
          </Button>
          <Button onClick={handleImport} disabled={!file}>
            Importieren
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export default DataImportModal;
