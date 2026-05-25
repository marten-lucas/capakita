import React from 'react';
import { Text } from '@mantine/core';
import { timeToMinutes } from '../../../utils/timeUtils';

function GroupCards({ item }) {
  const group = item || {};
  const { start, end, name, assignmentMode } = group;
  let dateRangeText = '';
  if (start && end) {
    dateRangeText = `von ${start} bis ${end}`;
  } else if (start) {
    dateRangeText = `ab ${start}`;
  } else if (end) {
    dateRangeText = `bis ${end}`;
  }

  if (assignmentMode === 'multiple') {
    const segments = Array.isArray(group.timeSegments) ? group.timeSegments : [];
    const sorted = segments
      .filter((segment) => timeToMinutes(segment?.startTime) !== null && timeToMinutes(segment?.endTime) !== null)
      .sort((left, right) => timeToMinutes(left.startTime) - timeToMinutes(right.startTime));

    const timeRange = sorted.length > 0
      ? `${sorted[0].startTime}-${sorted[sorted.length - 1].endTime}`
      : null;

    return (
      <Text size="sm" fw={500}>
        Mehrere Gruppen ({segments.length} Segmente)
        {timeRange ? `, ${timeRange}` : ''}
        {dateRangeText ? `: ${dateRangeText}` : ''}
      </Text>
    );
  }

  return (
    <Text size="sm" fw={500}>
      {(name || 'Gruppenzuordnung')}{dateRangeText ? `: ${dateRangeText}` : ''}
    </Text>
  );
}

export default GroupCards;
