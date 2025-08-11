import React, { useState, useEffect } from 'react';
import { Box, TextField } from '@mui/material';
import DateRangePicker from '../../../../components/common/DateRangePicker';

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

  // Handler for updating both valid_from and valid_to via DateRangePicker
  const handleDateRangeChange = (range) => {
    setLocalValues(prev => ({
      ...prev,
      valid_from: range.start || '',
      valid_to: range.end || ''
    }));
    updateRootFields({
      valid_from: range.start || '',
      valid_to: range.end || ''
    });
  };

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      {/* Valid from/to fields */}
      <Box display="flex" gap={2}>
        <DateRangePicker
          value={{ start: localValues.valid_from, end: localValues.valid_to }}
          onChange={handleDateRangeChange}
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
