import React from 'react';
import { ActionIcon, Box, Button, Checkbox, Divider, Group, Menu, NumberInput, Paper, SegmentedControl, Stack, Switch, Text, TextInput, Tooltip } from '@mantine/core';
import { IconBriefcase, IconChevronDown, IconPlus, IconUser, IconUsers, IconTrash } from '@tabler/icons-react';
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

function getSegmentGroupIds(segment) {
  if (Array.isArray(segment?.groupAllocations) && segment.groupAllocations.length > 0) {
    return segment.groupAllocations
      .map((allocation) => String(allocation.groupId || ''))
      .filter(Boolean);
  }
  if (segment?.groupId) return [String(segment.groupId)];
  return [];
}

function getSegmentAllocations(segment) {
  if (Array.isArray(segment?.groupAllocations) && segment.groupAllocations.length > 0) {
    return segment.groupAllocations
      .map((entry) => ({ groupId: String(entry.groupId || ''), share: Number(entry.share) || 0 }))
      .filter((entry) => entry.groupId);
  }
  if (segment?.groupId) {
    return [{ groupId: String(segment.groupId), share: 100 }];
  }
  return [];
}

function distributeEvenly(groupIds) {
  const normalized = Array.from(new Set((groupIds || []).map((id) => String(id)).filter(Boolean)));
  if (normalized.length === 0) return [];
  const base = Math.floor(100 / normalized.length);
  const rest = 100 - (base * normalized.length);
  return normalized.map((groupId, index) => ({
    groupId,
    share: base + (index < rest ? 1 : 0),
  }));
}

function clampMinutes(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const HEADER_CHEVRON_WIDTH = 28;
const HEADER_ROW_HEIGHT = 54;

function DayHeader({ dayLabel, isActive, onToggle, detailsOpen, onToggleDetails }) {
  return (
    <Group
      justify="space-between"
      align="center"
      wrap="wrap"
      gap="md"
      style={{
        width: '100%',
        minHeight: HEADER_ROW_HEIGHT,
        paddingInline: 16,
      }}
    >
      <Group align="center" gap="sm" wrap="wrap" style={{ minHeight: HEADER_ROW_HEIGHT }}>
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

function DayControl({
  dayLabel,
  dayData,
  onToggle,
  onTimeChange,
  onAddSegment,
  onAddSegmentAt,
  onRemoveSegment,
  onCategoryChange,
  allowCategorySelection = false,
  allowGroupSelection = false,
  groupOptions = [],
  onSegmentAllocationsChange,
}) {
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
  const groupLabelById = React.useMemo(
    () => Object.fromEntries((groupOptions || []).map((option) => [String(option.value), option.label])),
    [groupOptions]
  );
  const [openGroupMenuIndex, setOpenGroupMenuIndex] = React.useState(null);

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
    dragStateRef.current = null;
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, []);

  const handleDragMove = React.useCallback((event) => {
    const dragState = dragStateRef.current;
    if (!dragState) return;

    const nextPointerMinutes = getPointerMinutes(event.clientX);
    if (nextPointerMinutes === null) return;

    const currentSegment = segmentsRef.current[dragState.segmentIndex];
    if (!currentSegment) return;

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

    onTimeChangeRef.current(dragState.segmentIndex, {
      start: minutesToTime(nextStart),
      end: minutesToTime(nextEnd),
    });
  }, [getPointerMinutes]);

  React.useEffect(() => {
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
    if (!canAddSegmentAt(pointerMinutes)) return;
    onAddSegmentAt?.(pointerMinutes);
  }, [canAddSegmentAt, getPointerMinutes, onAddSegmentAt]);

  const handleTimelineMouseDown = React.useCallback((event) => {
    if (event.target !== event.currentTarget) return;
    const pointerMinutes = getPointerMinutes(event.clientX, 30, 'floor');
    if (pointerMinutes === null) return;
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

  const updateSegmentAllocations = React.useCallback((segmentIndex, allocations) => {
    const normalized = (allocations || [])
      .map((entry) => ({ groupId: String(entry.groupId || ''), share: Number(entry.share) || 0 }))
      .filter((entry) => entry.groupId);
    onSegmentAllocationsChange?.(segmentIndex, normalized);
  }, [onSegmentAllocationsChange]);

  const toggleSegmentGroup = React.useCallback((segmentIndex, groupId, checked) => {
    const segment = segments[segmentIndex];
    if (!segment) return;
    const currentAllocations = getSegmentAllocations(segment);
    const selectedIds = new Set(currentAllocations.map((entry) => entry.groupId));

    if (checked) {
      selectedIds.add(String(groupId));
    } else {
      selectedIds.delete(String(groupId));
    }

    updateSegmentAllocations(segmentIndex, distributeEvenly(Array.from(selectedIds)));
  }, [segments, updateSegmentAllocations]);

  const setSegmentShare = React.useCallback((segmentIndex, groupId, nextShare) => {
    const segment = segments[segmentIndex];
    if (!segment) return;
    const currentAllocations = getSegmentAllocations(segment);
    const updated = currentAllocations.map((entry) => (
      entry.groupId === String(groupId)
        ? { ...entry, share: Math.max(0, Math.min(100, Number(nextShare) || 0)) }
        : entry
    ));
    updateSegmentAllocations(segmentIndex, updated);
  }, [segments, updateSegmentAllocations]);

  return (
    <Box
      py="sm"
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
                height: 68,
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
                  label={(() => {
                    const segment = segments[block.index];
                    const segmentGroupIds = getSegmentGroupIds(segment);
                    const label = segmentGroupIds
                      .map((groupId) => groupLabelById[groupId] || groupId)
                      .join(', ');
                    return label
                      ? `${block.startLabel} - ${block.endLabel} | ${label}`
                      : `${block.startLabel} - ${block.endLabel}`;
                  })()}
                  withArrow
                >
                  <Box
                    onMouseEnter={() => setHoveredBlockIndex(block.index)}
                    onMouseLeave={() => setHoveredBlockIndex((previous) => (previous === block.index ? null : previous))}
                    aria-label={`Segment ${block.index + 1} verschieben`}
                    style={{
                      position: 'absolute',
                      left: `${block.left}%`,
                      top: 8,
                      height: 46,
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
                      fontSize: 12,
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
                    {allowCategorySelection && (
                      <ActionIcon
                        size={20}
                        variant="filled"
                        color={block.category === 'administrative' ? 'violet' : 'blue'}
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
                          const nextCategory = block.category === 'administrative' ? 'pedagogical' : 'administrative';
                          onCategoryChange?.(block.index, nextCategory);
                        }}
                        aria-label={`Segment ${block.index + 1} Kategorie umschalten`}
                        style={{
                          position: 'absolute',
                          top: -10,
                          left: -10,
                          zIndex: 2,
                          cursor: 'pointer',
                        }}
                      >
                        {block.category === 'administrative'
                          ? <IconBriefcase size={11} />
                          : <IconUser size={11} />}
                      </ActionIcon>
                    )}
                    {allowGroupSelection && (
                      <Menu
                        opened={openGroupMenuIndex === block.index}
                        onChange={(opened) => setOpenGroupMenuIndex(opened ? block.index : null)}
                        withinPortal
                        closeOnItemClick={false}
                        position="bottom-start"
                        offset={6}
                      >
                        <Menu.Target>
                          <Box
                            style={{
                              position: 'absolute',
                              bottom: -10,
                              left: -10,
                              zIndex: 2,
                              cursor: 'pointer',
                            }}
                          >
                            <ActionIcon
                              size={22}
                              variant="filled"
                              color="teal"
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
                              }}
                              aria-label={`Segment ${block.index + 1} Gruppenmenü`}
                            >
                              <IconUsers size={13} />
                            </ActionIcon>
                            {(() => {
                              const segment = segments[block.index];
                              const groupCount = getSegmentGroupIds(segment).length;
                              if (groupCount <= 1) return null;
                              return (
                                <Box
                                  style={{
                                    position: 'absolute',
                                    top: -5,
                                    right: -5,
                                    minWidth: 14,
                                    height: 14,
                                    borderRadius: 999,
                                    background: 'var(--mantine-color-dark-7)',
                                    color: 'white',
                                    fontSize: 9,
                                    fontWeight: 700,
                                    lineHeight: '14px',
                                    textAlign: 'center',
                                    paddingInline: 3,
                                  }}
                                >
                                  {groupCount}
                                </Box>
                              );
                            })()}
                          </Box>
                        </Menu.Target>

                        <Menu.Dropdown
                          onPointerDown={(event) => event.stopPropagation()}
                          onMouseDown={(event) => event.stopPropagation()}
                        >
                          <Box px="xs" py={6}>
                            <Text size="xs" fw={700}>Gruppen und Prozent</Text>
                          </Box>
                          <Divider />
                          <Box px="xs" py="xs" style={{ minWidth: 260, maxHeight: 260, overflowY: 'auto' }}>
                            {groupOptions.length === 0 ? (
                              <Text size="xs" c="dimmed">Keine Gruppen vorhanden.</Text>
                            ) : (
                              <Stack gap={6}>
                                {groupOptions.map((option) => {
                                  const segment = segments[block.index];
                                  const allocations = getSegmentAllocations(segment);
                                  const entry = allocations.find((allocation) => allocation.groupId === String(option.value));
                                  const checked = Boolean(entry);
                                  return (
                                    <Box key={`${block.index}-${option.value}`}>
                                      <Group justify="space-between" align="center" wrap="nowrap" gap="xs">
                                        <Checkbox
                                          checked={checked}
                                          label={option.label}
                                          onChange={(event) => toggleSegmentGroup(block.index, option.value, event.currentTarget.checked)}
                                        />
                                        {checked && (
                                          <NumberInput
                                            value={entry?.share ?? 0}
                                            onChange={(value) => setSegmentShare(block.index, option.value, value)}
                                            min={0}
                                            max={100}
                                            step={5}
                                            size="xs"
                                            style={{ width: 90 }}
                                            suffix=" %"
                                          />
                                        )}
                                      </Group>
                                    </Box>
                                  );
                                })}
                                <Button
                                  size="xs"
                                  variant="light"
                                  onClick={() => {
                                    const segment = segments[block.index];
                                    const allocations = getSegmentAllocations(segment);
                                    updateSegmentAllocations(block.index, distributeEvenly(allocations.map((entry) => entry.groupId)));
                                  }}
                                >
                                  Gleich verteilen
                                </Button>
                              </Stack>
                            )}
                          </Box>
                        </Menu.Dropdown>
                      </Menu>
                    )}
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
                        {(() => {
                          const segment = segments[block.index];
                          const segmentGroupIds = getSegmentGroupIds(segment);
                          const firstGroup = segmentGroupIds[0];
                          const firstLabel = firstGroup ? (groupLabelById[firstGroup] || firstGroup) : '';
                          const suffix = segmentGroupIds.length > 1 ? ` +${segmentGroupIds.length - 1}` : '';
                          const groupText = firstLabel ? ` · ${firstLabel}${suffix}` : '';
                          return `${block.startLabel}–${block.endLabel}${groupText}`;
                        })()}
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
                height: 20,
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
                  <Paper key={segment.id || idx} withBorder radius="md" p="md" bg="white" style={{ borderColor: 'var(--mantine-color-gray-3)' }}>
                    <Group justify="space-between" align="center" wrap="wrap" gap="sm">
                      <Text size="sm" fw={600} c="dark.8" style={{ whiteSpace: 'nowrap', minWidth: 88, flexShrink: 0 }}>
                        Segment {idx + 1}
                      </Text>
                      <Group align="center" wrap="wrap" gap="xs" style={{ flex: 1, minWidth: 0 }}>
                        <TextInput
                          size="sm"
                          value={draft.start}
                          onChange={(event) => updateDraft(segment, idx, { start: event.currentTarget.value })}
                          onBlur={() => commitRange(idx, draft.start, draft.end)}
                          placeholder="08:00"
                          aria-label={`Segment ${idx + 1} Startzeit`}
                          error={!isValid && draft.start && draft.end ? 'Ungültig' : null}
                          style={{ width: 132, flexShrink: 0 }}
                        />
                        <Text size="sm" fw={600} c="dimmed" style={{ whiteSpace: 'nowrap', lineHeight: 1, flexShrink: 0 }}>
                          -
                        </Text>
                        <TextInput
                          size="sm"
                          value={draft.end}
                          onChange={(event) => updateDraft(segment, idx, { end: event.currentTarget.value })}
                          onBlur={() => commitRange(idx, draft.start, draft.end)}
                          placeholder="12:00"
                          aria-label={`Segment ${idx + 1} Endzeit`}
                          error={!isValid && draft.start && draft.end ? 'Ungültig' : null}
                          style={{ width: 132, flexShrink: 0 }}
                        />
                        {allowCategorySelection && (
                          <SegmentedControl
                            size="xs"
                            value={segment.category || 'pedagogical'}
                            onChange={(value) => onCategoryChange?.(idx, value)}
                            data={[
                              { label: <IconUser size={14} />, value: 'pedagogical' },
                              { label: <IconBriefcase size={14} />, value: 'administrative' },
                            ]}
                            aria-label={`Segment ${idx + 1} Kategorie`}
                          />
                        )}
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