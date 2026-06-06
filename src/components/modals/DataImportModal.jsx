import React, { useState, useEffect } from 'react';
import { Modal, Button, Checkbox, Stack, Text, Group, FileButton, SegmentedControl, MultiSelect, Paper, Radio, List, ThemeIcon, Divider, PasswordInput } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconUpload, IconCheck, IconAlertCircle } from '@tabler/icons-react';
import { useScenarioImport } from '../../hooks/useScenarioImport';
import { useDispatch } from 'react-redux';
import { setActivePage } from '../../store/uiSlice';

function DataImportModal({ opened, onClose, title = 'Datenimport-Wizard', requirePasswordConfirmation = false }) {
  const isMobile = useMediaQuery('(max-width: 48em)');
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [isAnonymized, setIsAnonymized] = useState(true);
  const [importPassword, setImportPassword] = useState('');
  const [importPasswordConfirm, setImportPasswordConfirm] = useState('');
  const [importMode, setImportMode] = useState('historical');
  const [mergeMode, setMergeMode] = useState('append');
  const [recordScope, setRecordScope] = useState('all');
  const [selectedRecordKeys, setSelectedRecordKeys] = useState([]);
  const [conflictPolicy, setConflictPolicy] = useState('skip');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [preparedImport, setPreparedImport] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const { prepareImport, getImportPreview, applyImport } = useScenarioImport();
  const dispatch = useDispatch();

  const fileName = file?.name || '';
  const lowerFileName = String(fileName).toLowerCase();
  const isCapakitaFile = lowerFileName.endsWith('.capakita') || lowerFileName.endsWith('.enc') || lowerFileName.endsWith('.txt');
  const isCapakitaJsonFile = lowerFileName.endsWith('.capakita.json');
  const isPlainJsonFile = lowerFileName.endsWith('.json') && !isCapakitaJsonFile;
  const isCapakitaSource = isCapakitaFile || isCapakitaJsonFile || isPlainJsonFile;
  const hasPasswordMismatch =
    requirePasswordConfirmation
    && isCapakitaFile
    && importPasswordConfirm.length > 0
    && importPassword !== importPasswordConfirm;

  useEffect(() => {
    if (opened) {
      setStep(1);
      setFile(null);
      setIsAnonymized(true);
      setImportPassword('');
      setImportPasswordConfirm('');
      setImportMode('historical');
      setMergeMode('append');
      setRecordScope('all');
      setSelectedRecordKeys([]);
      setConflictPolicy('skip');
      setShowAdvancedOptions(false);
      setPreparedImport(null);
      setPreview(null);
      setIsPreparing(false);
      setIsApplying(false);
    }
  }, [opened]);

  useEffect(() => {
    if (!preparedImport) return;
    const nextPreview = getImportPreview(preparedImport, {
      mergeMode,
      recordScope,
      selectedRecordKeys,
      conflictPolicy,
    });
    setPreview(nextPreview);
  }, [preparedImport, mergeMode, recordScope, selectedRecordKeys, conflictPolicy, getImportPreview]);

  const handlePrepareImport = async () => {
    if (!file) return;
    setIsPreparing(true);
    try {
      const prepared = await prepareImport({
        file,
        isAnonymized,
        importMode,
        password: importPassword,
      });
      setPreparedImport(prepared);
      const nextPreview = getImportPreview(prepared, {
        mergeMode,
        recordScope,
        selectedRecordKeys,
        conflictPolicy,
      });
      setPreview(nextPreview);
      setStep(2);
    } catch (error) {
      alert(`Fehler bei der Analyse der Datei: ${error.message}`);
    } finally {
      setIsPreparing(false);
    }
  };

  const handleApplyImport = async () => {
    if (!preparedImport || !preview?.supported) return;
    setIsApplying(true);
    try {
      await applyImport({
        preparedImport,
        importOptions: {
          mergeMode,
          recordScope,
          selectedRecordKeys,
          conflictPolicy,
        },
      });
      onClose();
      dispatch(setActivePage('data'));
    } catch (error) {
      alert(`Import fehlgeschlagen: ${error.message}`);
    } finally {
      setIsApplying(false);
    }
  };

  const conflictPolicyDisabled = mergeMode === 'replace' || (preview?.counts?.conflicts || 0) === 0;

  const canContinueToStep3 = Boolean(preparedImport);
  const canImport = Boolean(preparedImport && preview?.supported && (preview?.counts?.considered || 0) > 0);
  const canAnalyzeFile = Boolean(
    file
    && !isPreparing
    && (!isCapakitaFile || (
      importPassword
      && (!requirePasswordConfirmation || (importPasswordConfirm && !hasPasswordMismatch))
    ))
  );
  const contentAreaStyle = isMobile
    ? undefined
    : {
      minHeight: 360,
      maxHeight: 360,
      overflowY: 'auto',
      paddingRight: 4,
    };

  const handlePrimaryStepAction = () => {
    if (step === 1 && canAnalyzeFile) {
      handlePrepareImport();
      return;
    }

    if (step === 2 && canContinueToStep3) {
      setStep(3);
      return;
    }

    if (step === 3 && canImport && !isApplying) {
      handleApplyImport();
    }
  };

  const handleWizardSubmit = (event) => {
    event.preventDefault();
    handlePrimaryStepAction();
  };

  const handleWizardKeyDownCapture = (event) => {
    if (event.key !== 'Enter' && event.key !== 'NumpadEnter') return;
    if (event.defaultPrevented) return;
    if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;

    const target = event.target;
    const tagName = target instanceof HTMLElement ? target.tagName.toLowerCase() : '';
    if (tagName === 'textarea') return;

    const inputType = target instanceof HTMLInputElement ? String(target.type || '').toLowerCase() : '';
    const isTextLikeInput = inputType === 'text'
      || inputType === 'search'
      || inputType === 'email'
      || inputType === 'password'
      || inputType === 'number'
      || inputType === 'tel'
      || inputType === 'url';
    if (isTextLikeInput) return;

    if (step === 2 || step === 3) {
      event.preventDefault();
      handlePrimaryStepAction();
      return;
    }

    if (tagName === 'button' || tagName === 'a') return;

    event.preventDefault();
    handlePrimaryStepAction();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      centered
      fullScreen={isMobile}
      size={isMobile ? '100%' : 'lg'}
    >
      <Stack component="form" onSubmit={handleWizardSubmit} onKeyDownCapture={handleWizardKeyDownCapture}>
        <SegmentedControl
          value={String(step)}
          onChange={(value) => setStep(Number(value))}
          data={[
            { label: '1. Datei', value: '1' },
            { label: '2. Regeln', value: '2' },
            { label: '3. Vorschau', value: '3' },
          ]}
          fullWidth
        />

        <Stack style={contentAreaStyle}>
          {step === 1 && (
            <Stack>
            <FileButton onChange={setFile} accept=".zip,application/zip,.capakita,.enc,.txt,.json">
              {(props) => (
                <Button {...props} leftSection={<IconUpload size={16} />} fullWidth={isMobile}>
                  Datei auswählen (.zip/.capakita/.json)
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
              disabled={isCapakitaSource}
            />

            {!isCapakitaSource && (
              <Radio.Group value={importMode} onChange={setImportMode} label="Importmodus">
                <Stack mt="xs" gap="xs">
                  <Radio value="historical" label="Historisch (vollständige Historie)" />
                  <Radio value="snapshot" label="Snapshot (nur aktuelle/aktive Datensätze)" />
                </Stack>
              </Radio.Group>
            )}

            {isCapakitaFile && (
              <>
                <PasswordInput
                  label="Passwort für .capakita"
                  placeholder="Passwort eingeben"
                  value={importPassword}
                  onChange={(event) => setImportPassword(event.currentTarget.value)}
                />

                {requirePasswordConfirmation && (
                  <PasswordInput
                    label="Passwort bestätigen"
                    placeholder="Passwort bestätigen"
                    value={importPasswordConfirm}
                    onChange={(event) => setImportPasswordConfirm(event.currentTarget.value)}
                    error={hasPasswordMismatch ? 'Passwörter stimmen nicht überein.' : null}
                  />
                )}
              </>
            )}

            </Stack>
          )}

          {step === 2 && (
            <Stack>
            <Paper withBorder p="md" radius="md">
              <Stack gap="sm">
                <Text fw={600}>Merge-Strategie</Text>
                <Radio.Group value={mergeMode} onChange={setMergeMode}>
                  <Stack gap="xs">
                    <Radio value="append" label="Neue Daten hinzufügen" />
                    <Radio value="replace" label="Bestehende Daten durch Import ersetzen" />
                  </Stack>
                </Radio.Group>
                <Text size="sm" c="dimmed">
                  Erweiterte Auswahl- und Konfliktregeln sind im Vorschau-Schritt optional verfügbar.
                </Text>
              </Stack>
            </Paper>

            </Stack>
          )}

          {step === 3 && (
            <Stack>
            <Paper withBorder p="md" radius="md">
              {!preview?.supported ? (
                <Group gap="xs" c="red">
                  <ThemeIcon color="red" variant="light">
                    <IconAlertCircle size={16} />
                  </ThemeIcon>
                  <Text size="sm">{preview?.reason || 'Import ist aktuell nicht möglich.'}</Text>
                </Group>
              ) : (
                <Stack gap="xs">
                  <Group gap="xs">
                    <ThemeIcon color="green" variant="light">
                      <IconCheck size={16} />
                    </ThemeIcon>
                    <Text fw={600}>Import-Vorschau</Text>
                  </Group>
                  <Text size="sm">Berücksichtigte Datensätze: {preview?.counts?.considered || 0}</Text>
                  <Text size="sm">Neu: {preview?.counts?.newRecords || 0}</Text>
                  <Text size="sm">Identisch vorhanden: {preview?.counts?.identical || 0}</Text>
                  <Text size="sm">Konflikte: {preview?.counts?.conflicts || 0}</Text>
                </Stack>
              )}
            </Paper>

            <Checkbox
              label="Erweiterte Importoptionen anzeigen"
              checked={showAdvancedOptions}
              onChange={(event) => setShowAdvancedOptions(event.currentTarget.checked)}
            />

            {showAdvancedOptions && (
              <Paper withBorder p="md" radius="md">
                <Stack gap="sm">
                  <Text fw={600}>Datensatz-Auswahl</Text>
                  <Radio.Group value={recordScope} onChange={setRecordScope}>
                    <Stack gap="xs">
                      <Radio value="all" label="Alle Datensätze" />
                      <Radio value="children" label="Nur Kinder" />
                      <Radio value="employees" label="Nur Eltern/Mitarbeitende" />
                      <Radio value="selected" label="Nur selektierte Datensätze" />
                    </Stack>
                  </Radio.Group>

                  {recordScope === 'selected' && (
                    <MultiSelect
                      searchable
                      clearable
                      label="Datensätze auswählen"
                      value={selectedRecordKeys}
                      onChange={setSelectedRecordKeys}
                      data={(preparedImport?.recordOptions || []).map((record) => ({
                        value: record.value,
                        label: record.label,
                      }))}
                      placeholder="Datensätze auswählen"
                    />
                  )}
                </Stack>
              </Paper>
            )}

            {showAdvancedOptions && (
              <Paper withBorder p="md" radius="md">
                <Stack gap="sm">
                  <Text fw={600}>Konfliktbehandlung (bei Ergänzen)</Text>
                  <Radio.Group value={conflictPolicy} onChange={setConflictPolicy}>
                    <Stack gap="xs">
                      <Radio value="skip" label="Bestehende behalten (Konflikte überspringen)" disabled={conflictPolicyDisabled} />
                      <Radio value="overwrite" label="Bestehende bei Konflikt überschreiben" disabled={conflictPolicyDisabled} />
                      <Radio value="duplicate" label="Als Duplikat hinzufügen" disabled={conflictPolicyDisabled} />
                    </Stack>
                  </Radio.Group>
                </Stack>
              </Paper>
            )}

            {showAdvancedOptions && (preview?.conflicts?.length || 0) > 0 && (
              <Paper withBorder p="md" radius="md">
                <Stack gap="xs">
                  <Text fw={600}>Konfliktliste (Auszug)</Text>
                  <List spacing="xs" size="sm">
                    {preview.conflicts.slice(0, 10).map((conflict) => (
                      <List.Item key={conflict.key}>{conflict.label}</List.Item>
                    ))}
                  </List>
                  {preview.conflicts.length > 10 && (
                    <Text size="xs" c="dimmed">+{preview.conflicts.length - 10} weitere Konflikte</Text>
                  )}
                </Stack>
              </Paper>
            )}

            <Divider />

            </Stack>
          )}
        </Stack>

        <Group justify="space-between" wrap="wrap">
          {step === 1 && (
            <>
              <Button type="button" variant="subtle" onClick={onClose} fullWidth={isMobile}>
                Abbrechen
              </Button>
              <Button
                type="submit"
                onClick={handlePrepareImport}
                disabled={!canAnalyzeFile}
                loading={isPreparing}
                fullWidth={isMobile}
              >
                Datei analysieren
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <Button type="button" variant="subtle" onClick={() => setStep(1)} fullWidth={isMobile}>
                Zurück
              </Button>
              <Button type="submit" onClick={() => setStep(3)} disabled={!canContinueToStep3} fullWidth={isMobile}>
                Weiter zur Vorschau
              </Button>
            </>
          )}

          {step === 3 && (
            <>
              <Button type="button" variant="subtle" onClick={() => setStep(2)} fullWidth={isMobile}>
                Zurück
              </Button>
              <Button type="submit" onClick={handleApplyImport} loading={isApplying} disabled={!canImport || isApplying} fullWidth={isMobile}>
                Import ausführen
              </Button>
            </>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}

export default DataImportModal;
