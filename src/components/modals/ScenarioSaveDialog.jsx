import React, { useState } from 'react';
import { Modal, Button, Stack, Text, Group, PasswordInput, Loader, Alert, Checkbox } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useSaveLoad } from '../../hooks/useSaveLoad';
import { useSelector, useDispatch } from 'react-redux';
import { setSaveDialogOpen } from '../../store/simScenarioSlice';

import { IconAlertTriangle } from '@tabler/icons-react';

function ScenarioSaveDialog() {
  const dispatch = useDispatch();
  const isMobile = useMediaQuery('(max-width: 48em)');
  const opened = useSelector(state => state.simScenario.saveDialogOpen);
  const { saveData } = useSaveLoad();
  const [anonymizeExport, setAnonymizeExport] = useState(true);
  
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
    const result = await saveData(pwValue, { anonymize: anonymizeExport });
    
    if (result.success) {
      setPwValue('');
      setPwValue2('');
      setPwError('');
      setAnonymizeExport(true);
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
    setAnonymizeExport(true);
    dispatch(setSaveDialogOpen(false));
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Szenarien speichern"
      centered
      fullScreen={isMobile}
      size={isMobile ? '100%' : 'md'}
    >
      <Stack>
        <Checkbox
          label="Daten im Export anonymisieren"
          checked={anonymizeExport}
          onChange={(event) => setAnonymizeExport(event.currentTarget.checked)}
          disabled={isSaving}
          data-testid="anonymize-export-toggle"
        />
        {anonymizeExport ? (
          <Alert color="blue" variant="light">
            Direkte Namen, Adressen, Kontaktdaten und ADEBIS-Personen-IDs werden entfernt oder ersetzt; individuelle Personalkosten werden ausgelassen. Geburtsdaten und Betreuungszeiträume bleiben zur Prüfung der Förderberechnung erhalten. Prüfe den Export daher vor jeder Weitergabe.
          </Alert>
        ) : (
          <Alert icon={<IconAlertTriangle size={16} />} color="yellow" variant="light">
            Der Export wird unverändert gespeichert und kann personenbezogene Daten aus allen Szenarien enthalten. Gib die Datei nur weiter, wenn du dazu berechtigt bist.
          </Alert>
        )}

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

        <Group justify="flex-end" mt="md" wrap="wrap">
          <Button variant="subtle" onClick={handleClose} disabled={isSaving} fullWidth={isMobile}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving || !pwValue || !pwValue2} fullWidth={isMobile}>
            {isSaving ? <Loader size="xs" color="white" /> : 'Speichern'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export default ScenarioSaveDialog;
