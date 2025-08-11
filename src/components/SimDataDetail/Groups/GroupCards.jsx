import { Typography } from '@mui/material';
import React from 'react';

// This is now just the summary component for a group assignment
function GroupCards({ item }) {
  // Accept both {item} and {group} for compatibility
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
    <Typography variant="subtitle1">
      {(name || 'Gruppenzuordnung')}{dateRangeText ? `: ${dateRangeText}` : ''}
    </Typography>
  );
}

export default GroupCards;