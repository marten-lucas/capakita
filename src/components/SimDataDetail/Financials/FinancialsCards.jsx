import { Typography } from '@mui/material';
import React from 'react';

// Summary component for a financial entry
function FinancialsCards({ item }) {
  return (
    <Typography variant="subtitle1">
      {item.label || item.type} {item.amount ? `: ${item.amount} €` : ''}
    </Typography>
  );
}

export default FinancialsCards;

  