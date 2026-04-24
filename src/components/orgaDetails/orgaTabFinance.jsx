import React from 'react';
import dayjs from 'dayjs';
import {
  Accordion,
  Button,
  Group,
  NumberInput,
  Paper,
  Stack,
  Text,
  TextInput,
  FileInput,
  Badge,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconPlus, IconUpload, IconDownload } from '@tabler/icons-react';
import { useDispatch, useSelector } from 'react-redux';
import AccordionListDetail from '../common/AccordionListDetail';
import { useOverlayData } from '../../hooks/useOverlayData';
import {
  addBayKiBiGRule,
  addGroupFeeEntry,
  updateBayKiBiGRule,
  updateGroupFeeEntry,
  deleteBayKiBiGRule,
  deleteGroupFeeEntry,
  setGroupFeeCatalogs,
  updateScenarioFinanceSettings,
} from '../../store/simFinanceSlice';
import {
  importBayKiBiGTableFromExcel,
  importBayKiBiGTableFromUrl,
} from '../../utils/financeImport';
import {
  buildFeeCatalogExportPayload,
  parseFeeCatalogImportPayload,
} from '../../utils/feeCatalogTransfer';

const STMAS_BAYKIBIG_URL = 'https://www.stmas.bayern.de/imperia/md/content/stmas/stmas_inet/kinderbetreuung/3.7.2.2_kfa-131118.xls';

function downloadJsonFile(fileName, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function toDateValue(value) {
  return value ? new Date(value) : null;
}

function toIsoDate(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return dayjs(value).format('YYYY-MM-DD');
}

function formatCurrency(value) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function BufferedTextInput({ value, onCommit, ...props }) {
  const [draft, setDraft] = React.useState(value ?? '');

  React.useEffect(() => {
    setDraft(value ?? '');
  }, [value]);

  return (
    <TextInput
      {...props}
      value={draft}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={() => onCommit(draft ?? '')}
    />
  );
}

function BufferedNumberInput({ value, onCommit, ...props }) {
  const [draft, setDraft] = React.useState(value ?? '');

  React.useEffect(() => {
    setDraft(value ?? '');
  }, [value]);

  return (
    <NumberInput
      {...props}
      value={draft}
      onChange={(nextValue) => setDraft(nextValue)}
      onBlur={() => onCommit(draft ?? '')}
    />
  );
}

function BayKiBiGSummary({ item }) {
  return (
    <Stack gap={2}>
      <Group justify="space-between">
        <Text fw={500}>{item.label || 'BayKiBiG-Regel'}</Text>
        <Badge size="sm" variant="light">{formatCurrency(item.baseValue)}/Jahr</Badge>
      </Group>
      <Text size="sm" c="dimmed">
        {item.validFrom ? `ab ${item.validFrom}` : 'sofort'}
        {item.validUntil ? ` bis ${item.validUntil}` : ''}
      </Text>
    </Stack>
  );
}

function BayKiBiGDetail({ item, scenarioId, dispatch }) {
  const factors = item.weightFactors || {};
  
  return (
    <Stack gap="sm">
      <BufferedTextInput
        label="Bezeichnung"
        value={item.label || ''}
        onCommit={(nextLabel) => dispatch(updateBayKiBiGRule({
          scenarioId,
          ruleId: item.id,
          updates: { label: nextLabel },
        }))}
      />
      <Group grow>
        <DatePickerInput
          label="Gueltig von"
          value={toDateValue(item.validFrom)}
          onChange={(value) => dispatch(updateBayKiBiGRule({
            scenarioId,
            ruleId: item.id,
            updates: { validFrom: toIsoDate(value) },
          }))}
          clearable
        />
        <DatePickerInput
          label="Gueltig bis"
          value={toDateValue(item.validUntil)}
          onChange={(value) => dispatch(updateBayKiBiGRule({
            scenarioId,
            ruleId: item.id,
            updates: { validUntil: toIsoDate(value) },
          }))}
          clearable
        />
      </Group>
      <BufferedNumberInput
        label="Grundwert pro Jahr (EUR)"
        value={item.baseValue}
        onCommit={(value) => dispatch(updateBayKiBiGRule({
          scenarioId,
          ruleId: item.id,
          updates: { baseValue: value ?? '' },
        }))}
        decimalScale={2}
        min={0}
        thousandSeparator="."
        decimalSeparator="," 
        suffix=" EUR"
      />
      
      <div>
        <Text fw={500} mb="sm">Gewichtungsfaktoren</Text>
        <Group grow>
          <BufferedNumberInput
            label="Regelkind (3-6 Jahre)"
            value={factors.regelkind_3to6 ?? 1.0}
            onCommit={(value) => dispatch(updateBayKiBiGRule({
              scenarioId,
              ruleId: item.id,
              updates: { weightFactors: { ...factors, regelkind_3to6: value ?? 1.0 } },
            }))}
            decimalScale={2}
            min={0}
            step={0.1}
          />
          <BufferedNumberInput
            label="Schulkind"
            value={factors.schulkind ?? 1.2}
            onCommit={(value) => dispatch(updateBayKiBiGRule({
              scenarioId,
              ruleId: item.id,
              updates: { weightFactors: { ...factors, schulkind: value ?? 1.2 } },
            }))}
            decimalScale={2}
            min={0}
            step={0.1}
          />
          <BufferedNumberInput
            label="Migration"
            value={factors.migration ?? 1.3}
            onCommit={(value) => dispatch(updateBayKiBiGRule({
              scenarioId,
              ruleId: item.id,
              updates: { weightFactors: { ...factors, migration: value ?? 1.3 } },
            }))}
            decimalScale={2}
            min={0}
            step={0.1}
          />
        </Group>
        <Group grow mt="xs">
          <BufferedNumberInput
            label="Unter 3 Jahren"
            value={factors.under3 ?? 2.0}
            onCommit={(value) => dispatch(updateBayKiBiGRule({
              scenarioId,
              ruleId: item.id,
              updates: { weightFactors: { ...factors, under3: value ?? 2.0 } },
            }))}
            decimalScale={2}
            min={0}
            step={0.1}
          />
          <BufferedNumberInput
            label="Behindert"
            value={factors.disabled ?? 4.5}
            onCommit={(value) => dispatch(updateBayKiBiGRule({
              scenarioId,
              ruleId: item.id,
              updates: { weightFactors: { ...factors, disabled: value ?? 4.5 } },
            }))}
            decimalScale={2}
            min={0}
            step={0.1}
          />
        </Group>
      </div>
    </Stack>
  );
}

function FeeEntrySummary({ item }) {
  const hoursLabel = `${item.minHours || 0} - ${item.maxHours || 'offen'} h`;
  return (
    <Stack gap={2}>
      <Text fw={500}>{item.label || hoursLabel}</Text>
      <Text size="sm" c="dimmed">
        {formatCurrency(item.monthlyAmount)} im Monat
      </Text>
    </Stack>
  );
}

function FeeEntryDetail({ item, groupId, scenarioId, dispatch }) {
  return (
    <Stack gap="sm">
      <BufferedTextInput
        label="Bezeichnung"
        value={item.label || ''}
        onCommit={(nextLabel) => dispatch(updateGroupFeeEntry({
          scenarioId,
          groupId,
          entryId: item.id,
          updates: { label: nextLabel },
        }))}
      />
      <Group grow>
        <DatePickerInput
          label="Gueltig von"
          value={toDateValue(item.validFrom)}
          onChange={(value) => dispatch(updateGroupFeeEntry({
            scenarioId,
            groupId,
            entryId: item.id,
            updates: { validFrom: toIsoDate(value) },
          }))}
          clearable
        />
        <DatePickerInput
          label="Gueltig bis"
          value={toDateValue(item.validUntil)}
          onChange={(value) => dispatch(updateGroupFeeEntry({
            scenarioId,
            groupId,
            entryId: item.id,
            updates: { validUntil: toIsoDate(value) },
          }))}
          clearable
        />
      </Group>
      <Group grow>
        <BufferedNumberInput
          label="Min. Wochenstunden"
          value={item.minHours}
          onCommit={(value) => dispatch(updateGroupFeeEntry({
            scenarioId,
            groupId,
            entryId: item.id,
            updates: { minHours: value ?? '' },
          }))}
          decimalScale={2}
          min={0}
          thousandSeparator="."
          decimalSeparator="," 
        />
        <BufferedNumberInput
          label="Max. Wochenstunden"
          value={item.maxHours}
          onCommit={(value) => dispatch(updateGroupFeeEntry({
            scenarioId,
            groupId,
            entryId: item.id,
            updates: { maxHours: value ?? '' },
          }))}
          decimalScale={2}
          min={0}
          thousandSeparator="."
          decimalSeparator="," 
        />
      </Group>
      <BufferedNumberInput
        label="Monatsbeitrag"
        value={item.monthlyAmount}
        onCommit={(value) => dispatch(updateGroupFeeEntry({
          scenarioId,
          groupId,
          entryId: item.id,
          updates: { monthlyAmount: value ?? '' },
        }))}
        decimalScale={2}
        min={0}
        thousandSeparator="."
        decimalSeparator="," 
        suffix=" EUR"
      />
    </Stack>
  );
}

function OrgaTabFinance() {
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector((state) => state.simScenario.selectedScenarioId);
  const financeScenario = useSelector((state) => state.simFinance.financeByScenario[selectedScenarioId] || {
    settings: { partialAbsenceThresholdDays: 42, partialAbsenceEmployerSharePercent: 0 },
    bayKiBiGRules: [],
    groupFeeCatalogs: {},
  });
  const { getEffectiveGroupDefs } = useOverlayData();
  const groupDefs = getEffectiveGroupDefs();
  const [excelFile, setExcelFile] = React.useState(null);
  const [excelUrl, setExcelUrl] = React.useState(STMAS_BAYKIBIG_URL);
  const [feeCatalogFile, setFeeCatalogFile] = React.useState(null);

  const handleImportBayKiBiG = async (file) => {
    if (file) {
      try {
        const result = await importBayKiBiGTableFromExcel(file);
        if (result) {
          dispatch(addBayKiBiGRule({
            scenarioId: selectedScenarioId,
            rule: result,
          }));
          setExcelFile(null);
        }
      } catch (error) {
        console.error('Error importing BayKiBiG table:', error);
        alert('Fehler beim Import: ' + error.message);
      }
    }
  };

  const handleImportBayKiBiGFromUrl = async () => {
    if (!excelUrl) return;
    try {
      const result = await importBayKiBiGTableFromUrl(excelUrl);
      if (result) {
        dispatch(addBayKiBiGRule({
          scenarioId: selectedScenarioId,
          rule: result,
        }));
      }
    } catch (error) {
      console.error('Error importing BayKiBiG table from URL:', error);
      alert('Fehler beim URL-Import: ' + error.message);
    }
  };

  const handleExportFeeCatalogs = () => {
    const payload = buildFeeCatalogExportPayload({
      scenarioId: selectedScenarioId,
      groupDefs,
      groupFeeCatalogs: financeScenario.groupFeeCatalogs || {},
    });

    downloadJsonFile(`beitragskataloge-${selectedScenarioId || 'scenario'}.json`, payload);
  };

  const handleImportFeeCatalogs = async (file) => {
    if (!file) return;
    try {
      const content = await file.text();
      const parsed = JSON.parse(content);
      const catalogs = parseFeeCatalogImportPayload(parsed);
      dispatch(setGroupFeeCatalogs({
        scenarioId: selectedScenarioId,
        catalogs,
      }));
      setFeeCatalogFile(null);
    } catch (error) {
      console.error('Error importing fee catalogs:', error);
      alert('Fehler beim Katalog-Import: ' + error.message);
    }
  };

  return (
    <Stack gap="md">
      <Paper withBorder p="md" radius="md">
        <Stack gap="md">
          <div>
            <Text fw={600}>BayKiBiG-Rahmen</Text>
            <Text size="sm" c="dimmed">
              Regeln gelten szenariospezifisch und koennen ueber Gueltigkeiten zeitlich gestaffelt werden.
            </Text>
          </div>

          <AccordionListDetail
            items={financeScenario.bayKiBiGRules}
            SummaryComponent={({ item }) => <BayKiBiGSummary item={item} />}
            DetailComponent={({ item }) => <BayKiBiGDetail item={item} scenarioId={selectedScenarioId} dispatch={dispatch} />}
            AddButtonLabel="BayKiBiG-Regel hinzufuegen"
            emptyText="Noch keine BayKiBiG-Regel erfasst."
            onAdd={() => dispatch(addBayKiBiGRule({
              scenarioId: selectedScenarioId,
              rule: { label: 'BayKiBiG', validFrom: '', validUntil: '', baseValue: '' },
            }))}
            onDelete={(_, item) => dispatch(deleteBayKiBiGRule({ scenarioId: selectedScenarioId, ruleId: item.id }))}
          />
          
          <Group align="end" grow>
            <FileInput
              label="Offizielle Tabelle importieren"
              placeholder=".xls Datei von stmas.bayern.de"
              accept=".xls"
              value={excelFile}
              onChange={setExcelFile}
              clearable
            />
            <Button
              leftSection={<IconUpload size={16} />}
              onClick={() => excelFile && handleImportBayKiBiG(excelFile)}
              disabled={!excelFile}
              mt="auto"
            >
              Datei importieren
            </Button>
          </Group>

          <Group align="end" grow>
            <TextInput
              label="Oder per URL importieren"
              value={excelUrl}
              onChange={(event) => setExcelUrl(event.currentTarget.value)}
              placeholder={STMAS_BAYKIBIG_URL}
            />
            <Button
              leftSection={<IconUpload size={16} />}
              onClick={handleImportBayKiBiGFromUrl}
              disabled={!excelUrl?.trim()}
              mt="auto"
            >
              URL importieren
            </Button>
          </Group>
        </Stack>
      </Paper>

      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <div>
            <Text fw={600}>Teilweise Bezahlte Abwesenheit</Text>
            <Text size="sm" c="dimmed">
              Nach Ablauf der Lohnfortzahlung kann ein reduzierter Arbeitgeberanteil berechnet werden.
            </Text>
          </div>
          <Group grow>
            <BufferedNumberInput
              label="Schwelle in Tagen (ab wann Reduktion)"
              value={financeScenario.settings?.partialAbsenceThresholdDays ?? 42}
              onCommit={(value) => dispatch(updateScenarioFinanceSettings({
                scenarioId: selectedScenarioId,
                updates: { partialAbsenceThresholdDays: value ?? 42 },
              }))}
              min={1}
              suffix=" Tage"
            />
            <BufferedNumberInput
              label="Arbeitgeberanteil nach Schwelle"
              value={financeScenario.settings?.partialAbsenceEmployerSharePercent ?? 0}
              onCommit={(value) => dispatch(updateScenarioFinanceSettings({
                scenarioId: selectedScenarioId,
                updates: { partialAbsenceEmployerSharePercent: value ?? 0 },
              }))}
              min={0}
              max={100}
              suffix=" %"
            />
          </Group>
        </Stack>
      </Paper>

      <Paper withBorder p="md" radius="md">
        <Stack gap="md">
          <div>
            <Text fw={600}>Beitragskataloge pro Gruppe</Text>
            <Text size="sm" c="dimmed">
              Jede Gruppe hat ihren eigenen Katalog mit Wochenstundenstaffeln und Gueltigkeiten.
            </Text>
          </div>

          <Group align="end" grow>
            <Button
              leftSection={<IconDownload size={16} />}
              onClick={handleExportFeeCatalogs}
              variant="light"
            >
              Beitragskataloge exportieren
            </Button>
            <FileInput
              label="Kataloge importieren"
              placeholder=".json Datei waehlen"
              accept="application/json,.json"
              value={feeCatalogFile}
              onChange={setFeeCatalogFile}
              clearable
            />
            <Button
              leftSection={<IconUpload size={16} />}
              onClick={() => feeCatalogFile && handleImportFeeCatalogs(feeCatalogFile)}
              disabled={!feeCatalogFile}
              mt="auto"
            >
              Kataloge importieren
            </Button>
          </Group>

          {groupDefs.length === 0 ? (
            <Text size="sm" c="dimmed">Keine Gruppen vorhanden.</Text>
          ) : (
            <Accordion variant="separated">
              {groupDefs.map((group) => {
                const entries = financeScenario.groupFeeCatalogs?.[group.id] || [];
                return (
                  <Accordion.Item key={group.id} value={group.id}>
                    <Accordion.Control>
                      <Group justify="space-between">
                        <div>
                          <Text fw={500}>{group.name || 'Gruppe'}</Text>
                          <Text size="sm" c="dimmed">{entries.length} Staffel{entries.length === 1 ? '' : 'n'}</Text>
                        </div>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <AccordionListDetail
                        items={entries}
                        SummaryComponent={({ item }) => <FeeEntrySummary item={item} />}
                        DetailComponent={({ item }) => (
                          <FeeEntryDetail
                            item={item}
                            groupId={group.id}
                            scenarioId={selectedScenarioId}
                            dispatch={dispatch}
                          />
                        )}
                        AddButtonLabel="Beitragsstaffel hinzufuegen"
                        emptyText="Noch keine Beitragsstaffel hinterlegt."
                        onAdd={() => dispatch(addGroupFeeEntry({
                          scenarioId: selectedScenarioId,
                          groupId: group.id,
                          entry: { validFrom: '', validUntil: '', minHours: '', maxHours: '', monthlyAmount: '' },
                        }))}
                        onDelete={(_, item) => dispatch(deleteGroupFeeEntry({
                          scenarioId: selectedScenarioId,
                          groupId: group.id,
                          entryId: item.id,
                        }))}
                      />
                    </Accordion.Panel>
                  </Accordion.Item>
                );
              })}
            </Accordion>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}

export default OrgaTabFinance;