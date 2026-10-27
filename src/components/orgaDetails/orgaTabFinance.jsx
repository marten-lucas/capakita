import React from 'react';
import dayjs from 'dayjs';
import {
  Accordion,
  Alert,
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
import AccordionListDetail from '../common/AccordionListDetail';
import { useOverlayData } from '../../hooks/useOverlayData';
import {
  addBayKiBiGRule,
  updateBayKiBiGRule,
  deleteBayKiBiGRule,
  setGroupFeeCatalogs,
  updateParentFeeSubsidy,
  updateScenarioFinanceSettings,
} from '../../store/simFinanceSlice';
import {
  importBayKiBiGTableFromExcel,
  importBayKiBiGTableFromUrl,
} from '../../utils/financeImport';
import { getFeeBandZeitkatId } from '../../utils/adebisConstants';
import FeeStaircaseEditor from '../common/FeeStaircaseEditor';
import { DEFAULT_REFORM_FORECAST, REFORM_YEARS } from '../../utils/reformSimulation';
import {
  buildFeeCatalogExportPayload,
  extractFeeCatalogImportData,
  proposeFeeCatalogMappings,
  applyFeeCatalogMappings,
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

function ForecastNumberInput({ value, onCommit, ...props }) {
  const [draft, setDraft] = React.useState(value ?? '');

  React.useEffect(() => setDraft(value ?? ''), [value]);

  return (
    <NumberInput
      {...props}
      value={draft}
      onChange={setDraft}
      onBlur={() => onCommit(draft === '' ? null : Number(draft))}
      decimalScale={2}
      min={0}
      thousandSeparator="."
      decimalSeparator=","
      suffix=" EUR"
    />
  );
}

function ReformForecastSettings({ settings, parentFeeSubsidy, scenarioId, dispatch }) {
  const forecast = settings?.reformForecast || {};
  const actual = forecast.actualFunding || {};
  const update = (path, value) => {
    const next = { ...forecast, actualFunding: { ...actual } };
    const [section, key] = path;
    if (section === 'actualFunding') next.actualFunding = { ...actual, [key]: value ?? 0 };
    else if (section === 'approvedPlaces' || section === 'teamGrantEligible') next[section] = value;
    else next[section] = { ...(forecast[section] || {}), [key]: value };
    dispatch(updateScenarioFinanceSettings({
      scenarioId,
      updates: { reformForecast: next },
    }));
  };
  const updateTeamRate = (year, key, value) => {
    const rates = forecast.teamRatesByYear || {};
    const yearRates = rates[year] || {};
    dispatch(updateScenarioFinanceSettings({
      scenarioId,
      updates: {
        reformForecast: {
          ...forecast,
          teamRatesByYear: { ...rates, [year]: { ...yearRates, [key]: value } },
        },
      },
    }));
  };
  const actualFields = [
    ['bookingTime', 'Förderung nach Buchungszeiten'],
    ['qualityBonus', 'Qualitätsbonus'],
    ['preparatoryCourses', 'Vorkurse'],
    ['under3Additional', 'Zusatzförderung U3'],
    ['under3Federal', 'U3-Bundesmittel'],
    ['parentFeeSubsidy', 'Elternbeitragszuschuss (durchlaufend)'],
    ['assistance', 'Bisherige Richtlinienförderung: Assistenzkräfte'],
    ['personnelBonus', 'Bisherige Richtlinienförderung: Personalbonus'],
    ['languageSpecialists', 'Bisherige Richtlinienförderung: Sprachfachkräfte'],
  ];

  return (
    <Paper withBorder p="md" radius="md" data-testid="reform-forecast-settings">
      <Stack gap="md">
        <div>
          <Text fw={600}>BayKiBiG-Reform – Jahresrechnung nach Berechnungsvorlage 2027</Text>
          <Text size="sm" c="dimmed">
            Übernimm die Ist-Jahressummen 2026 aus KiBiG.web. Die vorhandenen BayKiBiG-Regeln und Gewichtungsfaktoren bleiben die Quelle für die kindbezogene Simulation; diese Tabelle bildet zusätzlich die Jahresrechnung der freigegebenen Vorlage ab.
          </Text>
        </div>
        <Alert color="blue" variant="light" title="Abgrenzung">
          Der Elternbeitragszuschuss wird 2026 separat als durchlaufender Posten gezeigt, ab 2027 mit 0 angesetzt und nicht in das Reformergebnis eingerechnet. Unbekannte Steigerungen des Basiswerts stehen zunächst auf 0 % und sind editierbare Annahmen.
        </Alert>
        <DatePickerInput
          label="Elternbeitragszuschuss gilt bis einschließlich"
          description="Danach wird in der Beitrags- und Jahres-Simulation kein Zuschuss mehr angesetzt. Feld leeren, wenn er unbegrenzt weiterläuft."
          value={toDateValue(parentFeeSubsidy?.endDate)}
          onChange={(value) => dispatch(updateParentFeeSubsidy({
            scenarioId,
            updates: { endDate: toIsoDate(value) },
          }))}
          valueFormat="DD.MM.YYYY"
          clearable
          data-testid="parent-fee-subsidy-end-date"
        />
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
          {actualFields.map(([key, label]) => (
            <ForecastNumberInput
              key={key}
              label={`Ist 2026 · ${label}`}
              value={actual[key] ?? 0}
              onCommit={(value) => update(['actualFunding', key], value ?? 0)}
              data-testid={`reform-actual-${key}`}
            />
          ))}
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <NumberInput
            label="Genehmigte Plätze (Betriebserlaubnis)"
            min={0}
            step={1}
            value={forecast.approvedPlaces ?? 0}
            onChange={(value) => update(['approvedPlaces', Number(value) || 0])}
            data-testid="reform-approved-places"
          />
          <Switch
            mt="xl"
            label="Teamkräfteförderung ab 2027 berücksichtigen"
            checked={forecast.teamGrantEligible === true}
            onChange={(event) => update(['teamGrantEligible', event.currentTarget.checked])}
            data-testid="reform-team-grant-eligible"
          />
        </SimpleGrid>
        <div>
          <Text fw={500} mb="xs">Jahresannahmen und Fördersätze</Text>
          <Paper withBorder radius="sm" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead><tr>
                <th style={{ textAlign: 'left', padding: 8 }}>Baustein</th>
                {REFORM_YEARS.map((year) => <th key={year} style={{ textAlign: 'right', padding: 8 }}>{year}</th>)}
              </tr></thead>
              <tbody>
                <tr>
                  <td style={{ padding: 8 }}>Basiswert-Steigerung</td>
                  {REFORM_YEARS.map((year) => (
                    <td key={year} style={{ padding: 8 }}>
                      {year === 2026 ? <Text ta="right" c="dimmed">Istwert</Text> : (
                        <ForecastNumberInput
                          aria-label={`Basiswert-Steigerung ${year} Prozent`}
                          value={forecast.baseValueIncreasePercentByYear?.[year] ?? 0}
                          onCommit={(value) => update(['baseValueIncreasePercentByYear', year], value ?? 0)}
                          suffix=" %"
                          data-testid={`reform-base-increase-${year}`}
                        />
                      )}
                    </td>
                  ))}
                </tr>
                {[
                  ['qualityBonusByYear', 'Qualitätsbonus'],
                  ['preparatoryCoursesByYear', 'Vorkurse (leer = Fortschreibung mit Basiswertrate)'],
                  ['under3AdditionalByYear', 'Zusatzförderung U3'],
                  ['under3FederalByYear', 'U3-Bundesmittel'],
                ].map(([section, label]) => (
                  <tr key={section}>
                    <td style={{ padding: 8 }}>{label}</td>
                    {REFORM_YEARS.map((year) => (
                      <td key={year} style={{ padding: 8 }}>
                        {year === 2026 ? <Text ta="right" c="dimmed">Istwert oben</Text> : (
                          <ForecastNumberInput
                            aria-label={`${label} ${year}`}
                            value={forecast[section]?.[year] ?? DEFAULT_REFORM_FORECAST[section]?.[year] ?? ''}
                            onCommit={(value) => update([section, year], value)}
                            data-testid={`reform-${section}-${year}`}
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <td style={{ padding: 8 }}>Teamkräfte · Satz je Platz bis 50</td>
                  {REFORM_YEARS.map((year) => <td key={year} style={{ padding: 8 }}>{year === 2026 ? <Text ta="right" c="dimmed">–</Text> : (
                    <ForecastNumberInput
                      aria-label={`Teamkräfte Satz bis 50 Plätze ${year}`}
                      value={forecast.teamRatesByYear?.[year]?.first50 ?? DEFAULT_REFORM_FORECAST.teamRatesByYear[year]?.first50}
                      onCommit={(value) => updateTeamRate(year, 'first50', value ?? 0)}
                      data-testid={`reform-team-rate-first50-${year}`}
                    />
                  )}</td>)}
                </tr>
                <tr>
                  <td style={{ padding: 8 }}>Teamkräfte · Satz je Platz 51–150</td>
                  {REFORM_YEARS.map((year) => <td key={year} style={{ padding: 8 }}>{year === 2026 ? <Text ta="right" c="dimmed">–</Text> : (
                    <ForecastNumberInput
                      aria-label={`Teamkräfte Satz Plätze 51 bis 150 ${year}`}
                      value={forecast.teamRatesByYear?.[year]?.remaining100 ?? DEFAULT_REFORM_FORECAST.teamRatesByYear[year]?.remaining100}
                      onCommit={(value) => updateTeamRate(year, 'remaining100', value ?? 0)}
                      data-testid={`reform-team-rate-remaining-${year}`}
                    />
                  )}</td>)}
                </tr>
              </tbody>
            </table>
          </Paper>
          <Text size="xs" c="dimmed" mt="xs">
            Teamkräfte-Sätze sind gemäß Vorlage vorbelegt. Die Tarife werden versioniert in der bestehenden Szenario-Finanzkonfiguration gespeichert; die Ist-Jahressummen bleiben manuelle KiBiG.web-Eingaben.
          </Text>
        </div>
      </Stack>
    </Paper>
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
  const { getEffectiveGroupDefs } = useOverlayData();
  const groupDefs = getEffectiveGroupDefs();
  const [excelFile, setExcelFile] = React.useState(null);
  const [excelUrl, setExcelUrl] = React.useState(STMAS_BAYKIBIG_URL);
  const [feeCatalogFile, setFeeCatalogFile] = React.useState(null);
  const [feeCatalogImportOpen, setFeeCatalogImportOpen] = React.useState(false);
  const [feeCatalogSourceByKey, setFeeCatalogSourceByKey] = React.useState({});
  const [feeCatalogSources, setFeeCatalogSources] = React.useState([]);
  const [feeCatalogMappingByGroup, setFeeCatalogMappingByGroup] = React.useState({});
  const [feeCatalogUnmatchedSourceKeys, setFeeCatalogUnmatchedSourceKeys] = React.useState([]);

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
      const extracted = extractFeeCatalogImportData(parsed, { preferNonMember: true });

      if (!Array.isArray(groupDefs) || groupDefs.length === 0) {
        dispatch(setGroupFeeCatalogs({
          scenarioId: selectedScenarioId,
          catalogs: extracted.catalogsByKey,
        }));
        setFeeCatalogFile(null);
        return;
      }

      const proposal = proposeFeeCatalogMappings({
        groupDefs,
        catalogDescriptors: extracted.catalogDescriptors,
      });

      const nextMapping = {};
      groupDefs.forEach((group) => {
        nextMapping[String(group.id)] = proposal.mappingsByGroupId?.[String(group.id)]?.sourceKey || null;
      });

      setFeeCatalogSourceByKey(extracted.catalogsByKey || {});
      setFeeCatalogSources(extracted.catalogDescriptors || []);
      setFeeCatalogMappingByGroup(nextMapping);
      setFeeCatalogUnmatchedSourceKeys(proposal.unmatchedSourceKeys || []);
      setFeeCatalogImportOpen(true);
    } catch (error) {
      console.error('Error importing fee catalogs:', error);
      alert('Fehler beim Katalog-Import: ' + error.message);
    }
  };

  const handleApplyFeeCatalogImport = () => {
    const finalCatalogs = applyFeeCatalogMappings({
      mappingsByGroupId: Object.fromEntries(
        Object.entries(feeCatalogMappingByGroup || {}).map(([groupId, sourceKey]) => [
          String(groupId),
          { sourceKey: sourceKey || null },
        ])
      ),
      catalogsByKey: feeCatalogSourceByKey,
    });

    dispatch(setGroupFeeCatalogs({
      scenarioId: selectedScenarioId,
      catalogs: finalCatalogs,
    }));

    setFeeCatalogImportOpen(false);
    setFeeCatalogFile(null);
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
          <ReformForecastSettings
            settings={financeScenario.settings}
            parentFeeSubsidy={financeScenario.parentFeeSubsidy}
            scenarioId={selectedScenarioId}
            dispatch={dispatch}
          />
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
              Beitragssätze werden je Gruppe und ZEITKAT (Stunden pro Tag) gepflegt. Alte Stundenobergrenzen werden beim Import in die passende ZEITKAT-Kategorie überführt.
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
                const zeitkatCount = entries.filter((entry) => Boolean(getFeeBandZeitkatId(entry))).length;
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
            Ordne jede Zielgruppe einer importierten Quelle zu. So bleiben die Beiträge auch dann korrekt,
            wenn Gruppen-IDs zwischen Datei und Szenario nicht identisch sind.
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
