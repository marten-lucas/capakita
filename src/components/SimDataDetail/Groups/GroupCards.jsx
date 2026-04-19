import React from 'react';
import { Text } from '@mantine/core';

function GroupCards({ item }) {
  const group = item || {};
  const { start, end, name } = group;
  let dateRangeText = '';
  if (start && end) {
    dateRangeText = `von ${start} bis ${end}`;
  } else if (start) {
    dateRangeText = `ab ${start}`;
  } else if (end) {
    dateRangeText = `bis ${end}`;
  }

  return (
    <Text size="sm" fw={500}>
      {(name || 'Gruppenzuordnung')}{dateRangeText ? `: ${dateRangeText}` : ''}
    </Text>
  );
}

export default GroupCards;
