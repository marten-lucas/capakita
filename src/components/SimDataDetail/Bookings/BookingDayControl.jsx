import React from 'react';
import { ActionIcon, Box, Button, Group, Paper, Stack, Switch, Text, TextInput, Tooltip } from '@mantine/core';
import { IconChevronDown, IconPlus, IconTrash } from '@tabler/icons-react';
import { minutesToTime, normalizeTimeInput, timeToMinutes } from '../../../utils/timeUtils';

const TIMELINE_START_MINUTES = 6 * 60;
const TIMELINE_END_MINUTES = 19 * 60;
const TIMELINE_TOTAL_MINUTES = TIMELINE_END_MINUTES - TIMELINE_START_MINUTES;

function getTimelineBlocks(segments) {
  return (segments || [])
    .map((segment, index) => {
      const start = timeToMinutes(segment.booking_start);
      const end = timeToMinutes(segment.booking_end);

      if (start === null || end === null || end <= start) return null;

      const clippedStart = clampMinutes(start, TIMELINE_START_MINUTES, TIMELINE_END_MINUTES);
      const clippedEnd = clampMinutes(end, TIMELINE_START_MINUTES, TIMELINE_END_MINUTES);
      const left = ((clippedStart - TIMELINE_START_MINUTES) / TIMELINE_TOTAL_MINUTES) * 100;
      const width = ((clippedEnd - clippedStart) / TIMELINE_TOTAL_MINUTES) * 100;

      if (width <= 0) return null;

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

const HEADER_CHEVRON_WIDTH = 28;
const HEADER_ROW_HEIGHT = 44;

function DayHeader({ dayLabel, isActive, onToggle, detailsOpen, onToggleDetails }) {
  return (
    <Group
      justify="space-between"
      align="center"
      wrap="nowrap"
      gap="md"
      style={{
        width: '100%',
        minHeight: HEADER_ROW_HEIGHT,
        paddingInline: 16,
      }}
    >
      <Group align="center" gap="sm" wrap="nowrap" style={{ minHeight: HEADER_ROW_HEIGHT }}>
        <Text w={88} size="sm" fw={700} c="dark.8">
          {dayLabel}
        </Text>
        <Box
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Switch
            checked={isActive}
            onChange={(e) => onToggle(e.currentTarget.checked)}
            size="sm"
            aria-label={dayLabel}
          />
        </Box>
      </Group>

      <Box style={{ width: HEADER_CHEVRON_WIDTH, display: 'flex', justifyContent: 'center' }}>
        <ActionIcon
          size="sm"
          variant="subtle"
          onClick={onToggleDetails}
          aria-label={detailsOpen ? 'Details ausblenden' : 'Details einblenden'}
          style={{ opacity: isActive ? 1 : 0, transition: 'opacity 150ms ease' }}
        >
          <IconChevronDown
            size={16}
            style={{
              transform: detailsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 150ms ease',
            }}
          />
        </ActionIcon>
      </Box>
    </Group>
  );
}

function DayControl({ dayLabel, dayData, onToggle, onTimeChange, onAddSegment, onAddSegmentAt, onRemoveSegment }) {
  const isActive = !!dayData;
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const segments = React.useMemo(
    () => (isActive ? dayData.segments || [] : []),
    [isActive, dayData?.segments]
  );

  const timelineRef = React.useRef(null);
  const dragStateRef = React.useRef(null);
  const segmentsRef = React.useRef(segments);
  const onTimeChangeRef = React.useRef(onTimeChange);
  const [draftValues, setDraftValues] = React.useState({});
  const [hoveredBlockIndex, setHoveredBlockIndex] = React.useState(null);

  React.useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  React.useEffect(() => {
    onTimeChangeRef.current = onTimeChange;
  }, [onTimeChange]);

  React.useEffect(() => {
    if (!isActive) {
      setDetailsOpen(false);
    }
  }, [isActive]);

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

  const timelineBlocks = React.useMemo(() => getTimelineBlocks(segments), [segments]);

  const timelineMarkers = React.useMemo(() => {
    const markers = [];

    for (let minute = TIMELINE_START_MINUTES; minute <= TIMELINE_END_MINUTES; minute += 30) {
      markers.push(minute);
    }

    return markers;
  }, []);

  const timelineLabels = React.useMemo(() => ([
    { minute: TIMELINE_START_MINUTES, label: '06:00' },
    { minute: 9 * 60, label: '09:00' },
    { minute: 12 * 60, label: '12:00' },
    { minute: 15 * 60, label: '15:00' },
    { minute: 18 * 60, label: '18:00' },
  ]), []);

  const getPointerMinutes = React.useCallback((clientX, snapMinutes = 15, roundMode = 'round') => {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return null;

    const x = clampMinutes(clientX - rect.left, 0, rect.width);
    const rawMinutes = TIMELINE_START_MINUTES + ((x / rect.width) * TIMELINE_TOTAL_MINUTES);
    const rounder = roundMode === 'floor' ? Math.floor : Math.round;
    return rounder(rawMinutes / snapMinutes) * snapMinutes;
  }, []);

  const finishDrag = React.useCallback(() => {
    if (dragStateRef.current) {
      console.log('[Drag] finishDrag – mode was:', dragStateRef.current.mode);
    }
    dragStateRef.current = null;
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, []);

  const handleDragMove = React.useCallback((event) => {
    const dragState = dragStateRef.current;
    if (!dragState) return;

    const nextPointerMinutes = getPointerMinutes(event.clientX);
    if (nextPointerMinutes === null) {
      console.log('[Drag] handleDragMove – getPointerMinutes returned null, clientX:', event.clientX);
      return;
    }

    const currentSegment = segmentsRef.current[dragState.segmentIndex];
    if (!currentSegment) {
      console.log('[Drag] handleDragMove – no segment at index', dragState.segmentIndex);
      return;
    }

    const currentStart = timeToMinutes(currentSegment.booking_start);
    const currentEnd = timeToMinutes(currentSegment.booking_end);
    if (currentStart === null || currentEnd === null) return;

    let nextStart = currentStart;
    let nextEnd = currentEnd;

    if (dragState.mode === 'move') {
      nextStart = clampMinutes(nextPointerMinutes - dragState.offset, TIMELINE_START_MINUTES, TIMELINE_END_MINUTES - dragState.duration);
      nextEnd = nextStart + dragState.duration;
    } else if (dragState.mode === 'resize-start') {
      nextStart = clampMinutes(nextPointerMinutes, TIMELINE_START_MINUTES, currentEnd - 15);
    } else if (dragState.mode === 'resize-end') {
      nextEnd = clampMinutes(nextPointerMinutes, currentStart + 15, TIMELINE_END_MINUTES);
    }

    console.log('[Drag] move – mode:', dragState.mode, 'ptr:', nextPointerMinutes, 'next:', minutesToTime(nextStart), '–', minutesToTime(nextEnd));

    onTimeChangeRef.current(dragState.segmentIndex, {
      start: minutesToTime(nextStart),
      end: minutesToTime(nextEnd),
    });
  }, [getPointerMinutes]);

  React.useEffect(() => {
    console.log('[Drag] registering document drag listeners');
    const handleMouseMove = (event) => handleDragMove(event);
    const handlePointerMove = (event) => {
      // skip synthetic pointer events that duplicate mouse events
      if (event.pointerType === 'mouse') return;
      handleDragMove(event);
    };
    const handleMouseUp = () => finishDrag();
    const handlePointerUp = (event) => {
      if (event.pointerType === 'mouse') return;
      finishDrag();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('pointerup', handlePointerUp);

    return () => {
      console.log('[Drag] removing document drag listeners');
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [finishDrag, handleDragMove]);

  const startDrag = React.useCallback((mode, segmentIndex, event) => {
    // For mouse: pointerdown fires before mousedown – skip duplicate
    if (event.type === 'pointerdown' && event.pointerType === 'mouse') return;
    if (dragStateRef.current) return;
    event.preventDefault();
    event.stopPropagation();

    const segment = segments[segmentIndex];
    if (!segment) {
      console.log('[Drag] startDrag – no segment at index', segmentIndex);
      return;
    }

    const startMinutes = timeToMinutes(segment.booking_start);
    const endMinutes = timeToMinutes(segment.booking_end);
    if (startMinutes === null || endMinutes === null) {
      console.log('[Drag] startDrag – invalid segment times', segment.booking_start, segment.booking_end);
      return;
    }

    const pointerMinutes = getPointerMinutes(event.clientX);
    if (pointerMinutes === null) {
      console.log('[Drag] startDrag – getPointerMinutes returned null, clientX:', event.clientX);
      return;
    }

    console.log('[Drag] startDrag – mode:', mode, 'segment:', segmentIndex, 'ptr:', pointerMinutes, 'start:', startMinutes, 'end:', endMinutes);

    dragStateRef.current = {
      mode,
      segmentIndex,
      offset: pointerMinutes - startMinutes,
      duration: endMinutes - startMinutes,
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = mode === 'move' ? 'grabbing' : 'ew-resize';
  }, [getPointerMinutes, segments]);

  const canAddSegmentAt = React.useCallback((startMinutes) => {
    const candidateStart = clampMinutes(startMinutes, TIMELINE_START_MINUTES, TIMELINE_END_MINUTES - 30);
    const candidateEnd = candidateStart + 30;

    return !segments.some((segment) => {
      const start = timeToMinutes(segment.booking_start);
      const end = timeToMinutes(segment.booking_end);
      if (start === null || end === null || end <= start) return false;

      // For click-add we disallow overlap and direct adjacency.
      return candidateStart <= end && candidateEnd >= start;
    });
  }, [segments]);

  const handleTimelinePointerDown = React.useCallback((event) => {
    // For mouse, let onMouseDown handle it to avoid double-firing
    if (event.pointerType === 'mouse') return;
    if (event.target !== event.currentTarget) return;
    const pointerMinutes = getPointerMinutes(event.clientX, 30, 'floor');
    if (pointerMinutes === null) return;
    console.log('[Click-add] pointerdown – pointerMinutes:', pointerMinutes, 'canAdd:', canAddSegmentAt(pointerMinutes));
    if (!canAddSegmentAt(pointerMinutes)) return;
    onAddSegmentAt?.(pointerMinutes);
  }, [canAddSegmentAt, getPointerMinutes, onAddSegmentAt]);

  const handleTimelineMouseDown = React.useCallback((event) => {
    if (event.target !== event.currentTarget) return;
    const rect = timelineRef.current?.getBoundingClientRect();
    const pointerMinutes = getPointerMinutes(event.clientX, 30, 'floor');
    if (pointerMinutes === null) return;
    console.log('[Click-add] mousedown – clientX:', event.clientX, 'rect.left:', rect?.left, 'pointerMinutes:', pointerMinutes, 'canAdd:', canAddSegmentAt(pointerMinutes));
    if (!canAddSegmentAt(pointerMinutes)) return;
    onAddSegmentAt?.(pointerMinutes);
  }, [canAddSegmentAt, getPointerMinutes, onAddSegmentAt]);

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

    onTimeChange(index, { start: normalizedStart, end: normalizedEnd });
  }

  const toggleDetails = React.useCallback(() => {
    setDetailsOpen((previous) => !previous);
  }, []);

  return (
    <Box
      py="xs"
      style={{
        borderBottom: '1px solid var(--mantine-color-gray-2)',
      }}
    >
      <DayHeader
        dayLabel={dayLabel}
        isActive={isActive}
        onToggle={onToggle}
        detailsOpen={detailsOpen}
        onToggleDetails={toggleDetails}
      />

      {isActive && (
        <Stack gap="md" pt="md">
          <Stack gap={2}>
            <Box
              ref={timelineRef}
              style={{
                position: 'relative',
                height: 42,
                borderRadius: 12,
                overflow: 'hidden',
                border: '1px solid var(--mantine-color-gray-3)',
                background: 'linear-gradient(90deg, rgba(8,55,67,0.04) 0%, rgba(242,110,46,0.04) 100%)',
                cursor: 'crosshair',
              }}
              onPointerDown={handleTimelinePointerDown}
              onMouseDown={handleTimelineMouseDown}
            >
              {timelineMarkers.map((minute) => (
                <Box
                  key={minute}
                  style={{
                    position: 'absolute',
                    left: `${((minute - TIMELINE_START_MINUTES) / TIMELINE_TOTAL_MINUTES) * 100}%`,
                    top: 0,
                    bottom: 0,
                    width: minute % 60 === 0 ? 1.5 : 1,
                    background: minute % 60 === 0 ? 'rgba(8,55,67,0.22)' : 'rgba(8,55,67,0.12)',
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
                    onMouseEnter={() => setHoveredBlockIndex(block.index)}
                    onMouseLeave={() => setHoveredBlockIndex((previous) => (previous === block.index ? null : previous))}
                    aria-label={`Segment ${block.index + 1} verschieben`}
                    style={{
                      position: 'absolute',
                      left: `${block.left}%`,
                      top: 6,
                      height: 30,
                      width: `${Math.max(block.width, 2)}%`,
                      borderRadius: 0,
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
                      paddingInline: 18,
                      whiteSpace: 'nowrap',
                      overflow: 'visible',
                      textOverflow: 'ellipsis',
                      touchAction: 'none',
                      userSelect: 'none',
                      cursor: 'grab',
                    }}
                    onPointerDown={(event) => startDrag('move', block.index, event)}
                    onMouseDown={(event) => startDrag('move', block.index, event)}
                  >
                    {segments.length > 1 && (
                      <ActionIcon
                        size="xs"
                        variant="light"
                        color="red"
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();

                          if (window.confirm(`Segment ${block.index + 1} wirklich löschen?`)) {
                            onRemoveSegment(block.index);
                          }
                        }}
                        aria-label={`Segment ${block.index + 1} löschen`}
                        style={{
                          position: 'absolute',
                          top: -7,
                          right: -7,
                          opacity: hoveredBlockIndex === block.index ? 1 : 0,
                          pointerEvents: hoveredBlockIndex === block.index ? 'auto' : 'none',
                          transition: 'opacity 120ms ease',
                          zIndex: 2,
                          cursor: 'pointer',
                        }}
                      >
                        <IconTrash size={10} />
                      </ActionIcon>
                    )}
                    <Box
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 12,
                        cursor: 'ew-resize',
                        background: 'rgba(255,255,255,0.15)',
                        zIndex: 1,
                        touchAction: 'none',
                      }}
                      aria-label={`Segment ${block.index + 1} Start ändern`}
                      onPointerDown={(event) => startDrag('resize-start', block.index, event)}
                      onMouseDown={(event) => startDrag('resize-start', block.index, event)}
                    />
                    {block.width >= 12 && (
                      <Text size="inherit" style={{ pointerEvents: 'none' }}>
                        {block.startLabel}–{block.endLabel}
                      </Text>
                    )}
                    <Box
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: 12,
                        cursor: 'ew-resize',
                        background: 'rgba(255,255,255,0.15)',
                        zIndex: 1,
                        touchAction: 'none',
                      }}
                      aria-label={`Segment ${block.index + 1} Ende ändern`}
                      onPointerDown={(event) => startDrag('resize-end', block.index, event)}
                      onMouseDown={(event) => startDrag('resize-end', block.index, event)}
                    />
                  </Box>
                </Tooltip>
              ))}
            </Box>

            <Box
              style={{
                position: 'relative',
                height: 16,
                marginInline: 2,
              }}
            >
              {timelineLabels.map(({ minute, label }) => {
                const position = ((minute - TIMELINE_START_MINUTES) / TIMELINE_TOTAL_MINUTES) * 100;
                const isStart = minute === TIMELINE_START_MINUTES;
                const isEnd = minute === TIMELINE_END_MINUTES;

                return (
                  <Text
                    key={minute}
                    size="10px"
                    c="dimmed"
                    style={{
                      position: 'absolute',
                      left: `${position}%`,
                      transform: isStart ? 'translateX(0)' : isEnd ? 'translateX(-100%)' : 'translateX(-50%)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {label}
                  </Text>
                );
              })}
            </Box>
          </Stack>

          {detailsOpen && (
            <Stack gap="sm">
              {segments.map((segment, idx) => {
                const draft = getDraftForSegment(segment, idx);
                const isValid = timeToMinutes(draft.start) !== null && timeToMinutes(draft.end) !== null && (timeToMinutes(draft.end) > timeToMinutes(draft.start));

                return (
                  <Paper key={segment.id || idx} withBorder radius="md" p="xs" bg="white" style={{ borderColor: 'var(--mantine-color-gray-3)' }}>
                    <Group justify="space-between" align="center" wrap="nowrap" gap="sm">
                      <Text size="sm" fw={600} c="dark.8" style={{ whiteSpace: 'nowrap', minWidth: 88, flexShrink: 0 }}>
                        Segment {idx + 1}
                      </Text>
                      <Group align="center" wrap="nowrap" gap="xs" style={{ flex: 1, minWidth: 0 }}>
                        <TextInput
                          size="xs"
                          value={draft.start}
                          onChange={(event) => updateDraft(segment, idx, { start: event.currentTarget.value })}
                          onBlur={() => commitRange(idx, draft.start, draft.end)}
                          placeholder="08:00"
                          aria-label={`Segment ${idx + 1} Startzeit`}
                          error={!isValid && draft.start && draft.end ? 'Ungültig' : null}
                          style={{ width: 116, flexShrink: 0 }}
                        />
                        <Text size="sm" fw={600} c="dimmed" style={{ whiteSpace: 'nowrap', lineHeight: 1, flexShrink: 0 }}>
                          -
                        </Text>
                        <TextInput
                          size="xs"
                          value={draft.end}
                          onChange={(event) => updateDraft(segment, idx, { end: event.currentTarget.value })}
                          onBlur={() => commitRange(idx, draft.start, draft.end)}
                          placeholder="12:00"
                          aria-label={`Segment ${idx + 1} Endzeit`}
                          error={!isValid && draft.start && draft.end ? 'Ungültig' : null}
                          style={{ width: 116, flexShrink: 0 }}
                        />
                      </Group>
                      {segments.length > 1 && (
                        <ActionIcon
                          variant="light"
                          color="red"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            if (window.confirm(`Segment ${idx + 1} wirklich löschen?`)) {
                              onRemoveSegment(idx);
                            }
                          }}
                          size="sm"
                          aria-label={`Segment ${idx + 1} entfernen`}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      )}
                    </Group>
                  </Paper>
                );
              })}

              <Button variant="light" leftSection={<IconPlus size={14} />} onClick={onAddSegment} size="sm">
                Segment hinzufügen
              </Button>
            </Stack>
          )}
        </Stack>
      )}
    </Box>
  );
}

export default DayControl;