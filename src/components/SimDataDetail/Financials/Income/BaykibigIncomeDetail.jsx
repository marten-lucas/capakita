import React from 'react';
import { Box, Typography } from '@mui/material';
import DateRangePicker from '../../../../components/common/DateRangePicker';

function BaykibigIncomeDetail({ financial, onChange }) {
  // Handler for updating both valid_from and valid_to via DateRangePicker
  const handleDateRangeChange = (range) => {
    onChange({
      ...financial,
      valid_from: range.start || '',
      valid_to: range.end || ''
    });
  };

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Typography variant="body2">
        Die BayKiBiG-Förderung wird automatisch berechnet. (Stub)
      </Typography>
      <Box display="flex" gap={2}>
        <DateRangePicker
          value={{ start: financial.valid_from || '', end: financial.valid_to || '' }}
          onChange={handleDateRangeChange}
        />
      </Box>
    </Box>
  );
}

export default BaykibigIncomeDetail;
