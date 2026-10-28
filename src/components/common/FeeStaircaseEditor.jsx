import React from 'react';
import { Alert, Anchor, Box, Button, Checkbox, Group, NumberInput, Select, Slider, Stack, Text } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { createId } from '../../utils/idUtils';
import { getFeeBandZeitkatId, ZEITKAT_CATALOG } from '../../utils/adebisConstants';
import { isDateWithinRange } from '../../utils/financeUtils';
import { getZeitkatLabel, validateFeeStaircase } from '../../utils/feeStaircaseValidation';

const SLIDER_HEIGHT = 166;
const ZEITKAT_SLIDER_ZONES = ZEITKAT_CATALOG;
const STMAS_FEE_STAFFELUNG_URL = 'https://www.stmas.bayern.de/imperia/md/content/stmas/stmas_inet/service-kinder/newsletter/31_newsletter_eb-staffelung.pdf';

function makePeriodKey(entry) {
  return `${entry?.validFrom || ''}|${entry?.validUntil || ''}`;
}

function toDate(value) {
  if (!value) return null;
  const [year, month, day] = String(value).split('-').map(Number);
  return year && month && day ? new Date(year, month - 1, day) : null;
}

function toIsoDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function sortZeitkatEntries(entries) {
  return [...entries].sort((left, right) => (
    ZEITKAT_CATALOG.findIndex((zone) => zone.id === getFeeBandZeitkatId(left))
    - ZEITKAT_CATALOG.findIndex((zone) => zone.id === getFeeBandZeitkatId(right))
  ));
}

function getChartVersion(entries, referenceDate) {
  const versions = new Map();
  entries.forEach((entry) => {
    const key = makePeriodKey(entry);
    if (!versions.has(key)) versions.set(key, []);
    versions.get(key).push(entry);
  });
  const matching = Array.from(versions.entries()).find(([, rows]) =>
    rows.some((entry) => isDateWithinRange(referenceDate, entry.validFrom || '', entry.validUntil || ''))
  );
  if (matching) return matching[0];
  return Array.from(versions.keys()).sort((left, right) => (
    right.split('|')[0].localeCompare(left.split('|')[0])
  ))[0] || '';
}

function getPriceMax(entries, baselineEntries) {
  const maxAmount = [...entries, ...(baselineEntries || [])]
    .reduce((max, entry) => Math.max(max, Number(entry.monthlyAmount) || 0), 0);
  return Math.max(300, Math.ceil((maxAmount * 1.5) / 100) * 100);
}

function PriceField({ value, label, onChange, testId, disabled = false }) {
  const [draft, setDraft] = React.useState(value ?? 0);
  React.useEffect(() => setDraft(value ?? 0), [value]);
  return (
    <NumberInput
      size="xs"
      min={0}
      max={100000}
      decimalScale={2}
      step={5}
      disabled={disabled}
      value={draft}
      onChange={setDraft}
      onBlur={() => {
        if (draft === '' || Number.isFinite(Number(draft))) onChange(draft === '' ? 0 : Number(draft));
      }}
      suffix=" EUR"
      aria-label={label}
      data-testid={testId}
    />
  );
}

function OriginalMarker({ amount, maxAmount }) {
  if (amount == null) return null;
  const percent = 100 - (Math.max(0, Math.min(maxAmount, Number(amount) || 0)) / maxAmount) * 100;
  return (
    <Box
      aria-hidden="true"
      style={{
        position: 'absolute',
        zIndex: 3,
        top: `${percent}%`,
        left: 'calc(50% - 20px)',
        width: 40,
        borderTop: '2px dashed var(--mantine-color-gray-7)',
        opacity: 0.65,
        pointerEvents: 'none',
      }}
    />
  );
}

function ContributionSlider({ zone, entry, originalEntry, priceMax, simulation, disabled, onChange }) {
  const amount = Number(entry?.monthlyAmount) || 0;
  return (
    <Stack gap={4} align="center" style={{ flex: '1 0 106px', minWidth: 106, padding: '0 6px' }}>
      <Text size="xs" fw={700} ta="center" lh={1.2}>{zone.kurzbez}h</Text>
      <Text size="10px" c="dimmed" ta="center" lh={1.1}>Kategorie {zone.kennz}</Text>
      <Box style={{ position: 'relative', height: SLIDER_HEIGHT, width: 46, display: 'flex', justifyContent: 'center' }}>
        <OriginalMarker amount={simulation ? originalEntry?.monthlyAmount : null} maxAmount={priceMax} />
        <Slider
          orientation="vertical"
          disabled={disabled}
          min={0}
          max={priceMax}
          step={5}
          value={Math.max(0, Math.min(priceMax, amount))}
          onChange={onChange}
          aria-label={`${simulation ? 'Simulierter Beitrag' : 'Beitrag'} ZEITKAT ${zone.id}`}
          thumbLabel={`Beitrag ZEITKAT ${zone.id}`}
          data-testid={`fee-staircase-slider-${zone.id}`}
          style={{ height: SLIDER_HEIGHT, width: 34, zIndex: 1 }}
        />
      </Box>
      <PriceField
        value={amount}
        label={`Betrag ZEITKAT ${zone.id}`}
        onChange={onChange}
        testId={`fee-staircase-price-${zone.id}`}
        disabled={disabled}
      />
      {simulation ? (
        <Text size="10px" c="dimmed" ta="center">
          Original {originalEntry ? `${Number(originalEntry.monthlyAmount || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : '–'}
        </Text>
      ) : null}
    </Stack>
  );
}

export default function FeeStaircaseEditor({
  entries = [],
  originalEntries,
  referenceDate = new Date().toISOString().slice(0, 10),
  simulation = false,
  onChangeEntries,
  onResetAll,
}) {
  const categoryEntries = entries.filter((entry) => Boolean(getFeeBandZeitkatId(entry)));
  const [selectedPeriodKey, setSelectedPeriodKey] = React.useState(null);
  const periodEntries = React.useMemo(() => {
    const grouped = new Map();
    categoryEntries.forEach((entry) => {
      const key = makePeriodKey(entry);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(entry);
    });
    return grouped;
  }, [categoryEntries]);
  const periodOptions = Array.from(periodEntries.keys()).sort((left, right) => (
    right.split('|')[0].localeCompare(left.split('|')[0])
  )).map((key) => {
    const [start, end] = key.split('|');
    return { value: key, label: `${start || 'Sofort'}${end ? ` – ${end}` : ' – unbegrenzt'}` };
  });
  const validSelectedPeriod = periodOptions.some((option) => option.value === selectedPeriodKey);
  const periodKey = validSelectedPeriod ? selectedPeriodKey : getChartVersion(categoryEntries, referenceDate);
  const activeEntries = sortZeitkatEntries(periodEntries.get(periodKey) || []);
  const activeByZone = new Map(activeEntries.map((entry) => [getFeeBandZeitkatId(entry), entry]));
  const originalEntriesForPeriod = sortZeitkatEntries((originalEntries || []).filter((entry) => (
    getFeeBandZeitkatId(entry) && makePeriodKey(entry) === periodKey
  )));
  const originalByZone = new Map(originalEntriesForPeriod.map((entry) => [getFeeBandZeitkatId(entry), entry]));
  const periodStart = activeEntries[0]?.validFrom || '';
  const periodEnd = activeEntries[0]?.validUntil || '';
  const priceMax = getPriceMax(activeEntries, originalEntriesForPeriod);
  const enabledZones = activeEntries
    .filter((entry) => entry.enabled !== false)
    .map((entry) => getFeeBandZeitkatId(entry));
  const feeStaircaseValidation = validateFeeStaircase(activeEntries);

  function replaceActiveEntries(nextActiveEntries) {
    const preserved = entries.filter((entry) => (
      !getFeeBandZeitkatId(entry) || makePeriodKey(entry) !== periodKey
    ));
    onChangeEntries?.([...preserved, ...nextActiveEntries]);
  }

  function updateZeitkatAmount(zone, amount) {
    const existing = activeByZone.get(zone.id);
    if (!existing) return;
    replaceActiveEntries(sortZeitkatEntries(activeEntries.map((entry) => (
      getFeeBandZeitkatId(entry) === zone.id ? { ...entry, monthlyAmount: amount } : entry
    ))));
  }

  function updateEnabledZones(selectedZoneIds) {
    const selected = new Set(selectedZoneIds);
    const nextEntries = activeEntries.map((entry) => ({
      ...entry,
      enabled: selected.has(getFeeBandZeitkatId(entry)),
    }));
    const existingZoneIds = new Set(activeEntries.map((entry) => getFeeBandZeitkatId(entry)));

    ZEITKAT_SLIDER_ZONES.forEach((zone) => {
      if (!selected.has(zone.id) || existingZoneIds.has(zone.id)) return;
      const zoneIndex = ZEITKAT_SLIDER_ZONES.findIndex((candidate) => candidate.id === zone.id);
      const priorEntry = [...activeEntries].reverse().find((entry) => (
        ZEITKAT_SLIDER_ZONES.findIndex((candidate) => candidate.id === getFeeBandZeitkatId(entry)) < zoneIndex
      )) || activeEntries[0] || {};
      nextEntries.push({
        ...priorEntry,
        validFrom: priorEntry.validFrom || periodStart,
        validUntil: priorEntry.validUntil || periodEnd,
        id: createId('fee'),
        zeitkatId: zone.id,
        label: '',
        monthlyAmount: Number(priorEntry.monthlyAmount) || 0,
        enabled: true,
      });
    });

    replaceActiveEntries(sortZeitkatEntries(nextEntries));
  }

  function updateValidity(field, value) {
    const validFrom = field === 'validFrom' ? value : periodStart;
    const validUntil = field === 'validUntil' ? value : periodEnd;
    const nextKey = `${validFrom || ''}|${validUntil || ''}`;
    replaceActiveEntries(activeEntries.map((entry) => ({ ...entry, [field]: value })));
    setSelectedPeriodKey(nextKey);
  }

  return (
    <Stack gap="sm" data-testid="fee-staircase-editor">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <Text size="sm" fw={600}>ZEITKAT / Stunden pro Tag · Slider</Text>
        <Group gap="xs">
          <Checkbox.Group
            label="Slider je Kategorie aktivieren"
            value={enabledZones}
            onChange={updateEnabledZones}
            data-testid="zeitkat-slider-toggles"
          >
            <Group gap="sm" wrap="wrap">
              {ZEITKAT_SLIDER_ZONES.map((zone) => (
                <Checkbox
                  key={zone.id}
                  value={zone.id}
                  label={`ZEITKAT ${zone.id}`}
                  size="xs"
                  data-testid={`zeitkat-slider-toggle-${zone.id}`}
                />
              ))}
            </Group>
          </Checkbox.Group>
          {simulation && onResetAll ? <Button size="xs" variant="subtle" onClick={onResetAll}>Gruppe zurücksetzen</Button> : null}
        </Group>
      </Group>

      {periodOptions.length > 1 ? (
        <Select
          label="Gültigkeitsversion"
          value={periodKey || null}
          onChange={(value) => setSelectedPeriodKey(value)}
          data={periodOptions}
          w={260}
          data-testid="fee-staircase-period"
        />
      ) : null}

      <Group align="flex-end" wrap="wrap">
        <DatePickerInput
          label="Tarif gültig von"
          value={toDate(periodStart)}
          onChange={(value) => updateValidity('validFrom', toIsoDate(value))}
          valueFormat="DD.MM.YYYY"
          clearable
          size="xs"
          w={190}
          aria-label="Tarif gültig von"
        />
        <DatePickerInput
          label="Tarif gültig bis"
          value={toDate(periodEnd)}
          onChange={(value) => updateValidity('validUntil', toIsoDate(value))}
          valueFormat="DD.MM.YYYY"
          clearable
          size="xs"
          w={190}
          aria-label="Tarif gültig bis"
        />
        <Text size="xs" c="dimmed">Der Monatsbetrag lässt sich am Slider oder im Zahlenfeld direkt darunter ändern.</Text>
      </Group>

      <Box style={{ overflowX: 'auto', border: '1px solid var(--mantine-color-gray-3)', borderRadius: 8, padding: 10 }}>
        <Box data-testid="fee-staircase-zeitkat" style={{ display: 'flex', gap: 6, minWidth: `${ZEITKAT_SLIDER_ZONES.length * 112}px`, alignItems: 'stretch' }}>
          {ZEITKAT_SLIDER_ZONES.map((zone) => (
            <ContributionSlider
              key={zone.id}
              zone={zone}
              entry={activeByZone.get(zone.id)}
              originalEntry={originalByZone.get(zone.id)}
              priceMax={priceMax}
              simulation={simulation}
              disabled={!activeByZone.has(zone.id) || activeByZone.get(zone.id)?.enabled === false}
              onChange={(value) => updateZeitkatAmount(zone, Number(value) || 0)}
            />
          ))}
        </Box>
      </Box>

      {!feeStaircaseValidation.isCompliant ? (
        <Alert
          color="yellow"
          variant="light"
          title="Beitragsstaffelung prüfen"
          data-testid="fee-staircase-compliance-warning"
        >
          <Stack gap="xs">
            <Text size="sm">
              Laut <Anchor href={STMAS_FEE_STAFFELUNG_URL} target="_blank" rel="noreferrer">STMAS-Newsletter 31</Anchor> braucht jede Buchungszeitkategorie einen eigenen Beitrag. Der Abstand zwischen benachbarten Kategorien muss mindestens 5 € und mindestens 10 % des Beitrags für mehr als 3 bis einschließlich 4 Stunden betragen.
            </Text>
            {feeStaircaseValidation.missingZones.length > 0 ? (
              <Text size="sm">
                Fehlende oder deaktivierte Kategorien: {feeStaircaseValidation.missingZones.map(getZeitkatLabel).join(', ')}.
              </Text>
            ) : null}
            {feeStaircaseValidation.referenceAmount == null ? (
              <Text size="sm">Kategorie 3 (mehr als 3 bis einschließlich 4 Stunden) fehlt; deshalb ist die 10%-Schwelle noch nicht bestimmbar.</Text>
            ) : null}
            {feeStaircaseValidation.stepViolations.map((violation) => (
              <Text size="sm" key={`${violation.previousZone.id}-${violation.zone.id}`}>
                {getZeitkatLabel(violation.previousZone)} → {getZeitkatLabel(violation.zone)}: {violation.currentAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €; mindestens {violation.requiredAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € erforderlich.
              </Text>
            ))}
          </Stack>
        </Alert>
      ) : null}
      {enabledZones.length === 0 ? (
        <Alert color="yellow" variant="light" py="xs">Keine ZEITKAT aktiviert. Wähle oben mindestens eine Kategorie aus, um ihren Beitrag zu pflegen und zu berechnen.</Alert>
      ) : null}
    </Stack>
  );
}
