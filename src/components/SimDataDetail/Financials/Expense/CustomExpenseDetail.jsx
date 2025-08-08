import React, { useState, useEffect } from 'react';
import { Box, TextField } from '@mui/material';

function CustomExpenseDetail({ financial, onChange }) {
  // Extract type_details for editing
  const typeDetails = financial.type_details || {};
  
  // Local state for form values
  const [localValues, setLocalValues] = useState({
    valid_from: financial.valid_from || '',
    valid_to: financial.valid_to || '',
    Amount: typeDetails.Amount || ''
  });

  // Update local state when financial prop changes
  useEffect(() => {
    setLocalValues({
      valid_from: financial.valid_from || '',
      valid_to: financial.valid_to || '',
      Amount: typeDetails.Amount || ''
    });
  }, [financial.valid_from, financial.valid_to, typeDetails.Amount]);

  // Handler for updating root-level fields (valid_from, valid_to)
  const updateRootFields = (updates) => {
    onChange({
      ...financial,
      ...updates
    });
  };

  // Handler for updating type_details
  const updateTypeDetails = (updates) => {
    onChange({
      ...financial,
      type_details: { ...typeDetails, ...updates }
    });
  };

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      {/* Valid from/to fields */}
      <Box display="flex" gap={2}>
        <TextField
          label="Gültig von"
          type="date"
          value={localValues.valid_from}
          onChange={e => setLocalValues(prev => ({ ...prev, valid_from: e.target.value }))}
          onBlur={e => updateRootFields({ valid_from: e.target.value })}
          InputLabelProps={{ shrink: true }}
          size="small"
          sx={{ maxWidth: 180 }}
        />
        <TextField
          label="Gültig bis"
          type="date"
          value={localValues.valid_to}
          onChange={e => setLocalValues(prev => ({ ...prev, valid_to: e.target.value }))}
          onBlur={e => updateRootFields({ valid_to: e.target.value })}
          InputLabelProps={{ shrink: true }}
          size="small"
          sx={{ maxWidth: 180 }}
        />
      </Box>

      {/* Custom amount field */}
      <TextField
        label="Betrag (€)"
        type="number"
        value={localValues.Amount}
        onChange={e => setLocalValues(prev => ({ ...prev, Amount: e.target.value }))}
        onBlur={e => updateTypeDetails({ Amount: Number(e.target.value) })}
        size="small"
        sx={{ maxWidth: 180 }}
        inputProps={{ min: 0, step: 0.01 }}
        helperText="Monatlicher Festbetrag"
      />
    </Box>
  );
}

export default CustomExpenseDetail;
