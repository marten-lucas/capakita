import React from 'react';
import { ActionIcon, Badge, Box, Button, Divider, Group, Paper, Stack, Switch, Text, TextInput, Tooltip } from '@mantine/core';
import { IconAlertCircle, IconBook2, IconBriefcase, IconClock, IconMinus, IconPlus, IconSparkles, IconTrash } from '@tabler/icons-react';
import { calculateSegmentMinutes, formatDurationHours, getSegmentOverlapIssues, minutesToTime, normalizeTimeInput, timeToMinutes } from '../../../utils/timeUtils';

const PRESETS = [
  { label: 'Kurz', start: '08:00', end: '10:00' },
  { label: 'Vormittag', start: '08:00', end: '12:00' },
  { label: 'Mittag', start: '11:00', end: '14:00' },
  { label: 'Nachmittag', start: '13:00', end: '16:00' },
  { label: 'Ganztag', start: '08:00', end: '16:00' },
];

function getDayMinutes(segments) {
  return (segments || []).reduce((total, segment) => {
    const duration = calculateSegmentMinutes(segment);
    return duration && duration > 0 ? total + duration : total;
  }, 0);
}

function getSegmentIssues(segments) {
  return getSegmentOverlapIssues(segments);
}

function getTimelineBlocks(segments) {
  return (segments || [])
    .map((segment, index) => {
      const start = timeToMinutes(segment.booking_start);
      const end = timeToMinutes(segment.booking_end);

      if (start === null || end === null || end <= start) return null;

      const left = (start / (24 * 60)) * 100;
      const width = ((end - start) / (24 * 60)) * 100;

      return {
        index,
        left,
        width,
        startLabel: normalizeTimeInput(segment.booking_start) || segment.booking_start || '',
        endLabel: normalizeTimeInput(segment.booking_end) || segment.booking_end || '',
        category: segment.category || 'pedagogical',
      };
    })
    .filter(Boolean);
}

function formatInputValue(value) {
  return normalizeTimeInput(value) || value || '';
}

function clampMinutes(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function DayControl({ dayLabel, dayData, onToggle, onTimeChange, onAddSegment, onAddSegmentAt, onRemoveSegment, isCapacity = false, onCategoryChange }) {
  const isActive = !!dayData;
  const segments = React.useMemo(
    () => (isActive ? dayData.segments || [] : []),
    [isActive, dayData?.segments]
  );

  const timelineRef = React.useRef(null);
  const dragStateRef = React.useRef(null);
  const [draftValues, setDraftValues] = React.useState({});
  const [openDetails, setOpenDetails] = React.useState({});
  const lastRangeRef = React.useRef({ start: '08:00', end: '10:00' });

  React.useEffect(() => {
    const nextDrafts = {};
    segments.forEach((segment, index) => {
      const key = segment.id || `${dayLabel}-${index}`;
      nextDrafts[key] = {
        start: formatInputValue(segment.booking_start),
        end: formatInputValue(segment.booking_end),
      };
    });
    setDraftValues(nextDrafts);
  }, [dayLabel, segments]);

  const issues = React.useMemo(() => getSegmentIssues(segments), [segments]);
  const timelineBlocks = React.useMemo(() => getTimelineBlocks(segments), [segments]);
  const dayMinutes = React.useMemo(() => getDayMinutes(segments), [segments]);

  const getPointerMinutes = React.useCallback((clientX) => {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return null;

    const x = clampMinutes(clientX - rect.left, 0, rect.width);
    const rawMinutes = (x / rect.width) * 24 * 60;
    return Math.round(rawMinutes / 15) * 15;
  }, []);

  const startDrag = React.useCallback((mode, segmentIndex, event) => {
    event.preventDefault();
    event.stopPropagation();

    const segment = segments[segmentIndex];
    if (!segment) return;

    const startMinutes = timeToMinutes(segment.booking_start);
    const endMinutes = timeToMinutes(segment.booking_end);
    if (startMinutes === null || endMinutes === null) return;

    const pointerMinutes = getPointerMinutes(event.clientX);
    if (pointerMinutes === null) return;

    dragStateRef.current = {
      mode,
      segmentIndex,
      offset: pointerMinutes - startMinutes,
      duration: endMinutes - startMinutes,
    };

    const handleMove = (moveEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState) return;

      const nextPointerMinutes = getPointerMinutes(moveEvent.clientX);
      if (nextPointerMinutes === null) return;

      const currentSegment = segments[dragState.segmentIndex];
      if (!currentSegment) return;

      const currentStart = timeToMinutes(currentSegment.booking_start);
      const currentEnd = timeToMinutes(currentSegment.booking_end);
      if (currentStart === null || currentEnd === null) return;

      let nextStart = currentStart;
      let nextEnd = currentEnd;

      if (dragState.mode === 'move') {
        nextStart = clampMinutes(nextPointerMinutes - dragState.offset, 0, (24 * 60) - dragState.duration);
        nextEnd = nextStart + dragState.duration;
      } else if (dragState.mode === 'resize-start') {
        nextStart = clampMinutes(nextPointerMinutes, 0, currentEnd - 15);
      } else if (dragState.mode === 'resize-end') {
        nextEnd = clampMinutes(nextPointerMinutes, currentStart + 15, 24 * 60);
      }

      onTimeChange(dragState.segmentIndex, {
        start: minutesToTime(nextStart),
        end: minutesToTime(nextEnd),
      });
    };

    const handleUp = () => {
      dragStateRef.current = null;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }, [getPointerMinutes, onTimeChange, segments]);

  const handleTimelinePointerDown = React.useCallback((event) => {
    if (event.target !== event.currentTarget) return;
    const pointerMinutes = getPointerMinutes(event.clientX);
    if (pointerMinutes === null) return;
    onAddSegmentAt?.(pointerMinutes);
  }, [getPointerMinutes, onAddSegmentAt]);

  function getDraftForSegment(segment, index) {
    const key = segment.id || `${dayLabel}-${index}`;
    return draftValues[key] || {
      start: formatInputValue(segment.booking_start),
      end: formatInputValue(segment.booking_end),
    };
  }

  function updateDraft(segment, index, partial) {
    const key = segment.id || `${dayLabel}-${index}`;
    setDraftValues((previous) => {
      const current = previous[key] || {
        start: formatInputValue(segment.booking_start),
        end: formatInputValue(segment.booking_end),
      };
      return {
        ...previous,
        [key]: {
          ...current,
          ...partial,
        },
      };
    });
  }

  function commitRange(index, start, end) {
    const normalizedStart = normalizeTimeInput(start);
    const normalizedEnd = normalizeTimeInput(end);

    if (!normalizedStart || !normalizedEnd) return;

    const startMinutes = timeToMinutes(normalizedStart);
    const endMinutes = timeToMinutes(normalizedEnd);

    if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return;

    lastRangeRef.current = { start: normalizedStart, end: normalizedEnd };
    onTimeChange(index, { start: normalizedStart, end: normalizedEnd });
  }

  function getDaysSummary() {
    if (!isActive) return 'Tag deaktiviert';
    if (segments.length === 0) return 'Keine Zeiten definiert';

    const issueCount = issues.length;
    return issueCount > 0
      ? `${segments.length} Segmente · ${formatDurationHours(dayMinutes)} · ${issueCount} Hinweis${issueCount > 1 ? 'e' : ''}`
      : `${segments.length} Segmente · ${formatDurationHours(dayMinutes)}`;
  }

  function applyPreset(index, preset) {
    updateDraft(segments[index], index, { start: preset.start, end: preset.end });
    commitRange(index, preset.start, preset.end);
  }

  function applyLastRange(index) {
    const { start, end } = lastRangeRef.current || {};
    if (!start || !end) return;
    updateDraft(segments[index], index, { start, end });
    commitRange(index, start, end);
  }

  function toggleDetails(segmentKey) {
    setOpenDetails((previous) => ({
      ...previous,
      [segmentKey]: !previous[segmentKey],
    }));
  }

  return (
    <Paper
      withBorder
      radius="lg"
      p="md"
      style={{
        borderColor: isActive ? 'var(--mantine-color-blue-2)' : 'var(--mantine-color-gray-3)',
        background: isActive ? 'linear-gradient(180deg, rgba(34,139,230,0.05), rgba(255,255,255,1))' : '#fff',
      }}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md">
        <Group align="center" gap="sm" wrap="nowrap">
          <Text w={88} size="sm" fw={700} c="dark.8">
            {dayLabel}
          </Text>
          <Switch
            checked={isActive}
            onChange={(e) => onToggle(e.currentTarget.checked)}
            size="sm"
            aria-label={dayLabel}
          />
        </Group>

        <Badge
          leftSection={<IconClock size={12} />}
          variant={issues.length > 0 ? 'light' : 'filled'}
          color={issues.length > 0 ? 'yellow' : isActive ? 'blue' : 'gray'}
        >
          {getDaysSummary()}
        </Badge>
      </Group>

      {isActive && (
        <Stack gap="md" mt="md">
          <Box>
            <Group justify="space-between" align="center" mb={6}>
              <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                Tagesleiste
              </Text>
              <Text size="xs" c="dimmed">
                00:00 bis 24:00
              </Text>
            </Group>

            <Box
              ref={timelineRef}
              style={{
                position: 'relative',
                height: 42,
                borderRadius: 999,
                overflow: 'hidden',
                border: '1px solid var(--mantine-color-gray-3)',
                background: 'linear-gradient(90deg, rgba(8,55,67,0.04) 0%, rgba(242,110,46,0.04) 100%)',
                cursor: 'crosshair',
              }}
              onPointerDown={handleTimelinePointerDown}
            >
              {[0, 6, 12, 18].map((hour) => (
                <Box
                  key={hour}
                  style={{
                    position: 'absolute',
                    left: `${(hour / 24) * 100}%`,
                    top: 0,
                    bottom: 0,
                    width: 1,
                    background: 'rgba(8,55,67,0.12)',
                  }}
                />
              ))}
              {timelineBlocks.length === 0 && (
                <Text size="xs" c="dimmed" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  Keine Segmente angelegt
                </Text>
              )}
              {timelineBlocks.map((block) => (
                <Tooltip
                  key={`${block.index}-${block.startLabel}-${block.endLabel}`}
                  label={`${block.startLabel} - ${block.endLabel}`}
                  withArrow
                >
                  <Box
                    style={{
                      position: 'absolute',
                      left: `${block.left}%`,
                      top: 6,
                      height: 30,
                      width: `${Math.max(block.width, 2)}%`,
                      borderRadius: 999,
                      background: block.category === 'administrative'
                        ? 'linear-gradient(135deg, rgba(145,65,172,0.65), rgba(145,65,172,0.35))'
                        : 'linear-gradient(135deg, rgba(34,139,230,0.75), rgba(34,139,230,0.42))',
                      boxShadow: '0 8px 16px rgba(8,55,67,0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                      paddingInline: 8,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      touchAction: 'none',
                      userSelect: 'none',
                    }}
                    onPointerDown={(event) => startDrag('move', block.index, event)}
                  >
                    <Box
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 10,
                        cursor: 'ew-resize',
                        background: 'rgba(255,255,255,0.15)',
                      }}
                      onPointerDown={(event) => startDrag('resize-start', block.index, event)}
                    />
                    <Text size="inherit" style={{ pointerEvents: 'none' }}>
                      {block.startLabel}–{block.endLabel}
                    </Text>
                    <Box
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: 10,
                        cursor: 'ew-resize',
                        background: 'rgba(255,255,255,0.15)',
                      }}
                      onPointerDown={(event) => startDrag('resize-end', block.index, event)}
                    />
                  </Box>
                </Tooltip>
              ))}
            </Box>
          </Box>

          {issues.length > 0 && (
            <Group gap="xs" wrap="wrap">
              {issues.map((issue, index) => (
                <Badge key={`${issue.type}-${issue.index}-${index}`} leftSection={<IconAlertCircle size={12} />} color="yellow" variant="light">
                  {issue.message}
                </Badge>
              ))}
            </Group>
          )}

          {segments.map((segment, idx) => {
            const segmentKey = segment.id || `${dayLabel}-${idx}`;
            const draft = getDraftForSegment(segment, idx);
            const duration = calculateSegmentMinutes({ booking_start: draft.start, booking_end: draft.end });
            const isValid = timeToMinutes(draft.start) !== null && timeToMinutes(draft.end) !== null && (timeToMinutes(draft.end) > timeToMinutes(draft.start));

            return (
              <Paper key={segment.id || idx} withBorder radius="md" p="sm" bg="white" style={{ borderColor: 'var(--mantine-color-gray-3)' }}>
                <Stack gap="sm">
                  <Group justify="space-between" align="center" wrap="nowrap">
                    <Group gap="xs" wrap="nowrap">
                      <Badge variant="light" color={isValid ? 'blue' : 'red'}>
                        Segment {idx + 1}
                      </Badge>
                      <Text size="xs" c={isValid ? 'dimmed' : 'red'}>
                        {isValid ? formatDurationHours(duration || 0) : 'Zeiten prüfen'}
                      </Text>
                    </Group>

                    <Group gap={4}>
                      <Button size="xs" variant="subtle" onClick={() => toggleDetails(segmentKey)}>
                        {openDetails[segmentKey] ? 'Details schließen' : 'Details'}
                      </Button>
                      {segments.length > 1 && (
                        <ActionIcon variant="light" color="red" onClick={() => onRemoveSegment(idx)} size="sm" aria-label={`Segment ${idx + 1} entfernen`}>
                          <IconTrash size={14} />
                        </ActionIcon>
                      )}
                      <ActionIcon variant="light" color="blue" onClick={onAddSegment} size="sm" aria-label="Segment hinzufügen">
                        <IconPlus size={14} />
                      </ActionIcon>
                    </Group>
                  </Group>

                  {openDetails[segmentKey] && (
                    <Stack gap="sm">
                      <Group justify="space-between" align="center" wrap="nowrap">
                        <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                          Details
                        </Text>
                        <Group gap="xs" wrap="wrap">
                          {PRESETS.map((preset) => (
                            <Button
                              key={preset.label}
                              size="xs"
                              variant="light"
                              leftSection={<IconSparkles size={12} />}
                              onClick={() => applyPreset(idx, preset)}
                            >
                              {preset.label}
                            </Button>
                          ))}
                          <Button
                            size="xs"
                            variant="subtle"
                            leftSection={<IconClock size={12} />}
                            onClick={() => applyLastRange(idx)}
                          >
                            Zuletzt
                          </Button>
                        </Group>
                      </Group>

                      <Group grow align="flex-end" wrap="nowrap">
                        <TextInput
                          label="Start"
                          size="xs"
                          value={draft.start}
                          onChange={(event) => updateDraft(segment, idx, { start: event.currentTarget.value })}
                          onBlur={() => commitRange(idx, draft.start, draft.end)}
                          placeholder="08:00"
                          error={!isValid && draft.start && draft.end ? 'Ungültig' : null}
                        />
                        <TextInput
                          label="Ende"
                          size="xs"
                          value={draft.end}
                          onChange={(event) => updateDraft(segment, idx, { end: event.currentTarget.value })}
                          onBlur={() => commitRange(idx, draft.start, draft.end)}
                          placeholder="12:00"
                          error={!isValid && draft.start && draft.end ? 'Ungültig' : null}
                        />
                      </Group>

                      {isCapacity && (
                        <Stack gap={4}>
                          <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                            Blocktyp
                          </Text>
                          <Group gap="xs" wrap="nowrap">
                            <Button
                              size="xs"
                              variant={(segment.category || 'pedagogical') === 'pedagogical' ? 'filled' : 'light'}
                              color="blue"
                              leftSection={<IconBook2 size={12} />}
                              onClick={() => onCategoryChange?.(idx, 'pedagogical')}
                            >
                              Pädagogisch
                            </Button>
                            <Button
                              size="xs"
                              variant={segment.category === 'administrative' ? 'filled' : 'light'}
                              color="grape"
                              leftSection={<IconBriefcase size={12} />}
                              onClick={() => onCategoryChange?.(idx, 'administrative')}
                            >
                              Administrativ
                            </Button>
                          </Group>
                          {segment.category === 'administrative' && (
                            <Badge size="xs" color="grape" variant="light">
                              zählt nicht in Kapazität
                            </Badge>
                          )}
                        </Stack>
                      )}
                    </Stack>
                  )}
                </Stack>
              </Paper>
            );
          })}

          <Divider />

          <Group justify="space-between" align="center" wrap="wrap">
            <Text size="xs" c="dimmed">
              Die Details bleiben eingeklappt, die Tagesleiste ist direkt per Maus oder Touch verschieb- und resizebar.
            </Text>
            <Button size="xs" variant="light" leftSection={<IconMinus size={12} />} onClick={() => onToggle(false)}>
              Tag deaktivieren
            </Button>
          </Group>
        </Stack>
      )}
    </Paper>
  );
}

export default DayControl;