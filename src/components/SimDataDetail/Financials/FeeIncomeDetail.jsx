import React from 'react';
import { Box, TextField, Typography, IconButton, Button } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { feeIncomeCalculator } from '../../../utils/financialCalculators/feeIncomeCalculator';

function FeeIncomeDetail({ financial, onChange, onDelete, item }) {
  // Only use feeIncomeCalculator here
  const { calculatedAmount } = feeIncomeCalculator({ financial, item });

  return (
    <Box display="flex" flexDirection="column" gap={2} position="relative">
      <IconButton
        aria-label="Entfernen"
        onClick={onDelete}
        size="small"
        sx={{ position: 'absolute', top: 0, right: 0 }}
      >
        <DeleteIcon fontSize="small" />
      </IconButton>
      <Typography variant="body2">{financial.label}</Typography>
      <TextField
        label="Betrag (€)"
        type="number"
        size="small"
        value={financial.amount}
        onChange={e => onChange({ ...financial, amount: e.target.value })}
        sx={{ maxWidth: 180 }}
      />
      {/* ...other fields as needed... */}
      <Button
        variant="outlined"
        color="error"
        size="small"
        onClick={onDelete}
      >
        Entfernen
      </Button>
    </Box>
  );
}

export default FeeIncomeDetail;
