import React from 'react';
import { Alert, Anchor, Box, Button, Checkbox, Group, NumberInput, Select, Slider, Stack, Text } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { createId } from '../../utils/idUtils';
import { getFeeBandZeitkatId, ZEITKAT_CATALOG } from '../../utils/adebisConstants';
import { isDateWithinRange } from '../../utils/financeUtils';
import { getZeitkatLabel, validateFeeStaircase } from '../../utils/feeStaircaseValidation';
import './FeeStaircaseEditor.css';

const SLIDER_HEIGHT = 122;
const AMOUNT_STEP = 5;
const MAX_AMOUNT = 100000;
const formatAmount = (amount) => `${amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const roundAmount = (amount) => Math.round((amount + Number.EPSILON) * 100) / 100;
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

function PriceField({ value, label, onChange, onFocus, testId, step, disabled = false }) {
  const [draft, setDraft] = React.useState(value ?? 0);
  React.useEffect(() => setDraft(value ?? 0), [value]);
  function adjustAmount(delta) {
    const base = draft === '' || !Number.isFinite(Number(draft)) ? Number(value) || 0 : Number(draft);
    const next = roundAmount(Math.max(0, Math.min(MAX_AMOUNT, base + delta)));
    setDraft(next);
    onFocus();
    onChange(next);
  }

  return (
    <div className="fee-staircase-price-controls">
      <button type="button" aria-label={`${label} um ${step} € senken`} title={`−${step} €`} disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => adjustAmount(-step)}>−</button>
      <NumberInput
        size="xs"
        w="100%"
        min={0}
        max={MAX_AMOUNT}
        decimalScale={2}
        step={step}
        hideControls
        disabled={disabled}
        value={draft}
        onChange={setDraft}
        onFocus={onFocus}
        onBlur={() => {
          if (draft === '' || Number.isFinite(Number(draft))) onChange(draft === '' ? 0 : Number(draft));
        }}
        suffix=" €"
        aria-label={label}
        data-testid={testId}
      />
      <button type="button" aria-label={`${label} um ${step} € erhöhen`} title={`+${step} €`} disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => adjustAmount(step)}>+</button>
    </div>
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

function ContributionSlider({ zone, entry, originalEntry, priceMax, simulation, invalid, focused, step, onChange, onActivate, onDeactivate, onFocus }) {
  const isActive = Boolean(entry && entry.enabled !== false && Number(entry.monthlyAmount) > 0);
  const amount = Number(entry?.monthlyAmount) || Number(entry?.lastNonZeroAmount) || 0;
  const sliderHeight = simulation ? 120 : SLIDER_HEIGHT;
  return (
    <Stack
      gap={3}
      align="center"
      className="fee-staircase-zone"
      data-focused={focused ? 'true' : undefined}
      data-disabled={!isActive ? 'true' : undefined}
      data-testid={`fee-staircase-zone-${zone.id}`}
    >
      <Checkbox
        size="xs"
        color={invalid ? 'red' : undefined}
        className="fee-staircase-activation"
        checked={isActive}
        aria-label={`${isActive ? 'Deaktiviere' : 'Aktiviere'} Beitrag ZEITKAT ${zone.id}`}
        title={`ZEITKAT ${zone.id} ${isActive ? 'deaktivieren' : 'aktivieren'}`}
        data-testid={`${isActive ? 'deactivate' : 'activate'}-fee-zeitkat-${zone.id}`}
        data-invalid={invalid ? 'true' : undefined}
        onFocus={onFocus}
        onChange={() => (isActive ? onDeactivate() : onActivate())}
      />
      <Text
        size="xs"
        fw={700}
        c={invalid ? 'red' : undefined}
        ta="center"
        lh={1.1}
        className="fee-staircase-zone-label-compact"
        title={zone.bez}
        aria-label={`${zone.kurzbez} Stunden, Kategorie ${zone.kennz}: ${zone.bez}`}
      >
        {zone.kurzbez.includes('-') ? `${zone.kurzbez.split('-')[1]}h` : `${zone.kurzbez}h`}
      </Text>
      <Text size="xs" fw={700} c={invalid ? 'red' : undefined} ta="center" lh={1.1} className="fee-staircase-zone-label-full">
        {zone.kurzbez}h
      </Text>
      <Text size="10px" c={invalid ? 'red' : 'dimmed'} ta="center" lh={1.1} className="fee-staircase-zone-category" title={zone.bez}>
        Kat. {zone.kennz}
      </Text>
      <>
        <Box className="fee-staircase-slider-track" style={{ position: 'relative', height: sliderHeight, width: 38, display: 'flex', justifyContent: 'center' }}>
          <OriginalMarker amount={simulation ? originalEntry?.monthlyAmount : null} maxAmount={priceMax} />
          <Slider
            orientation="vertical"
            color={invalid ? 'red' : undefined}
            min={0}
            max={priceMax}
            step={5}
            value={Math.max(0, Math.min(priceMax, amount))}
            onChange={onChange}
            onFocus={onFocus}
            disabled={!isActive}
            aria-label={`${simulation ? 'Simulierter Beitrag' : 'Beitrag'} ZEITKAT ${zone.id}`}
            thumbLabel={`Beitrag ZEITKAT ${zone.id}`}
            data-testid={`fee-staircase-slider-${zone.id}`}
            data-invalid={invalid ? 'true' : undefined}
            style={{ height: sliderHeight, width: 30, zIndex: 1 }}
          />
        </Box>
        <Box className="fee-staircase-price-field">
          <PriceField
            value={amount}
            step={step}
            label={`Betrag ZEITKAT ${zone.id}`}
            onChange={onChange}
            onFocus={onFocus}
            disabled={!isActive}
            testId={`fee-staircase-price-${zone.id}`}
          />
        </Box>
        <Text
          size="10px"
          c="dimmed"
          ta="center"
          lh={1.3}
          className={simulation ? 'fee-staircase-amount' : 'fee-staircase-hourly'}
          data-testid={`${simulation ? 'fee-staircase-amount' : 'fee-staircase-hourly'}-${zone.id}`}
          title={simulation ? 'Monatlicher Beitragsbetrag' : `Monatsbeitrag geteilt durch ${zone.maxHours} Stunden pro Tag (oberes Ende der Kategorie)`}
        >
          {simulation
            ? `${amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
            : `${(amount / zone.maxHours).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/h`}
        </Text>
        {simulation ? (
          <>
            <Text
              size="10px"
              c="dimmed"
              ta="center"
              className="fee-staircase-hourly-equivalent"
              data-testid={`fee-staircase-hourly-equivalent-${zone.id}`}
              title={`Monatsbeitrag geteilt durch die Obergrenze der Kategorie: ${zone.maxHours} Stunden pro Tag.`}
            >
              {(amount / zone.maxHours).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/h
            </Text>
            <Text size="10px" c="dimmed" ta="center" className="fee-staircase-original" data-testid={`fee-staircase-original-${zone.id}`}>
              Original {originalEntry
                ? `${Number(originalEntry.monthlyAmount || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € · ${(Number(originalEntry.monthlyAmount || 0) / zone.maxHours).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/h`
                : '–'}
            </Text>
          </>
        ) : null}
      </>
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
  const [validityDraft, setValidityDraft] = React.useState(null);
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
  const feeStaircaseValidation = validateFeeStaircase(activeEntries);
  const invalidZeitkatIds = new Set([
    ...feeStaircaseValidation.gaps.map((zone) => zone.id),
    ...feeStaircaseValidation.stepViolations.flatMap(({ previousZone, zone }) => [previousZone.id, zone.id]),
  ]);
  const [focusedZeitkatId, setFocusedZeitkatId] = React.useState(null);
  const [amountStep, setAmountStep] = React.useState(AMOUNT_STEP);
  const [bulkMode, setBulkMode] = React.useState('amount');
  const [bulkValue, setBulkValue] = React.useState('');
  const [staircaseStart, setStaircaseStart] = React.useState('');
  const [undo, setUndo] = React.useState(null);
  const editableEntries = activeEntries.filter((entry) => entry.enabled !== false && Number(entry.monthlyAmount) > 0);
  const bulkNumber = bulkValue === '' ? NaN : Number(bulkValue);
  const firstZoneIndex = ZEITKAT_SLIDER_ZONES.findIndex((zone) => zone.id === getFeeBandZeitkatId(editableEntries[0]));
  const firstAmount = staircaseStart === '' ? Number(editableEntries[0]?.monthlyAmount) || 0 : Number(staircaseStart);
  const previewEntries = Number.isFinite(bulkNumber) ? editableEntries.map((entry) => {
    const amount = Number(entry.monthlyAmount);
    const zoneIndex = ZEITKAT_SLIDER_ZONES.findIndex((zone) => zone.id === getFeeBandZeitkatId(entry));
    const result = bulkMode === 'amount' ? amount + bulkNumber
      : bulkMode === 'percent' ? amount * (1 + bulkNumber / 100)
        : firstAmount + (zoneIndex - firstZoneIndex) * bulkNumber;
    return { entry, amount: roundAmount(result) };
  }) : [];
  const previewValid = previewEntries.length > 0 && previewEntries.every(({ amount }) => (
    Number.isFinite(amount) && amount > 0 && amount <= MAX_AMOUNT
  ));
  const previewByEntry = new Map(previewEntries.map(({ entry, amount }) => [entry, amount]));
  const previewActiveEntries = activeEntries.map((entry) => previewByEntry.has(entry)
    ? { ...entry, monthlyAmount: previewByEntry.get(entry) } : entry);
  const previewValidation = previewValid ? validateFeeStaircase(previewActiveEntries) : null;
  const canUndo = undo && undo.periodKey === periodKey && JSON.stringify(activeEntries) === undo.after;

  function applyBulkChange() {
    if (!previewValid) return;
    setUndo({ periodKey, before: activeEntries, after: JSON.stringify(previewActiveEntries) });
    replaceActiveEntries(previewActiveEntries);
    setBulkValue('');
    setStaircaseStart('');
  }

  function undoBulkChange() {
    if (!canUndo) return;
    replaceActiveEntries(undo.before);
    setUndo(null);
  }

  function replaceActiveEntries(nextActiveEntries) {
    const preserved = entries.filter((entry) => (
      !getFeeBandZeitkatId(entry) || makePeriodKey(entry) !== periodKey
    ));
    onChangeEntries?.([...preserved, ...nextActiveEntries]);
  }

  function updateZeitkatAmount(zone, amount) {
    const existing = activeByZone.get(zone.id);
    if (!existing) return;
    const nextAmount = Math.max(0, Number(amount) || 0);
    if (nextAmount === Number(existing.monthlyAmount)) return;
    setUndo(null);
    replaceActiveEntries(sortZeitkatEntries(activeEntries.map((entry) => {
      if (getFeeBandZeitkatId(entry) !== zone.id) return entry;
      const previousAmount = Number(entry.monthlyAmount) || 0;
      return {
        ...entry,
        monthlyAmount: nextAmount,
        enabled: nextAmount > 0,
        ...(nextAmount === 0 && previousAmount > 0 ? { lastNonZeroAmount: previousAmount } : {}),
      };
    })));
  }

  function getActivationAmount(zone, existing) {
    const rememberedAmount = Number(existing?.lastNonZeroAmount) || Number(existing?.monthlyAmount) || 0;
    if (rememberedAmount > 0) return rememberedAmount;

    const zoneIndex = ZEITKAT_SLIDER_ZONES.findIndex((candidate) => candidate.id === zone.id);
    const activeEntriesByPrice = activeEntries.filter((entry) => (
      entry.enabled !== false && Number(entry.monthlyAmount) > 0
    ));
    const previousEntry = [...activeEntriesByPrice].reverse().find((entry) => (
      ZEITKAT_SLIDER_ZONES.findIndex((candidate) => candidate.id === getFeeBandZeitkatId(entry)) < zoneIndex
    ));
    const nextEntry = activeEntriesByPrice.find((entry) => (
      ZEITKAT_SLIDER_ZONES.findIndex((candidate) => candidate.id === getFeeBandZeitkatId(entry)) > zoneIndex
    ));
    const referenceAmount = Number(activeByZone.get('04')?.monthlyAmount) || 0;
    const minimumDifference = Math.max(5, referenceAmount * 0.1);

    if (zone.id === '04' && previousEntry) {
      const previousAmount = Number(previousEntry.monthlyAmount) || 0;
      return Math.ceil(Math.max(previousAmount + 5, previousAmount / 0.9) * 100) / 100;
    }
    if (zone.id === '04' && nextEntry) {
      const nextAmount = Number(nextEntry.monthlyAmount) || 0;
      return Math.max(0.01, Math.floor(Math.min(nextAmount - 5, nextAmount / 1.1) * 100) / 100);
    }
    if (previousEntry) return Math.round((Number(previousEntry.monthlyAmount) + minimumDifference) * 100) / 100;
    if (nextEntry) return Math.max(0.01, Math.round((Number(nextEntry.monthlyAmount) - minimumDifference) * 100) / 100);
    return 5;
  }

  function deactivateZeitkat(zone) {
    setUndo(null);
    const existing = activeByZone.get(zone.id);
    if (!existing) return;
    const amount = Number(existing.monthlyAmount) || Number(existing.lastNonZeroAmount) || 0;
    replaceActiveEntries(activeEntries.map((entry) => (
      getFeeBandZeitkatId(entry) === zone.id
        ? { ...entry, monthlyAmount: amount, enabled: false, lastNonZeroAmount: amount || entry.lastNonZeroAmount }
        : entry
    )));
  }

  function activateZeitkat(zone) {
    setUndo(null);
    const existing = activeByZone.get(zone.id);
    const monthlyAmount = getActivationAmount(zone, existing);
    if (existing) {
      replaceActiveEntries(sortZeitkatEntries(activeEntries.map((entry) => (
        getFeeBandZeitkatId(entry) === zone.id
          ? { ...entry, monthlyAmount, enabled: true }
          : entry
      ))));
      return;
    }

    replaceActiveEntries(sortZeitkatEntries([
      ...activeEntries,
      {
        id: createId('fee'),
        zeitkatId: zone.id,
        label: '',
        validFrom: periodStart,
        validUntil: periodEnd,
        monthlyAmount,
        enabled: true,
      },
    ]));
  }

  const currentDraft = validityDraft?.periodKey === periodKey ? validityDraft : null;

  function updateValidity(field, value) {
    const validFrom = field === 'validFrom' ? value : (currentDraft?.validFrom ?? periodStart);
    const validUntil = field === 'validUntil' ? value : (currentDraft?.validUntil ?? periodEnd);
    const nextKey = `${validFrom || ''}|${validUntil || ''}`;
    const activeZones = new Set(activeEntries.map((entry) => getFeeBandZeitkatId(entry)));
    const conflicts = nextKey === periodKey ? [] : (periodEntries.get(nextKey) || [])
      .map((entry) => getFeeBandZeitkatId(entry))
      .filter((zoneId) => activeZones.has(zoneId));
    const error = conflicts.length
      ? `Für ZEITKAT ${[...new Set(conflicts)].join(', ')} besteht bereits ein Tarif mit dieser Gültigkeit. Bitte ändern Sie den Zeitraum.`
      : validFrom && validUntil && validFrom > validUntil
        ? 'Das Anfangsdatum darf nicht nach dem Enddatum liegen.'
        : '';
    if (error) {
      setValidityDraft({ periodKey, validFrom, validUntil, error });
      return;
    }
    setValidityDraft(null);
    if (nextKey === periodKey) return;
    setUndo(null);
    replaceActiveEntries(activeEntries.map((entry) => ({ ...entry, validFrom, validUntil })));
    setSelectedPeriodKey(nextKey);
  }

  return (
    <Stack gap="sm" data-testid="fee-staircase-editor">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <Text size="sm" fw={600}>ZEITKAT / Stunden pro Tag · Slider</Text>
        {simulation && onResetAll ? <Button size="xs" variant="subtle" onClick={() => { setUndo(null); onResetAll(); }}>Gruppe zurücksetzen</Button> : null}
      </Group>

      {periodOptions.length > 1 ? (
        <Select
          label="Gültigkeitsversion"
          value={periodKey || null}
          onChange={(value) => { setUndo(null); setValidityDraft(null); setSelectedPeriodKey(value); }}
          data={periodOptions}
          w={260}
          data-testid="fee-staircase-period"
        />
      ) : null}

      {!simulation ? (
        <Group align="flex-end" wrap="wrap">
          <DatePickerInput
            label="Tarif gültig von"
            value={toDate(currentDraft?.validFrom ?? periodStart)}
            onChange={(value) => updateValidity('validFrom', toIsoDate(value))}
            valueFormat="DD.MM.YYYY"
            clearable
            size="xs"
            w={190}
            aria-label="Tarif gültig von"
          />
          <DatePickerInput
            label="Tarif gültig bis"
            value={toDate(currentDraft?.validUntil ?? periodEnd)}
            onChange={(value) => updateValidity('validUntil', toIsoDate(value))}
            valueFormat="DD.MM.YYYY"
            clearable
            size="xs"
            w={190}
            aria-label="Tarif gültig bis"
          />
          <Text size="xs" c="dimmed">Beiträge per Slider, Zahlenfeld oder ± ändern. Inaktive Kategorien lassen sich per Checkbox aktivieren.</Text>
        </Group>
      ) : null}
      {!simulation && currentDraft?.error ? <Alert color="red" role="alert">{currentDraft.error}</Alert> : null}

      <Select
        label="Schrittweite für ±"
        value={String(amountStep)}
        onChange={(value) => { if (value) setAmountStep(Number(value)); }}
        data={[1, 5, 10, 25, 50].map((step) => ({ value: String(step), label: `${step} €` }))}
        allowDeselect={false}
        size="xs"
        className="fee-staircase-step"
      />

      <Box className="fee-staircase-bulk">
        <Text size="sm" fw={600}>Sammeländerung für diese Gruppe</Text>
        <Text size="xs" c="dimmed">Nur aktive Kategorien der gewählten Gültigkeitsversion; andere Versionen und inaktive Kategorien bleiben unverändert.</Text>
        <Group align="flex-end" gap="xs" wrap="wrap">
          <Select
            label="Art der Sammeländerung"
            value={bulkMode}
            onChange={(value) => { if (value) setBulkMode(value); }}
            data={[
              { value: 'amount', label: 'Betrag addieren / abziehen (€)' },
              { value: 'percent', label: 'Prozent ändern (%)' },
              { value: 'staircase', label: 'Staffel je Kategorie (€)' },
            ]}
            allowDeselect={false}
            size="xs"
            className="fee-staircase-bulk-mode"
          />
          {bulkMode === 'staircase' ? (
            <NumberInput
              label="Startbetrag in €"
              description="Leer: erster aktiver Beitrag"
              value={staircaseStart}
              onChange={setStaircaseStart}
              min={0}
              max={MAX_AMOUNT}
              decimalScale={2}
              size="xs"
              className="fee-staircase-bulk-value"
            />
          ) : null}
          <NumberInput
            label={bulkMode === 'percent' ? 'Änderung in %' : bulkMode === 'staircase' ? 'Schritt je Kategorie in €' : 'Änderung in €'}
            description={bulkMode === 'staircase' ? 'Auch fehlende Kategorien zählen' : 'Negativ zum Senken'}
            value={bulkValue}
            onChange={setBulkValue}
            decimalScale={2}
            step={bulkMode === 'percent' ? 1 : AMOUNT_STEP}
            size="xs"
            className="fee-staircase-bulk-value"
          />
          <Button size="xs" onClick={applyBulkChange} disabled={!previewValid}>Sammeländerung anwenden</Button>
          <Button size="xs" variant="light" onClick={undoBulkChange} disabled={!canUndo}>Sammeländerung rückgängig</Button>
        </Group>
        {bulkValue !== '' && !previewValid ? <Text size="xs" c="red" role="alert">Alle neuen Beiträge müssen zwischen 0,01 € und 100.000 € liegen; mindestens eine Kategorie muss aktiv sein.</Text> : null}
        {previewValid ? (
          <div className="fee-staircase-preview" role="region" aria-label="Vorschau Sammeländerung">
            <Text size="xs" fw={600}>Vorschau (noch nicht angewendet)</Text>
            {previewEntries.map(({ entry, amount }, index) => (
              <Text size="xs" key={`${getFeeBandZeitkatId(entry)}-${index}`}>
                ZEITKAT {getFeeBandZeitkatId(entry)}: {formatAmount(Number(entry.monthlyAmount))} → {formatAmount(amount)}
              </Text>
            ))}
            {!previewValidation.isCompliant ? <Text size="xs" c="red">Die Vorschau erfüllt die Staffelungsregeln nicht; nach dem Anwenden werden die Einzelheiten angezeigt.</Text> : null}
          </div>
        ) : null}
      </Box>

      <Box className="fee-staircase-slider-scroll" style={{ overflowX: 'auto', border: '1px solid var(--mantine-color-gray-3)', borderRadius: 8, padding: 6 }}>
        <Box className={`fee-staircase-slider-grid${simulation ? ' fee-staircase-slider-grid--simulation' : ''}`} data-testid="fee-staircase-zeitkat">
          {ZEITKAT_SLIDER_ZONES.map((zone) => (
            <ContributionSlider
              key={zone.id}
              zone={zone}
              entry={activeByZone.get(zone.id)}
              originalEntry={originalByZone.get(zone.id)}
              priceMax={priceMax}
              simulation={simulation}
              invalid={invalidZeitkatIds.has(zone.id)}
              focused={focusedZeitkatId === zone.id}
              step={amountStep}
              onChange={(value) => updateZeitkatAmount(zone, Number(value) || 0)}
              onActivate={() => activateZeitkat(zone)}
              onDeactivate={() => deactivateZeitkat(zone)}
              onFocus={() => setFocusedZeitkatId(zone.id)}
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
              Laut <Anchor href={STMAS_FEE_STAFFELUNG_URL} target="_blank" rel="noreferrer">STMAS-Newsletter 31</Anchor> dürfen außerhalb des aktiven Bereichs Kategorien leer bleiben. Zwischen der niedrigsten und höchsten aktivierten Kategorie darf es jedoch keine Lücken geben. Benachbarte Beiträge müssen sich mindestens um 5 € beziehungsweise 10 % des Beitrags für mehr als 3 bis einschließlich 4 Stunden unterscheiden.
            </Text>
            {feeStaircaseValidation.noActiveZones ? (
              <Text size="sm">Aktiviere mindestens eine Kategorie über die Checkbox unter ihrem Slider.</Text>
            ) : null}
            {feeStaircaseValidation.gaps.length > 0 ? (
              <Text size="sm">
                Lücken zwischen {getZeitkatLabel(feeStaircaseValidation.firstActiveZone)} und {getZeitkatLabel(feeStaircaseValidation.lastActiveZone)}: {feeStaircaseValidation.gaps.map(getZeitkatLabel).join(', ')}.
              </Text>
            ) : null}
            {feeStaircaseValidation.stepViolations.map((violation) => (
              <Text size="sm" key={`${violation.previousZone.id}-${violation.zone.id}`}>
                {getZeitkatLabel(violation.previousZone)} → {getZeitkatLabel(violation.zone)}: {violation.currentAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €; mindestens {violation.requiredAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € erforderlich.
              </Text>
            ))}
          </Stack>
        </Alert>
      ) : null}
    </Stack>
  );
}
