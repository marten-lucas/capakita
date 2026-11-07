import React from 'react';
import dayjs from 'dayjs';
import {
  Accordion,
  Alert,
  Checkbox,
  Modal,
  Button,
  Group,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  FileInput,
  Badge,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { DatePickerInput } from '@mantine/dates';
import { IconPlus, IconUpload, IconDownload } from '@tabler/icons-react';
import { useDispatch, useSelector } from 'react-redux';
import { notifications } from '@mantine/notifications';
import AccordionListDetail from '../common/AccordionListDetail';
import { useOverlayData } from '../../hooks/useOverlayData';
import {
  addBayKiBiGRule,
  seedDefaultBayKiBiGRules,
  updateBayKiBiGRule,
  deleteBayKiBiGRule,
  setGroupFeeCatalogs,
  setGroupParentFeeSubsidies,
  updateGroupParentFeeSubsidy,
  updateScenarioFinanceSettings,
} from '../../store/simFinanceSlice';
import {
  importBayKiBiGTableFromExcel,
  importBayKiBiGTableFromUrl,
} from '../../utils/financeImport';
import { getFeeBandZeitkatId } from '../../utils/adebisConstants';
import FeeStaircaseEditor from '../common/FeeStaircaseEditor';

import {
  buildFeeCatalogExportPayload,
  extractFeeCatalogImportData,
  proposeFeeCatalogMappings,
  applyFeeCatalogMappings,
  applyParentFeeSubsidyMappings,
} from '../../utils/feeCatalogTransfer';

const STMAS_BAYKIBIG_URL = 'https://www.stmas.bayern.de/imperia/md/content/stmas/stmas_inet/kinderbetreuung/3.7.2.2_kfa-131118.xls';
const EMPTY_FINANCE_SCENARIO = {
  settings: { partialAbsenceThresholdDays: 42, partialAbsenceEmployerSharePercent: 0 },
  bayKiBiGRules: [],
  groupFeeCatalogs: {},
};

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
      <Group justify="space-between" wrap="wrap">
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
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
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
      </SimpleGrid>
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
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
        <BufferedNumberInput
          label="Qualitätsbonus-Basiswert"
          description="ADEBIS-Bonus = BuStdGew × Basiswert ÷ 48"
          value={item.qualityBonusBenchmark ?? 0}
          onCommit={(value) => dispatch(updateBayKiBiGRule({
            scenarioId,
            ruleId: item.id,
            updates: { qualityBonusBenchmark: Number(value) || 0 },
          }))}
          decimalScale={2}
          min={0}
          thousandSeparator="."
          decimalSeparator=","
          suffix=" EUR"
        />
        <BufferedNumberInput
          label="U3-Zusatzförderungsfaktor je Kind"
          description="Anteil des Basiswerts je aktivem U3-Kind und Monat"
          value={item.under3AdditionalFactor ?? 0.025}
          onCommit={(value) => dispatch(updateBayKiBiGRule({
            scenarioId,
            ruleId: item.id,
            updates: { under3AdditionalFactor: Number(value) || 0 },
          }))}
          decimalScale={4}
          min={0}
          step={0.0025}
        />
        <BufferedNumberInput
          label="Vorkursförderung je Kind/Jahr"
          value={item.preparatoryCoursePerChild ?? 0}
          onCommit={(value) => dispatch(updateBayKiBiGRule({
            scenarioId,
            ruleId: item.id,
            updates: { preparatoryCoursePerChild: Number(value) || 0 },
          }))}
          decimalScale={2}
          min={0}
          thousandSeparator="."
          decimalSeparator=","
          suffix=" EUR"
        />
      </SimpleGrid>
      <div>
        <Text fw={500} mb="sm">Gewichtungsfaktoren</Text>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
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
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mt="xs">
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
        </SimpleGrid>
      </div>
    </Stack>
  );
}

function OrgaTabFinance({ section = 'all' }) {
  const dispatch = useDispatch();
  const isMobile = useMediaQuery('(max-width: 48em)');
  const selectedScenarioId = useSelector((state) => state.simScenario.selectedScenarioId);
  const referenceDate = useSelector((state) => state.chart?.[selectedScenarioId]?.referenceDate)
    || new Date().toISOString().slice(0, 10);
  const financeScenario = useSelector(
    (state) => state.simFinance.financeByScenario[selectedScenarioId] || EMPTY_FINANCE_SCENARIO
  );
  React.useEffect(() => {
    if (selectedScenarioId) dispatch(seedDefaultBayKiBiGRules({ scenarioId: selectedScenarioId }));
  }, [dispatch, selectedScenarioId]);
  const { getEffectiveGroupDefs } = useOverlayData();
  const groupDefs = getEffectiveGroupDefs();
  const [excelFile, setExcelFile] = React.useState(null);
  const [excelUrl, setExcelUrl] = React.useState(STMAS_BAYKIBIG_URL);
  const [feeCatalogFile, setFeeCatalogFile] = React.useState(null);
  const [feeCatalogImportOpen, setFeeCatalogImportOpen] = React.useState(false);
  const [feeCatalogSourceByKey, setFeeCatalogSourceByKey] = React.useState({});
  const [feeCatalogParentSubsidyByKey, setFeeCatalogParentSubsidyByKey] = React.useState({});
  const [feeCatalogSources, setFeeCatalogSources] = React.useState([]);
  const [feeCatalogMappingByGroup, setFeeCatalogMappingByGroup] = React.useState({});
  const [feeCatalogUnmatchedSourceKeys, setFeeCatalogUnmatchedSourceKeys] = React.useState([]);
  const [feeCatalogAutoMappedGroupCount, setFeeCatalogAutoMappedGroupCount] = React.useState(0);

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
      parentFeeSubsidiesByGroup: financeScenario.parentFeeSubsidiesByGroup || {},
    });

    downloadJsonFile(`beitragskataloge-${selectedScenarioId || 'scenario'}.json`, payload);
  };

  const commitFeeCatalogImport = (mappingsByGroupId, catalogsByKey, parentFeeSubsidiesByKey) => {
    const normalizedMappings = Object.fromEntries(Object.entries(mappingsByGroupId || {}).map(([groupId, mapping]) => [
      String(groupId),
      typeof mapping === 'string' ? { sourceKey: mapping || null } : mapping,
    ]));
    const finalCatalogs = applyFeeCatalogMappings({ mappingsByGroupId: normalizedMappings, catalogsByKey });
    dispatch(setGroupFeeCatalogs({ scenarioId: selectedScenarioId, catalogs: finalCatalogs }));
    const mappedSubsidies = applyParentFeeSubsidyMappings({ mappingsByGroupId: normalizedMappings, parentFeeSubsidiesByKey });
    if (Object.keys(mappedSubsidies).length > 0) {
      dispatch(setGroupParentFeeSubsidies({
        scenarioId: selectedScenarioId,
        subsidies: {
          ...(financeScenario.parentFeeSubsidiesByGroup || {}),
          ...mappedSubsidies,
        },
      }));
    }
    return finalCatalogs;
  };

  const handleImportFeeCatalogs = async (file) => {
    if (!file) return;
    try {
      const content = await file.text();
      const parsed = JSON.parse(content);
      const extracted = extractFeeCatalogImportData(parsed, { preferNonMember: true });

      if (!Array.isArray(groupDefs) || groupDefs.length === 0) {
        dispatch(setGroupFeeCatalogs({
          scenarioId: selectedScenarioId,
          catalogs: extracted.catalogsByKey,
        }));
        dispatch(setGroupParentFeeSubsidies({
          scenarioId: selectedScenarioId,
          subsidies: extracted.parentFeeSubsidiesByKey,
        }));
        setFeeCatalogFile(null);
        return;
      }

      const proposal = proposeFeeCatalogMappings({
        groupDefs,
        catalogDescriptors: extracted.catalogDescriptors,
      });
      const mappingsByGroupId = proposal.mappingsByGroupId || {};
      const autoMappedGroupCount = groupDefs.filter((group) => {
        const mapping = mappingsByGroupId[String(group.id)];
        return Boolean(mapping?.sourceKey) && Number(mapping.score) >= 85;
      }).length;
      const nextMapping = {};
      groupDefs.forEach((group) => {
        nextMapping[String(group.id)] = mappingsByGroupId[String(group.id)]?.sourceKey || null;
      });

      if (groupDefs.length > 0 && autoMappedGroupCount === groupDefs.length) {
        commitFeeCatalogImport(mappingsByGroupId, extracted.catalogsByKey || {}, extracted.parentFeeSubsidiesByKey || {});
        setFeeCatalogFile(null);
        notifications.show({
          title: 'Beitragskataloge importiert',
          message: `${autoMappedGroupCount} Gruppen wurden anhand ihrer Bezeichnung/Betreuungsart zugeordnet.`,
          color: 'teal',
        });
        return;
      }

      setFeeCatalogSourceByKey(extracted.catalogsByKey || {});
      setFeeCatalogParentSubsidyByKey(extracted.parentFeeSubsidiesByKey || {});
      setFeeCatalogSources(extracted.catalogDescriptors || []);
      setFeeCatalogMappingByGroup(nextMapping);
      setFeeCatalogUnmatchedSourceKeys(proposal.unmatchedSourceKeys || []);
      setFeeCatalogAutoMappedGroupCount(autoMappedGroupCount);
      setFeeCatalogImportOpen(true);
    } catch (error) {
      console.error('Error importing fee catalogs:', error);
      alert('Fehler beim Katalog-Import: ' + error.message);
    }
  };

  const handleApplyFeeCatalogImport = () => {
    commitFeeCatalogImport(feeCatalogMappingByGroup, feeCatalogSourceByKey, feeCatalogParentSubsidyByKey);
    setFeeCatalogImportOpen(false);
    setFeeCatalogFile(null);
    notifications.show({ title: 'Beitragskataloge importiert', message: 'Die ausgewählten Zuordnungen wurden angewendet.', color: 'teal' });
  };

  const hasUnmappedGroups = Array.isArray(groupDefs)
    && groupDefs.some((group) => !feeCatalogMappingByGroup?.[String(group.id)]);

  const feeCatalogSourceOptions = (feeCatalogSources || []).map((source) => {
    const sourceName = source.groupName || source.key;
    return {
      value: String(source.key),
      label: `${sourceName} (${source.entries?.length || 0} Staffeln)`,
    };
  });

  const showFunding = section === 'all' || section === 'funding';
  const showAbsence = section === 'all' || section === 'absence';
  const showFees = section === 'all' || section === 'fees';

  return (
    <Stack gap="md">
      {showFunding && (
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
          
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
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
              fullWidth={isMobile}
            >
              Datei importieren
            </Button>
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
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
              fullWidth={isMobile}
            >
              URL importieren
            </Button>
          </SimpleGrid>
        </Stack>
      </Paper>
      )}

      {showAbsence && (
      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <div>
            <Text fw={600}>Teilweise Bezahlte Abwesenheit</Text>
            <Text size="sm" c="dimmed">
              Nach Ablauf der Lohnfortzahlung kann ein reduzierter Arbeitgeberanteil berechnet werden.
            </Text>
          </div>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
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
          </SimpleGrid>
        </Stack>
      </Paper>
      )}

      {showFees && (
      <Paper withBorder p="md" radius="md">
        <Stack gap="md">
          <div>
            <Text fw={600}>Beitragskataloge pro Gruppe</Text>
            <Text size="sm" c="dimmed">
              Beitragssätze werden je Gruppe und ZEITKAT (Stunden pro Tag) gepflegt. Alte Stundenobergrenzen werden beim Import in die passende ZEITKAT-Kategorie überführt. JSON-Kataloge werden anhand von Gruppenname und Betreuungsart vorbefüllt; eindeutige Zuordnungen werden direkt importiert.
            </Text>
          </div>

          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
            <Button
              leftSection={<IconDownload size={16} />}
              onClick={handleExportFeeCatalogs}
              variant="light"
              fullWidth={isMobile}
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
              fullWidth={isMobile}
            >
              Kataloge importieren
            </Button>
          </SimpleGrid>

          {groupDefs.length === 0 ? (
            <Text size="sm" c="dimmed">Keine Gruppen vorhanden.</Text>
          ) : (
            <Accordion variant="separated">
              {groupDefs.map((group) => {
                const entries = financeScenario.groupFeeCatalogs?.[group.id] || [];
                const parentFeeSubsidy = financeScenario.parentFeeSubsidiesByGroup?.[String(group.id)]
                  || financeScenario.parentFeeSubsidy
                  || { enabled: true, monthlyAmount: 100, endDate: '2026-12-31' };
                const zeitkatCount = entries.filter((entry) => Boolean(getFeeBandZeitkatId(entry)) && entry.enabled !== false && Number(entry.monthlyAmount) > 0).length;
                const entrySummary = `${zeitkatCount} ZEITKAT-Sätze`;
                return (
                  <Accordion.Item key={group.id} value={group.id}>
                    <Accordion.Control>
                      <Group justify="space-between" wrap="wrap">
                        <div>
                          <Text fw={500}>{group.name || 'Gruppe'}</Text>
                          <Text size="sm" c="dimmed">{entrySummary}</Text>
                        </div>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap="md">
                        <FeeStaircaseEditor
                          entries={entries}
                          referenceDate={referenceDate}
                          onChangeEntries={(nextEntries) => dispatch(setGroupFeeCatalogs({
                            scenarioId: selectedScenarioId,
                            catalogs: {
                              ...(financeScenario.groupFeeCatalogs || {}),
                              [String(group.id)]: nextEntries,
                            },
                          }))}
                        />
                        <Paper withBorder p="sm" radius="sm" data-testid={`fee-catalog-parent-subsidy-${group.id}`}>
                          <Stack gap="sm">
                            <Text fw={600} size="sm">Elternbeitragszuschuss dieser Beitragsordnung</Text>
                            <Text size="sm" c="dimmed">Monatsbetrag für jedes aktive Kind dieser Gruppe; gilt höchstens bis zum Enddatum.</Text>
                            <Checkbox
                              label="Elternbeitragszuschuss für diese Beitragsordnung aktiv"
                              checked={parentFeeSubsidy.enabled !== false}
                              onChange={(event) => {
                                const enabled = event.currentTarget.checked;
                                dispatch(updateGroupParentFeeSubsidy({
                                  scenarioId: selectedScenarioId,
                                  groupId: group.id,
                                  updates: { enabled },
                                }));
                              }}
                              data-testid={`fee-catalog-parent-subsidy-enabled-${group.id}`}
                            />
                            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                              <BufferedNumberInput
                                label="Zuschuss pro Monat (EUR)"
                                value={parentFeeSubsidy.monthlyAmount ?? 100}
                                min={0}
                                decimalScale={2}
                                thousandSeparator="."
                                decimalSeparator=","
                                onCommit={(value) => dispatch(updateGroupParentFeeSubsidy({
                                  scenarioId: selectedScenarioId,
                                  groupId: group.id,
                                  updates: { monthlyAmount: Number(value) || 0 },
                                }))}
                                data-testid={`fee-catalog-parent-subsidy-amount-${group.id}`}
                              />
                              <DatePickerInput
                                label="Zuschuss gilt bis einschließlich"
                                value={toDateValue(parentFeeSubsidy.endDate)}
                                onChange={(value) => dispatch(updateGroupParentFeeSubsidy({
                                  scenarioId: selectedScenarioId,
                                  groupId: group.id,
                                  updates: { endDate: toIsoDate(value) },
                                }))}
                                valueFormat="DD.MM.YYYY"
                                clearable
                                data-testid={`fee-catalog-parent-subsidy-end-${group.id}`}
                              />
                            </SimpleGrid>
                          </Stack>
                        </Paper>
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>
                );
              })}
            </Accordion>
          )}
        </Stack>
      </Paper>
      )}

      {showFees && (
      <Modal
        opened={feeCatalogImportOpen}
        onClose={() => setFeeCatalogImportOpen(false)}
        title="Import-Wizard: Beitragskataloge zuordnen"
        size="lg"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Vorbelegung: {feeCatalogAutoMappedGroupCount} von {groupDefs.length} Gruppen wurden anhand von Gruppenname und Betreuungsart zugeordnet. Prüfe die Vorschläge und ergänze nur unklare Zuordnungen.
          </Text>

          {feeCatalogUnmatchedSourceKeys.length > 0 ? (
            <Alert color="yellow" title="Nicht automatisch zugeordnete Quellen">
              {feeCatalogUnmatchedSourceKeys.join(', ')}
            </Alert>
          ) : null}

          <Stack gap="sm">
            {(groupDefs || []).map((group) => (
              <Select
                key={group.id}
                label={group.name || `Gruppe ${group.id}`}
                placeholder="Import-Quelle waehlen"
                data={feeCatalogSourceOptions}
                value={feeCatalogMappingByGroup?.[String(group.id)] || null}
                onChange={(value) => setFeeCatalogMappingByGroup((current) => ({
                  ...current,
                  [String(group.id)]: value || null,
                }))}
                clearable
                searchable
              />
            ))}
          </Stack>

          <Group justify="flex-end">
            <Button variant="default" onClick={() => setFeeCatalogImportOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleApplyFeeCatalogImport} disabled={hasUnmappedGroups}>
              Import anwenden
            </Button>
          </Group>
        </Stack>
      </Modal>
      )}
    </Stack>
  );
}

export default OrgaTabFinance;
