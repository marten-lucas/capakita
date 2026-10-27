import React from 'react';
import { Alert, Box, Button, Group, NumberInput, Paper, Select, Slider, Stack, Text } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconPlus } from '@tabler/icons-react';
import { createId } from '../../utils/idUtils';
import { getFeeBandZeitkatId, ZEITKAT_CATALOG } from '../../utils/adebisConstants';
import { isDateWithinRange } from '../../utils/financeUtils';

const MAX_ZEITKAT_HOURS = 8;
const SLIDER_HEIGHT = 166;
const ZEITKAT_SLIDER_ZONES = ZEITKAT_CATALOG.filter((zone) => zone.maxHours <= MAX_ZEITKAT_HOURS);

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

function PriceField({ value, label, onChange, testId }) {
  const [draft, setDraft] = React.useState(value ?? 0);
  React.useEffect(() => setDraft(value ?? 0), [value]);
  return (
    <NumberInput
      size="xs"
      min={0}
      max={100000}
      decimalScale={2}
      step={5}
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

function ContributionSlider({ zone, entry, originalEntry, priceMax, simulation, onChange }) {
  const amount = Number(entry?.monthlyAmount) || 0;
  return (
    <Stack gap={4} align="center" style={{ flex: '1 0 106px', minWidth: 106, padding: '0 6px' }}>
      <Text size="xs" fw={700} ta="center" lh={1.2}>ZEITKAT {zone.id}</Text>
      <Text size="10px" c="dimmed" ta="center" lh={1.1}>{zone.kurzbez} h/Tag</Text>
      <Box style={{ position: 'relative', height: SLIDER_HEIGHT, width: 46, display: 'flex', justifyContent: 'center' }}>
        <OriginalMarker amount={simulation ? originalEntry?.monthlyAmount : null} maxAmount={priceMax} />
        <Slider
          orientation="vertical"
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
  const missingZones = ZEITKAT_SLIDER_ZONES.filter((zone) => !activeByZone.has(zone.id));
  const overEightEntries = sortZeitkatEntries(activeEntries.filter((entry) => {
    const zone = ZEITKAT_CATALOG.find((item) => item.id === getFeeBandZeitkatId(entry));
    return zone?.maxHours > MAX_ZEITKAT_HOURS;
  }));

  function replaceActiveEntries(nextActiveEntries) {
    const preserved = entries.filter((entry) => (
      !getFeeBandZeitkatId(entry) || makePeriodKey(entry) !== periodKey
    ));
    onChangeEntries?.([...preserved, ...nextActiveEntries]);
  }

  function updateZeitkatAmount(zone, amount) {
    const existing = activeByZone.get(zone.id);
    if (existing) {
      replaceActiveEntries(activeEntries.map((entry) => (
        entry.id === existing.id ? { ...entry, monthlyAmount: amount } : entry
      )));
      return;
    }
    const inheritedDate = activeEntries[0] || {};
    replaceActiveEntries(sortZeitkatEntries([
      ...activeEntries,
      { ...inheritedDate, id: createId('fee'), zeitkatId: zone.id, label: '', monthlyAmount: amount },
    ]));
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
        <Text size="sm" fw={600}>ZEITKAT / Stunden pro Tag · Sliderbereich bis 8 Stunden</Text>
        <Group gap="xs">
          <Select
            size="xs"
            placeholder="ZEITKAT ergänzen"
            data={ZEITKAT_SLIDER_ZONES.filter((zone) => !activeByZone.has(zone.id)).map((zone) => ({ value: zone.id, label: `ZEITKAT ${zone.id} · ${zone.kurzbez} h/Tag` }))}
            value={null}
            onChange={(value) => {
              const zone = ZEITKAT_SLIDER_ZONES.find((item) => item.id === value);
              if (zone) updateZeitkatAmount(zone, Number(activeEntries.at(-1)?.monthlyAmount) || 0);
            }}
            data-testid="add-zeitkat-tier"
          />
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
              onChange={(value) => updateZeitkatAmount(zone, Number(value) || 0)}
            />
          ))}
        </Box>
      </Box>

      {missingZones.length > 0 ? (
        <Alert color="yellow" variant="light" py="xs">{missingZones.length} ZEITKAT-Sätze bis einschließlich 8 Stunden fehlen. Die Sliderpositionen bleiben sichtbar und lassen sich direkt befüllen.</Alert>
      ) : null}

      {simulation && overEightEntries.length > 0 ? (
        <Text size="xs" c="dimmed">ZEITKAT über 8 Stunden bleiben in dieser Simulation auf dem Originalwert; der Sliderbereich endet bei 8 Stunden.</Text>
      ) : null}

      {!simulation && overEightEntries.length > 0 ? (
        <Paper withBorder p="xs" radius="sm">
          <Text size="xs" fw={600} mb="xs">Weitere vorhandene ZEITKAT über 8 Stunden</Text>
          <Stack gap="xs">
            {overEightEntries.map((entry) => {
              const zone = ZEITKAT_CATALOG.find((item) => item.id === getFeeBandZeitkatId(entry));
              return (
                <Group key={entry.id} justify="space-between" wrap="wrap">
                  <Text size="sm">ZEITKAT {zone.id} · {zone.kurzbez} h/Tag</Text>
                  <PriceField
                    value={entry.monthlyAmount}
                    label={`Betrag ZEITKAT ${zone.id}`}
                    onChange={(value) => replaceActiveEntries(activeEntries.map((current) => (
                      current.id === entry.id ? { ...current, monthlyAmount: value } : current
                    )))}
                    testId={`fee-staircase-price-${entry.id}`}
                  />
                </Group>
              );
            })}
          </Stack>
        </Paper>
      ) : null}
    </Stack>
  );
}
