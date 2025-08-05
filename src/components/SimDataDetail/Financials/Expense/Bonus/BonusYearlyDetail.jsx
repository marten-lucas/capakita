import React from 'react';
import { Typography, Box } from '@mui/material';
import { getAvrBonusByType } from '../../../../../utils/financialCalculators/avrUtils';

function BonusYearlyDetail({ parent }) {
  // Debug: log parent prop
  console.log("[BonusYearlyDetail] parent prop:", parent);

  // If parent is an AVR expense, show AVR bonus data
  let avrBonus = null;
  if (parent && parent.type === 'expense-avr') {
    // Use parent's from date or today as reference
    const referenceDate = parent.from || new Date().toISOString().slice(0, 10);
    avrBonus = getAvrBonusByType('bonus-yearly', referenceDate);
  }

  return (
    <Box>
      {avrBonus ? (
        <Box>
          <Typography variant="body2">
            Prozentsätze: {Array.isArray(avrBonus.percentage)
              ? avrBonus.percentage.map(p =>
                  `${(p.value * 100).toFixed(0)}% (Gruppe ${p.from_group} bis Stufe ${p.to_stage})`
                ).join(', ')
              : ''}
          </Typography>
          <Typography variant="body2">
            Auszahlung: {avrBonus.payable === 'yearly' ? 'jährlich' : avrBonus.payable}
          </Typography>
          <Typography variant="body2">
            Fällig im Monat: {avrBonus.due_month}
          </Typography>
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary">
          keine weiteren Angaben erforderlich.
        </Typography>
      )}
    </Box>
  );
}

export default BonusYearlyDetail;
