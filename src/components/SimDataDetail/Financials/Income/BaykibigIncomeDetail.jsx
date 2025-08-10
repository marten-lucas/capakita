import React from 'react';
import { Box, TextField, Typography } from '@mui/material';

function BaykibigIncomeDetail({ financial, onChange }) {
  // For now, just show info and valid_from/to
  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Typography variant="body2">
        Die BayKiBiG-Förderung wird automatisch berechnet. (Stub)
      </Typography>
      <Box display="flex" gap={2}>
        <TextField
          label="Gültig von"
          type="date"
          value={financial.valid_from || ''}
          onChange={e => onChange({ ...financial, valid_from: e.target.value })}
          InputLabelProps={{ shrink: true }}
          size="small"
          sx={{ maxWidth: 180 }}
        />
        <TextField
          label="Gültig bis"
          type="date"
          value={financial.valid_to || ''}
          onChange={e => onChange({ ...financial, valid_to: e.target.value })}
          InputLabelProps={{ shrink: true }}
          size="small"
          sx={{ maxWidth: 180 }}
        />
      </Box>
    </Box>
  );
}

export default BaykibigIncomeDetail;
