import React, { useEffect } from 'react';
import { Box, Typography, RadioGroup, FormControlLabel, Radio } from '@mui/material';
import { useSelector } from 'react-redux';
import DateRangePicker from '../../../../components/common/DateRangePicker';

function FeeIncomeDetail({ financial, onChange }) {
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const financialDefs = useSelector(state => state.simFinancials.financialDefsByScenario[selectedScenarioId]) || [];

  // Defensive: ensure type_details is always an object
  const typeDetails = financial.type_details || {};

  // Handler for updating type_details
  const updateTypeDetails = (updates) => {
    onChange({
      ...financial,
      type_details: { ...typeDetails, ...updates }
    });
  };

  // Handler for updating root-level fields (valid_from, valid_to)
  const updateRootFields = (updates) => {
    onChange({
      ...financial,
      ...updates
    });
  };

  // Handler for updating both valid_from and valid_to via DateRangePicker
  const handleDateRangeChange = (range) => {
    updateRootFields({
      valid_from: range.start || '',
      valid_to: range.end || ''
    });
  };

  // Auto-select the first available option if none is selected
  useEffect(() => {
    if (
      financialDefs.length > 0 &&
      (!typeDetails.financialDefId || !financialDefs.some(def => def.id === typeDetails.financialDefId))
    ) {
      updateTypeDetails({ financialDefId: financialDefs[0].id });
    }
    // eslint-disable-next-line
  }, [financialDefs.length, typeDetails.financialDefId]);

  return (
    <Box display="flex" flexDirection="column" gap={2} position="relative">
      {/* Valid from/to fields */}
      <Box display="flex" gap={2}>
        <DateRangePicker
          value={{ start: financial.valid_from || '', end: financial.valid_to || '' }}
          onChange={handleDateRangeChange}
        />
      </Box>

      <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
        Beitragsordnung
      </Typography>

      <RadioGroup
        value={typeDetails.financialDefId || ''}
        onChange={e => updateTypeDetails({ financialDefId: e.target.value })}
      >
        {financialDefs.length === 0 && (
          <Typography variant="caption" color="error">
            Keine Beitragsordnung gefunden.
          </Typography>
        )}
        {financialDefs.map(def => (
          <FormControlLabel
            key={def.id}
            value={def.id}
            control={<Radio />}
            label={def.description || def.name || def.id}
          />
        ))}
      </RadioGroup>
    </Box>
  );
}

export default FeeIncomeDetail;
   