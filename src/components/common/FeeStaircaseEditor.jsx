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
  Stack,
  Text,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { createId } from '../../utils/idUtils';
import { getFeeBandZeitkatId, ZEITKAT_CATALOG } from '../../utils/adebisConstants';
import { isDateWithinRange } from '../../utils/financeUtils';

const SVG_WIDTH = 820;
const SVG_HEIGHT = 310;
const PLOT = { left: 62, right: 16, top: 18, bottom: 42 };
const PLOT_WIDTH = SVG_WIDTH - PLOT.left - PLOT.right;
const PLOT_HEIGHT = SVG_HEIGHT - PLOT.top - PLOT.bottom;

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
    const leftOpen = leftMax == null;
    const rightOpen = rightMax == null;
    if (leftOpen && rightOpen) return String(left.id).localeCompare(String(right.id));
    if (leftOpen) return 1;
    if (rightOpen) return -1;
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

function PriceField({ entry, label, onChange, testId }) {
  const [draft, setDraft] = React.useState(entry.monthlyAmount ?? '');
  React.useEffect(() => setDraft(entry.monthlyAmount ?? ''), [entry.monthlyAmount]);
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

function FeeStaircaseChart({ kind, entries, baselineEntries, onDraw, onDrawError, simulation }) {
  const [drawing, setDrawing] = React.useState(null);
  const allEntries = [...entries, ...(baselineEntries || [])];
  const priceMax = getPriceMax(entries, baselineEntries);
  const domainMin = kind === 'zeitkat' ? 1 : 0;
  const domainMax = kind === 'zeitkat'
    ? 13
    : Math.max(40, Math.ceil(Math.max(0, ...allEntries.map((entry) => Number(entry.maxHours) || 0)) / 10) * 10);
  const xAt = (hours) => PLOT.left + ((hours - domainMin) / (domainMax - domainMin)) * PLOT_WIDTH;
  const yAt = (price) => PLOT.top + PLOT_HEIGHT - (Math.max(0, Number(price) || 0) / priceMax) * PLOT_HEIGHT;
  const priceAt = (svgY) => {
    const ratio = Math.max(0, Math.min(1, (PLOT.top + PLOT_HEIGHT - svgY) / PLOT_HEIGHT));
    return Math.round((ratio * priceMax) / 5) * 5;
  };
  const getPoint = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const svgX = ((event.clientX - rect.left) / rect.width) * SVG_WIDTH;
    const svgY = ((event.clientY - rect.top) / rect.height) * SVG_HEIGHT;
    const hours = domainMin + ((svgX - PLOT.left) / PLOT_WIDTH) * (domainMax - domainMin);
    return {
      hours: Math.max(domainMin, Math.min(domainMax, hours)),
      y: Math.max(PLOT.top, Math.min(PLOT.top + PLOT_HEIGHT, svgY)),
    };
  };
  const currentZoneById = new Map(entries.map((entry) => [getFeeBandZeitkatId(entry), entry]));
  const baselineZoneById = new Map((baselineEntries || []).map((entry) => [getFeeBandZeitkatId(entry), entry]));
  const weeklySegments = kind === 'weekly' ? getWeeklySegments(entries, domainMax) : [];
  const baselineWeeklySegments = kind === 'weekly' ? getWeeklySegments(baselineEntries || [], domainMax) : [];
  const xTicks = kind === 'zeitkat' ? [1, 2, 4, 6, 8, 10, 12, 13] : Array.from({ length: Math.floor(domainMax / 10) + 1 }, (_, index) => index * 10);
  const yTicks = [0, priceMax / 2, priceMax];

  function beginDrawing(event) {
    if (event.button !== 0) return;
    const point = getPoint(event);
    if (!point) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDrawing({ start: point, end: point });
    onDrawError?.('');
  }

  function moveDrawing(event) {
    if (!drawing) return;
    const point = getPoint(event);
    if (point) setDrawing((current) => current ? { ...current, end: point } : null);
  }

  function finishDrawing(event) {
    if (!drawing) return;
    const point = getPoint(event) || drawing.end;
    onDraw({ startHours: drawing.start.hours, endHours: point.hours, amount: priceAt(point.y), domainMin, domainMax });
    setDrawing(null);
  }

  const previewRect = drawing ? (() => {
    const startHours = Math.min(drawing.start.hours, drawing.end.hours);
    const endHours = Math.max(drawing.start.hours, drawing.end.hours);
    const lowY = Math.min(drawing.start.y, drawing.end.y);
    const highY = Math.max(drawing.start.y, drawing.end.y);
    return {
      x: xAt(startHours),
      y: Math.min(yAt(priceAt(drawing.end.y)), lowY),
      width: Math.max(2, xAt(endHours) - xAt(startHours)),
      height: Math.max(3, highY - lowY),
    };
  })() : null;

  return (
    <Box>
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        role="img"
        aria-label={kind === 'zeitkat' ? 'Beitragsstaffel nach täglicher Buchungszeit' : 'Beitragsstaffel nach Wochenstunden'}
        data-testid={`fee-staircase-${kind}`}
        style={{ display: 'block', width: '100%', minHeight: 240, border: '1px solid var(--mantine-color-gray-3)', borderRadius: 8, background: 'var(--mantine-color-body)', touchAction: 'none', cursor: 'crosshair' }}
        onPointerDown={beginDrawing}
        onPointerMove={moveDrawing}
        onPointerUp={finishDrawing}
        onPointerCancel={() => setDrawing(null)}
      >
        {yTicks.map((tick) => (
          <g key={`y-${tick}`}>
            <line x1={PLOT.left} x2={SVG_WIDTH - PLOT.right} y1={yAt(tick)} y2={yAt(tick)} stroke="var(--mantine-color-gray-3)" strokeDasharray={tick === 0 ? undefined : '4 4'} />
            <text x={PLOT.left - 8} y={yAt(tick) + 4} textAnchor="end" fill="var(--mantine-color-dimmed)" fontSize="11">{Math.round(tick)} €</text>
          </g>
        ))}
        {xTicks.map((tick) => (
          <g key={`x-${tick}`}>
            <line x1={xAt(tick)} x2={xAt(tick)} y1={PLOT.top} y2={PLOT.top + PLOT_HEIGHT} stroke="var(--mantine-color-gray-2)" />
            <text x={xAt(tick)} y={SVG_HEIGHT - 10} textAnchor="middle" fill="var(--mantine-color-dimmed)" fontSize="11">{tick} h</text>
          </g>
        ))}
        {kind === 'weekly' ? (
          <>
            {baselineWeeklySegments.map(({ entry, lower, upper }) => (
              <rect key={`original-${entry.id}`} x={xAt(lower)} y={yAt(entry.monthlyAmount)} width={Math.max(0, xAt(upper) - xAt(lower))} height={PLOT.top + PLOT_HEIGHT - yAt(entry.monthlyAmount)} fill="var(--mantine-color-gray-5)" fillOpacity={simulation ? 0.18 : 0.05} stroke={simulation ? 'var(--mantine-color-gray-6)' : 'var(--mantine-color-gray-5)'} strokeOpacity={simulation ? 0.45 : 0.2} strokeDasharray={simulation ? '5 4' : undefined} />
            ))}
            {weeklySegments.map(({ entry, lower, upper }) => (
              <g key={entry.id}>
                <rect x={xAt(lower)} y={yAt(entry.monthlyAmount)} width={Math.max(0, xAt(upper) - xAt(lower))} height={PLOT.top + PLOT_HEIGHT - yAt(entry.monthlyAmount)} fill="var(--mantine-color-blue-5)" fillOpacity={0.8} stroke="var(--mantine-color-blue-7)" strokeWidth={1} />
                {xAt(upper) - xAt(lower) > 74 ? <text x={(xAt(lower) + xAt(upper)) / 2} y={yAt(entry.monthlyAmount) + 18} textAnchor="middle" fill="white" fontSize="12" fontWeight="600">{formatBandLabel(lower, upper, entry.maxHours)}</text> : null}
              </g>
            ))}
            {simulation ? baselineWeeklySegments.map(({ entry, lower, upper }) => (
              <rect key={`original-outline-${entry.id}`} x={xAt(lower)} y={yAt(entry.monthlyAmount)} width={Math.max(0, xAt(upper) - xAt(lower))} height={PLOT.top + PLOT_HEIGHT - yAt(entry.monthlyAmount)} fill="none" stroke="var(--mantine-color-gray-7)" strokeOpacity={0.7} strokeWidth={1.5} strokeDasharray="5 4" pointerEvents="none" />
            )) : null}
          </>
        ) : ZEITKAT_CATALOG.map((zone) => {
          const currentEntry = currentZoneById.get(zone.id);
          const baselineEntry = baselineZoneById.get(zone.id);
          const x1 = xAt(zone.minHours);
          const x2 = xAt(zone.maxHours);
          return (
            <g key={zone.id}>
              {baselineEntry ? <rect x={x1} y={yAt(baselineEntry.monthlyAmount)} width={x2 - x1} height={PLOT.top + PLOT_HEIGHT - yAt(baselineEntry.monthlyAmount)} fill="var(--mantine-color-gray-5)" fillOpacity={simulation ? 0.18 : 0.05} stroke={simulation ? 'var(--mantine-color-gray-6)' : 'var(--mantine-color-gray-5)'} strokeOpacity={simulation ? 0.45 : 0.2} strokeDasharray={simulation ? '5 4' : undefined} /> : null}
              {currentEntry ? (
                <>
                  <rect x={x1} y={yAt(currentEntry.monthlyAmount)} width={x2 - x1} height={PLOT.top + PLOT_HEIGHT - yAt(currentEntry.monthlyAmount)} fill="var(--mantine-color-teal-5)" fillOpacity={0.82} stroke="var(--mantine-color-teal-7)" strokeWidth={1} />
                  {x2 - x1 > 38 ? <text x={(x1 + x2) / 2} y={yAt(currentEntry.monthlyAmount) + 17} textAnchor="middle" fill="white" fontSize="10" fontWeight="600">{zone.id}</text> : null}
                </>
              ) : <rect x={x1} y={PLOT.top} width={x2 - x1} height={PLOT_HEIGHT} fill="var(--mantine-color-gray-1)" fillOpacity={0.6} stroke="var(--mantine-color-gray-4)" strokeDasharray="3 3" />}
              {simulation && baselineEntry ? <rect x={x1} y={yAt(baselineEntry.monthlyAmount)} width={x2 - x1} height={PLOT.top + PLOT_HEIGHT - yAt(baselineEntry.monthlyAmount)} fill="none" stroke="var(--mantine-color-gray-7)" strokeOpacity={0.7} strokeWidth={1.5} strokeDasharray="5 4" pointerEvents="none" /> : null}
            </g>
          );
        })}
        {previewRect ? <rect {...previewRect} fill="var(--mantine-color-orange-5)" fillOpacity={0.35} stroke="var(--mantine-color-orange-7)" strokeDasharray="4 3" pointerEvents="none" /> : null}
        <text x={SVG_WIDTH / 2} y={SVG_HEIGHT - 1} textAnchor="middle" fill="var(--mantine-color-dimmed)" fontSize="11">{kind === 'zeitkat' ? 'Stunden pro Tag (ZEITKAT)' : 'Betreuungsstunden pro Woche'}</text>
      </svg>
      <Group justify="space-between" mt={4} wrap="wrap">
        <Text size="xs" c="dimmed">{simulation ? 'Gestrichelt: Original · farbig: Simulation' : 'Ziehe auf einer Staffel, um sie zu ändern oder einen Teilbereich als neue Staffel abzutrennen.'}</Text>
        {simulation ? <Text size="xs" c="dimmed">Die Änderungen gelten nur lokal für diese Simulation.</Text> : null}
      </Group>
    </Box>
  );
}

function formatBandLabel(lower, upper, configuredMax) {
  const number = (value) => Number(value).toLocaleString('de-DE', { maximumFractionDigits: 1 });
  return Number.isFinite(Number(configuredMax)) ? `${number(lower)}–${number(upper)} h` : `ab ${number(lower)} h`;
}

export default function FeeStaircaseEditor({
  entries = [],
  originalEntries,
  referenceDate = new Date().toISOString().slice(0, 10),
  simulation = false,
  onChangeEntries,
  onResetAll,
}) {
  const availableKinds = ['weekly', 'zeitkat'];
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
    ? ZEITKAT_CATALOG.filter((zone) => !activeEntries.some((entry) => getFeeBandZeitkatId(entry) === zone.id))
    : [];
  const baselineEntriesForPeriod = sortEntries((originalEntries || []).filter((entry) =>
    getEntryKind(entry) === kind && makePeriodKey(entry) === periodKey
  ), kind);
  const periodStart = activeEntries[0]?.validFrom || '';
  const periodEnd = activeEntries[0]?.validUntil || '';

  function replaceActiveEntries(nextActiveEntries) {
    const preserved = entries.filter((entry) => getEntryKind(entry) !== kind || makePeriodKey(entry) !== periodKey);
    onChangeEntries?.([...preserved, ...nextActiveEntries]);
  }

  function updateEntry(entryId, updates) {
    replaceActiveEntries(activeEntries.map((entry) => (
      String(entry.id) === String(entryId) ? { ...entry, ...updates } : entry
    )));
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

  function onDraw({ startHours, endHours, amount, domainMax }) {
    const start = Math.min(startHours, endHours);
    const end = Math.max(startHours, endHours);
    const snap = (value) => Math.round(value * 2) / 2;
    const snappedStart = snap(start);
    const snappedEnd = snap(end);
    if (kind === 'zeitkat') {
      const selectedZones = ZEITKAT_CATALOG.filter((zone) => zone.maxHours > start && zone.minHours < Math.max(end, start + 0.15));
      if (selectedZones.length === 0) return;
      const next = [...activeEntries];
      selectedZones.forEach((zone) => {
        const existingIndex = next.findIndex((entry) => getFeeBandZeitkatId(entry) === zone.id);
        if (existingIndex >= 0) next[existingIndex] = { ...next[existingIndex], monthlyAmount: amount };
        else next.push(makeEntryLike(activeEntries[0] || {}, { zeitkatId: zone.id, maxHours: zone.maxHours, monthlyAmount: amount }));
      });
      replaceActiveEntries(sortEntries(next, 'zeitkat'));
      setDrawError('');
      return;
    }

    const segments = getWeeklySegments(activeEntries, domainMax);
    const targetIndex = segments.findIndex((segment) => (snappedStart + snappedEnd) / 2 >= segment.lower
      && (snappedStart + snappedEnd) / 2 <= segment.upper);
    const target = segments[targetIndex];
    if (!target) return;
    if (Math.abs(endHours - startHours) < 0.35) {
      updateEntry(target.entry.id, { monthlyAmount: amount });
      return;
    }
    const selectedStart = Math.max(target.lower, snappedStart);
    const selectedEnd = Math.min(target.upper, Math.max(snappedEnd, selectedStart + 0.5));
    if (selectedEnd <= selectedStart || selectedEnd - selectedStart < 0.49) {
      updateEntry(target.entry.id, { monthlyAmount: amount });
      return;
    }
    if (snappedStart < target.lower - 0.01 || snappedEnd > target.upper + 0.01) {
      setDrawError('Neue Rechtecke bitte innerhalb einer bestehenden Staffel zeichnen.');
      return;
    }

    const sorted = sortEntries(activeEntries, 'weekly');
    const sourceIndex = sorted.findIndex((entry) => String(entry.id) === String(target.entry.id));
    const beforeNeeded = selectedStart > target.lower + 0.01;
    const afterNeeded = selectedEnd < target.upper - 0.01;
    const replacement = [];
    const selectedMax = target.openEnded && selectedEnd >= domainMax - 0.01 ? '' : selectedEnd;
    if (beforeNeeded) {
      replacement.push({ ...target.entry, maxHours: selectedStart });
      replacement.push(makeEntryLike(target.entry, { maxHours: selectedMax, monthlyAmount: amount }));
    } else {
      replacement.push({ ...target.entry, maxHours: selectedMax, monthlyAmount: amount });
    }
    if (afterNeeded) {
      replacement.push(makeEntryLike(target.entry, { maxHours: target.entry.maxHours ?? '', monthlyAmount: Number(target.entry.monthlyAmount) || 0 }));
    } else if (target.openEnded && selectedEnd < domainMax - 0.01) {
      replacement.push(makeEntryLike(target.entry, { maxHours: '', monthlyAmount: Number(target.entry.monthlyAmount) || 0 }));
    }
    sorted.splice(sourceIndex, 1, ...replacement);
    replaceActiveEntries(sortEntries(sorted, 'weekly'));
    setDrawError('');
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

  return (
    <Stack gap="sm" data-testid="fee-staircase-editor">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <Group align="flex-end" wrap="wrap">
          {availableKinds.length > 1 ? (
            <Select
              label="Staffelart"
              value={kind}
              onChange={(value) => value && setKind(value)}
              data={[{ value: 'zeitkat', label: 'ZEITKAT / Stunden pro Tag' }, { value: 'weekly', label: 'Wochenstunden' }]}
              w={230}
              data-testid="fee-staircase-kind"
            />
          ) : <Text size="sm" fw={600}>{kind === 'zeitkat' ? 'ZEITKAT / Stunden pro Tag' : 'Wochenstunden'}</Text>}
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
              data={ZEITKAT_CATALOG.filter((zone) => !activeEntries.some((entry) => getFeeBandZeitkatId(entry) === zone.id)).map((zone) => ({ value: zone.id, label: `ZEITKAT ${zone.id} · ${zone.kurzbez} h/Tag` }))}
              value={null}
              onChange={(value) => {
                const zone = ZEITKAT_CATALOG.find((item) => item.id === value);
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
        <Text size="xs" c="dimmed">Grafische und tabellarische Eingabe werden synchron gehalten.</Text>
      </Group>

      <FeeStaircaseChart
        kind={kind}
        entries={activeEntries}
        baselineEntries={baselineEntriesForPeriod}
        onDraw={onDraw}
        onDrawError={setDrawError}
        simulation={simulation}
      />
      <Text fw={600} size="sm">Direkte Eingabe</Text>
      <Paper withBorder radius="sm" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
            <thead><tr>
              <th style={{ textAlign: 'left', padding: 8 }}>{kind === 'zeitkat' ? 'Zeitkategorie' : 'Stundenbereich'}</th>
              {kind === 'weekly' ? <th style={{ textAlign: 'right', padding: 8 }}>Obergrenze</th> : null}
              <th style={{ textAlign: 'right', padding: 8 }}>Monatsbeitrag</th>
              {simulation ? <th style={{ textAlign: 'right', padding: 8 }}>Original</th> : null}
              {kind === 'weekly' && !simulation ? <th style={{ padding: 8 }} /> : null}
            </tr></thead>
            <tbody>
              {activeEntries.map((entry, index) => {
                const zone = ZEITKAT_CATALOG.find((item) => item.id === getFeeBandZeitkatId(entry));
                const priorLimit = kind === 'weekly' ? getWeeklyLimit(activeEntries[index - 1]) : null;
                const lower = priorLimit ?? 0;
                const upper = getWeeklyLimit(entry);
                const original = baselineEntriesForPeriod.find((item) => String(item.id) === String(entry.id));
                return (
                  <tr key={entry.id}>
                    <td style={{ padding: 8 }}>{zone ? `ZEITKAT ${zone.id} · ${zone.kurzbez} h/Tag` : `${lower}–${upper != null ? upper : '∞'} h/Woche`}</td>
                    {kind === 'weekly' ? (
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
                    ) : null}
                    <td style={{ padding: 8 }}>
                      <PriceField
                        entry={entry}
                        label={`Betrag ${zone ? `ZEITKAT ${zone.id}` : `Staffel ${index + 1}`}`}
                        onChange={(value) => updateEntry(entry.id, { monthlyAmount: value })}
                        testId={`fee-staircase-price-${entry.id}`}
                      />
                    </td>
                    {simulation ? <td style={{ padding: 8, textAlign: 'right' }}>{original ? `${Number(original.monthlyAmount || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : 'neu'}</td> : null}
                    {kind === 'weekly' && !simulation ? <td style={{ padding: 8 }}><ActionIcon color="red" variant="subtle" aria-label={`Staffel ${index + 1} löschen`} onClick={() => removeEntry(entry.id)}><IconTrash size={15} /></ActionIcon></td> : null}
                  </tr>
                );
              })}
              {activeEntries.length === 0 ? <tr><td colSpan={kind === 'weekly' ? 3 : 2} style={{ padding: 12, color: 'var(--mantine-color-dimmed)' }}>In dieser Gültigkeitsversion sind noch keine Staffeln vorhanden.</td></tr> : null}
            </tbody>
          </table>
      </Paper>

      {weeklyStructureInvalid ? (
        <Alert color="red" variant="light" py="xs">Die Wochenstaffel braucht eindeutige, aufsteigende Obergrenzen und genau eine offene Schlussstaffel. Ergänze sie über „Staffel hinzufügen“ oder korrigiere die Tabelle; Grenzen bleiben lücken- und überlappungsfrei.</Alert>
      ) : null}
      {missingZeitkatZones.length > 0 ? (
        <Alert color="yellow" variant="light" py="xs">{missingZeitkatZones.length} ZEITKAT-Sätze fehlen. Die leeren Rasterfelder sind markiert; ergänze sie über „ZEITKAT ergänzen“ oder zeichne über die fehlenden Stunden.</Alert>
      ) : null}
      {drawError ? <Alert color="yellow" variant="light" py="xs">{drawError}</Alert> : null}
    </Stack>
  );
}
