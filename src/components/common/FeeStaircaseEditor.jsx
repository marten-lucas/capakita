import React from 'react';
import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Group,
  NumberInput,
  Paper,
  Select,
  Slider,
  Stack,
  Text,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconPlus, IconTrash } from '@tabler/icons-react';
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

function getEntryKind(entry) {
  return getFeeBandZeitkatId(entry) ? 'zeitkat' : 'weekly';
}

function getWeeklyLimit(entry) {
  if (entry?.maxHours === '' || entry?.maxHours == null) return null;
  const value = Number(entry.maxHours);
  return Number.isFinite(value) ? value : null;
}

function sortEntries(entries, kind) {
  return [...entries].sort((left, right) => {
    if (kind === 'zeitkat') {
      return ZEITKAT_CATALOG.findIndex((zone) => zone.id === getFeeBandZeitkatId(left))
        - ZEITKAT_CATALOG.findIndex((zone) => zone.id === getFeeBandZeitkatId(right));
    }
    const leftMax = getWeeklyLimit(left);
    const rightMax = getWeeklyLimit(right);
    if (leftMax == null && rightMax == null) return String(left.id).localeCompare(String(right.id));
    if (leftMax == null) return 1;
    if (rightMax == null) return -1;
    return leftMax - rightMax;
  });
}

function getWeeklySegments(entries, domainMax) {
  let lower = 0;
  return sortEntries(entries, 'weekly').map((entry) => {
    const parsedMax = getWeeklyLimit(entry);
    const openEnded = parsedMax == null;
    const upper = openEnded ? domainMax : Math.max(lower, Math.min(domainMax, parsedMax));
    const segment = { entry, lower, upper, openEnded };
    lower = openEnded ? domainMax : Math.max(lower, parsedMax);
    return segment;
  }).filter((segment) => segment.upper > segment.lower);
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
  return Array.from(versions.keys()).sort((left, right) => {
    const leftStart = left.split('|')[0];
    const rightStart = right.split('|')[0];
    return rightStart.localeCompare(leftStart);
  })[0] || '';
}

function getPriceMax(entries, baselineEntries) {
  const maxAmount = [...entries, ...(baselineEntries || [])]
    .reduce((max, entry) => Math.max(max, Number(entry.monthlyAmount) || 0), 0);
  return Math.max(300, Math.ceil((maxAmount * 1.5) / 100) * 100);
}

function makeEntryLike(entry, changes = {}) {
  return { ...entry, ...changes, id: changes.id || createId('fee') };
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

function StairSlider({ label, detail, value, originalAmount, priceMax, simulation, onChange, testId, width }) {
  return (
    <Stack gap={4} align="center" style={{ flex: width || '1 0 96px', minWidth: 90, padding: '0 6px' }}>
      <Text size="xs" fw={700} ta="center" lh={1.2}>{label}</Text>
      {detail ? <Text size="10px" c="dimmed" ta="center" lh={1.1}>{detail}</Text> : <Box h={12} />}
      <Box style={{ position: 'relative', height: SLIDER_HEIGHT, width: 46, display: 'flex', justifyContent: 'center' }}>
        <OriginalMarker amount={simulation ? originalAmount : null} maxAmount={priceMax} />
        <Slider
          orientation="vertical"
          min={0}
          max={priceMax}
          step={5}
          value={Math.max(0, Math.min(priceMax, Number(value) || 0))}
          onChange={onChange}
          aria-label={`${simulation ? 'Simulierter Beitrag' : 'Beitrag'} ${label}`}
          thumbLabel={`${simulation ? 'Simulierter Beitrag' : 'Beitrag'} ${label}`}
          data-testid={testId}
          style={{ height: SLIDER_HEIGHT, width: 34, zIndex: 1 }}
        />
      </Box>
      <PriceField
        value={value}
        label={`Betrag ${label}`}
        onChange={onChange}
        testId={`${testId}-amount`}
      />
      {simulation ? (
        <Text size="10px" c="dimmed" ta="center">
          Original {originalAmount == null ? '–' : `${Number(originalAmount).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`}
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

  const [kind, setKind] = React.useState(() => entries.some((entry) => getEntryKind(entry) === 'zeitkat') ? 'zeitkat' : 'weekly');
  const [selectedPeriodKey, setSelectedPeriodKey] = React.useState(null);
  const [drawError, setDrawError] = React.useState('');

  const versionEntries = React.useMemo(() => {
    const grouped = new Map();
    entries.filter((entry) => getEntryKind(entry) === kind).forEach((entry) => {
      const key = makePeriodKey(entry);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(entry);
    });
    return grouped;
  }, [entries, kind]);
  const periodOptions = Array.from(versionEntries.keys()).sort((left, right) => {
    const leftStart = left.split('|')[0];
    const rightStart = right.split('|')[0];
    return rightStart.localeCompare(leftStart);
  }).map((key) => {
    const [start, end] = key.split('|');
    return { value: key, label: `${start || 'Sofort'}${end ? ` – ${end}` : ' – unbegrenzt'}` };
  });
  const validSelectedPeriod = periodOptions.some((option) => option.value === selectedPeriodKey);
  const periodKey = validSelectedPeriod ? selectedPeriodKey : getChartVersion(
    entries.filter((entry) => getEntryKind(entry) === kind),
    referenceDate
  );
  const activeEntries = sortEntries(versionEntries.get(periodKey) || [], kind);
  const weeklyLimits = kind === 'weekly' ? activeEntries.map(getWeeklyLimit) : [];
  const finiteWeeklyLimits = weeklyLimits.filter((limit) => limit != null);
  const weeklyStructureInvalid = kind === 'weekly' && weeklyLimits.length > 0 && (
    weeklyLimits.filter((limit) => limit == null).length !== 1
    || finiteWeeklyLimits.some((limit, index) => limit <= 0 || (index > 0 && limit <= finiteWeeklyLimits[index - 1]))
  );
  const missingZeitkatZones = kind === 'zeitkat'
    ? ZEITKAT_SLIDER_ZONES.filter((zone) => !activeEntries.some((entry) => getFeeBandZeitkatId(entry) === zone.id))
    : [];
  const baselineEntriesForPeriod = sortEntries((originalEntries || []).filter((entry) =>
    getEntryKind(entry) === kind && makePeriodKey(entry) === periodKey
  ), kind);
  const periodStart = activeEntries[0]?.validFrom || '';
  const periodEnd = activeEntries[0]?.validUntil || '';
  const priceMax = getPriceMax(activeEntries, baselineEntriesForPeriod);

  function replaceActiveEntries(nextActiveEntries) {
    const preserved = entries.filter((entry) => getEntryKind(entry) !== kind || makePeriodKey(entry) !== periodKey);
    onChangeEntries?.([...preserved, ...nextActiveEntries]);
  }

  function updateEntry(entryId, updates) {
    replaceActiveEntries(activeEntries.map((entry) => (
      String(entry.id) === String(entryId) ? { ...entry, ...updates } : entry
    )));
  }

  function updateZeitkatAmount(zone, amount) {
    const existing = activeEntries.find((entry) => getFeeBandZeitkatId(entry) === zone.id);
    if (existing) {
      updateEntry(existing.id, { monthlyAmount: amount });
      return;
    }
    const inheritedDate = activeEntries[0] || {};
    replaceActiveEntries(sortEntries([
      ...activeEntries,
      makeEntryLike(inheritedDate, { zeitkatId: zone.id, maxHours: zone.maxHours, monthlyAmount: amount }),
    ], 'zeitkat'));
  }

  function updateWeeklyLimit(entryId, value) {
    const nextValue = value === '' || value == null ? '' : Number(value);
    const next = activeEntries.map((entry) => String(entry.id) === String(entryId)
      ? { ...entry, maxHours: nextValue }
      : entry);
    let sorted = sortEntries(next, 'weekly');
    if (sorted.length > 0 && getWeeklyLimit(sorted.at(-1)) != null) {
      const lastEntry = sorted.at(-1);
      sorted = [...sorted, makeEntryLike(lastEntry, {
        maxHours: '',
        monthlyAmount: Number(lastEntry.monthlyAmount) || 0,
        label: 'Offene Staffel',
      })];
    }
    const limits = sorted.map(getWeeklyLimit);
    const finiteLimits = limits.filter((limit) => limit != null);
    const hasOnlyFinalOpenLimit = !limits.some((limit, index) => limit == null && index !== limits.length - 1);
    const valid = hasOnlyFinalOpenLimit
      && finiteLimits.every((limit, index) => limit > 0 && (index === 0 || limit > finiteLimits[index - 1]));
    if (!valid) {
      setDrawError('Obergrenzen müssen eindeutig und aufsteigend sein; die offene Staffel muss am Ende stehen.');
      return;
    }
    setDrawError('');
    replaceActiveEntries(sorted);
  }

  function addNextTier() {
    const nextActive = [...activeEntries];
    const sorted = sortEntries(nextActive, 'weekly');
    const openIndex = sorted.findIndex((entry) => getWeeklyLimit(entry) == null);
    const finiteMax = sorted.reduce((max, entry) => Math.max(max, Number(entry.maxHours) || 0), 0);
    const inheritedDate = sorted[0] || {};
    const newEntry = makeEntryLike(inheritedDate, {
      label: `Staffel ab ${finiteMax} h`,
      maxHours: openIndex >= 0 ? finiteMax + 10 : '',
      monthlyAmount: Number(sorted.at(-1)?.monthlyAmount) || 0,
    });
    if (openIndex >= 0) sorted.splice(openIndex, 0, newEntry);
    else sorted.push(newEntry);
    replaceActiveEntries(sortEntries(sorted, 'weekly'));
    setKind('weekly');
  }

  function addZeitkatZone(zone) {
    if (activeEntries.some((entry) => getFeeBandZeitkatId(entry) === zone.id)) return;
    const inheritedDate = activeEntries[0] || {};
    const newEntry = makeEntryLike(inheritedDate, {
      label: '',
      zeitkatId: zone.id,
      maxHours: zone.maxHours,
      monthlyAmount: Number(activeEntries.at(-1)?.monthlyAmount) || 0,
    });
    replaceActiveEntries(sortEntries([...activeEntries, newEntry], 'zeitkat'));
  }

  function updateValidity(field, value) {
    const validFrom = field === 'validFrom' ? value : periodStart;
    const validUntil = field === 'validUntil' ? value : periodEnd;
    const nextKey = `${validFrom || ''}|${validUntil || ''}`;
    replaceActiveEntries(activeEntries.map((entry) => ({ ...entry, [field]: value })));
    setSelectedPeriodKey(nextKey);
  }

  function removeEntry(entryId) {
    if (kind === 'zeitkat') return;
    let next = activeEntries.filter((entry) => String(entry.id) !== String(entryId));
    if (next.length > 0 && getWeeklyLimit(sortEntries(next, 'weekly').at(-1)) == null) {
      next = sortEntries(next, 'weekly');
    } else if (next.length > 0) {
      const sorted = sortEntries(next, 'weekly');
      sorted[sorted.length - 1] = { ...sorted.at(-1), maxHours: '' };
      next = sorted;
    }
    replaceActiveEntries(sortEntries(next, kind));
  }

  const weeklyDomainMax = Math.max(40, Math.ceil(Math.max(0, ...activeEntries.map((entry) => Number(entry.maxHours) || 0)) / 10) * 10);
  const weeklySegments = getWeeklySegments(activeEntries, weeklyDomainMax);

  const zeitkatMap = new Map(activeEntries.map((entry) => [getFeeBandZeitkatId(entry), entry]));
  const baselineZeitkatMap = new Map(baselineEntriesForPeriod.map((entry) => [getFeeBandZeitkatId(entry), entry]));

  return (
    <Stack gap="sm" data-testid="fee-staircase-editor">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <Group align="flex-end" wrap="wrap">
          <Select
            label="Staffelart"
            value={kind}
            onChange={(value) => value && setKind(value)}
            data={[{ value: 'zeitkat', label: 'ZEITKAT / Stunden pro Tag' }, { value: 'weekly', label: 'Wochenstunden' }]}
            w={230}
            data-testid="fee-staircase-kind"
          />
          {periodOptions.length > 1 ? (
            <Select
              label="Gültigkeitsversion"
              value={periodKey || null}
              onChange={(value) => setSelectedPeriodKey(value)}
              data={periodOptions}
              w={230}
              data-testid="fee-staircase-period"
            />
          ) : null}
        </Group>
        <Group gap="xs">
          {kind === 'weekly' ? (
            <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={addNextTier} data-testid="add-weekly-tier">
              Staffel hinzufügen
            </Button>
          ) : (
            <Select
              size="xs"
              placeholder="ZEITKAT ergänzen"
              data={ZEITKAT_SLIDER_ZONES.filter((zone) => !activeEntries.some((entry) => getFeeBandZeitkatId(entry) === zone.id)).map((zone) => ({ value: zone.id, label: `ZEITKAT ${zone.id} · ${zone.kurzbez} h/Tag` }))}
              value={null}
              onChange={(value) => {
                const zone = ZEITKAT_SLIDER_ZONES.find((item) => item.id === value);
                if (zone) addZeitkatZone(zone);
              }}
              data-testid="add-zeitkat-tier"
            />
          )}
          {simulation && onResetAll ? <Button size="xs" variant="subtle" onClick={onResetAll}>Gruppe zurücksetzen</Button> : null}
        </Group>
      </Group>

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
        <Text size="xs" c="dimmed">Slider und direkte Eingabe werden synchron gehalten.</Text>
      </Group>

      {kind === 'zeitkat' ? (
        <>
          <Box style={{ overflowX: 'auto', border: '1px solid var(--mantine-color-gray-3)', borderRadius: 8, padding: 10 }}>
            <Box data-testid="fee-staircase-zeitkat" style={{ display: 'flex', gap: 6, minWidth: `${ZEITKAT_SLIDER_ZONES.length * 112}px`, alignItems: 'stretch' }}>
              {ZEITKAT_SLIDER_ZONES.map((zone) => {
                const entry = zeitkatMap.get(zone.id);
                const original = baselineZeitkatMap.get(zone.id);
                return (
                  <StairSlider
                    key={zone.id}
                    label={`ZEITKAT ${zone.id}`}
                    detail={`${zone.kurzbez} h/Tag`}
                    value={entry?.monthlyAmount ?? 0}
                    originalAmount={original?.monthlyAmount}
                    priceMax={priceMax}
                    simulation={simulation}
                    onChange={(value) => updateZeitkatAmount(zone, Number(value) || 0)}
                    testId={`fee-staircase-slider-${zone.id}`}
                    width="1 0 106px"
                  />
                );
              })}
            </Box>
          </Box>
          {activeEntries.some((entry) => Number(getFeeBandZeitkatId(entry)) > 8) ? (
            <Paper withBorder p="xs" radius="sm">
              <Text size="xs" fw={600} mb="xs">Über 8 Stunden (vorhandene Staffeln)</Text>
              <Stack gap="xs">
                {sortEntries(activeEntries.filter((entry) => Number(getFeeBandZeitkatId(entry)) > 8), 'zeitkat').map((entry) => {
                  const zone = ZEITKAT_CATALOG.find((item) => item.id === getFeeBandZeitkatId(entry));
                  return (
                    <Group key={entry.id} justify="space-between" wrap="wrap">
                      <Text size="sm">ZEITKAT {zone.id} · {zone.kurzbez} h/Tag</Text>
                      <PriceField
                        value={entry.monthlyAmount}
                        label={`Betrag ZEITKAT ${zone.id}`}
                        onChange={(value) => updateEntry(entry.id, { monthlyAmount: value })}
                        testId={`fee-staircase-price-${entry.id}`}
                      />
                    </Group>
                  );
                })}
              </Stack>
            </Paper>
          ) : null}
        </>
      ) : (
        <Box style={{ overflowX: 'auto', border: '1px solid var(--mantine-color-gray-3)', borderRadius: 8, padding: 10 }}>
          <Box data-testid="fee-staircase-weekly" style={{ display: 'flex', gap: 6, minWidth: `${Math.max(1, weeklySegments.length) * 126}px`, alignItems: 'stretch' }}>
            {weeklySegments.map(({ entry, lower, upper }) => {
              const original = baselineEntriesForPeriod.find((item) => String(item.id) === String(entry.id));
              const width = Math.max(1, upper - lower);
              return (
                <StairSlider
                  key={entry.id}
                  label={getWeeklyLimit(entry) != null ? `${lower}–${upper} h` : `${lower}+ h`}
                  detail="Wochenstunden"
                  value={entry.monthlyAmount}
                  originalAmount={original?.monthlyAmount}
                  priceMax={priceMax}
                  simulation={simulation}
                  onChange={(value) => updateEntry(entry.id, { monthlyAmount: Number(value) || 0 })}
                  testId={`fee-staircase-slider-${entry.id}`}
                  width={`${width} 0 126px`}
                />
              );
            })}
          </Box>
          {activeEntries.length === 0 ? <Text size="sm" c="dimmed" ta="center" py="md">Noch keine Staffel angelegt. Mit „Staffel hinzufügen“ startest du bei 0 Stunden.</Text> : null}
        </Box>
      )}

      <Text fw={600} size="sm">Direkte Eingabe</Text>
      {kind === 'weekly' ? (
        <Paper withBorder radius="sm" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
            <thead><tr>
              <th style={{ textAlign: 'left', padding: 8 }}>Stundenbereich</th>
              <th style={{ textAlign: 'right', padding: 8 }}>Obergrenze (Wochenstunden)</th>
              {simulation ? <th style={{ textAlign: 'right', padding: 8 }}>Original</th> : null}
              {!simulation ? <th style={{ padding: 8 }} /> : null}
            </tr></thead>
            <tbody>
              {activeEntries.map((entry, index) => {
                const priorLimit = getWeeklyLimit(activeEntries[index - 1]);
                const lower = priorLimit ?? 0;
                const upper = getWeeklyLimit(entry);
                const original = baselineEntriesForPeriod.find((item) => String(item.id) === String(entry.id));
                return (
                  <tr key={entry.id}>
                    <td style={{ padding: 8 }}>{`${lower}–${upper ?? '∞'} h/Woche`}</td>
                    <td style={{ padding: 8 }}>
                      <NumberInput
                        size="xs"
                        min={lower + 0.5}
                        step={0.5}
                        decimalScale={2}
                        value={upper ?? ''}
                        onChange={(value) => updateWeeklyLimit(entry.id, value)}
                        aria-label={`Obergrenze Staffel ${index + 1} Wochenstunden`}
                      />
                    </td>
                    {simulation ? <td style={{ padding: 8, textAlign: 'right' }}>{original ? `${Number(original.monthlyAmount || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : 'neu'}</td> : null}
                    {!simulation ? <td style={{ padding: 8 }}><ActionIcon color="red" variant="subtle" aria-label={`Staffel ${index + 1} löschen`} onClick={() => removeEntry(entry.id)}><IconTrash size={15} /></ActionIcon></td> : null}
                  </tr>
                );
              })}
              {activeEntries.length === 0 ? <tr><td colSpan={simulation ? 3 : 3} style={{ padding: 12, color: 'var(--mantine-color-dimmed)' }}>In dieser Gültigkeitsversion sind noch keine Staffeln vorhanden.</td></tr> : null}
            </tbody>
          </table>
        </Paper>
      ) : null}

      {weeklyStructureInvalid ? (
        <Alert color="red" variant="light" py="xs">Die Wochenstaffel braucht eindeutige, aufsteigende Obergrenzen und genau eine offene Schlussstaffel. Ergänze sie über „Staffel hinzufügen“ oder korrigiere die Tabelle; Grenzen bleiben lücken- und überlappungsfrei.</Alert>
      ) : null}
      {missingZeitkatZones.length > 0 ? (
        <Alert color="yellow" variant="light" py="xs">{missingZeitkatZones.length} ZEITKAT-Sätze bis einschließlich 8 Stunden fehlen. Die Sliderpositionen bleiben sichtbar und lassen sich direkt befüllen.</Alert>
      ) : null}
      {drawError ? <Alert color="yellow" variant="light" py="xs">{drawError}</Alert> : null}
    </Stack>
  );
}
