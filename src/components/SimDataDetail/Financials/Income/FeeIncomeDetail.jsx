import React, { useEffect } from 'react';
import { Box, Typography, IconButton, Button, RadioGroup, FormControlLabel, Radio, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField } from '@mui/material';
import { useSelector } from 'react-redux';
import { useOverlayData } from '../../../../hooks/useOverlayData';
import DateRangePicker from '../../../../components/common/DateRangePicker';

function FeeIncomeDetail({ financial, onChange, item }) {
  // Get effective financial defs and group assignments
  const { getEffectiveGroupAssignments } = useOverlayData();
  const groupAssignments = getEffectiveGroupAssignments(item.id);
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const financialDefs = useSelector(state => state.simFinancials.financialDefsByScenario[selectedScenarioId]) || [];

  // Use type_details for group_ref and financialDefId
  const typeDetails = financial.type_details || {};

  // Find groupRef from type_details or group assignments (first active group)
  const now = new Date().toISOString().slice(0, 10);
  let groupRef = typeDetails.group_ref;
  if (!groupRef) {
    if (groupAssignments) {
      const activeAssignment = Object.values(groupAssignments).find(a => {
        const startOk = !a.start || a.start <= now;
        const endOk = !a.end || !a.end || a.end >= now;
        return startOk && endOk;
      });
      groupRef = activeAssignment?.groupId || item.groupId || null;
    } else {
      groupRef = item.groupId || null;
    }
  }

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

  // Only show financialDefs that have a fee_group for the current groupRef
  const matchingDefs = financialDefs.filter(def =>
    Array.isArray(def.fee_sets) && def.fee_sets.some(g => g.groupref === groupRef)
  );

  // Auto-select the first available option if none is selected
  useEffect(() => {
    if (
      matchingDefs.length > 0 &&
      (!typeDetails.financialDefId || !matchingDefs.some(def => def.id === typeDetails.financialDefId))
    ) {
      onChange({
        ...financial,
        type_details: { ...typeDetails, financialDefId: matchingDefs[0].id }
      });
    }
    // eslint-disable-next-line
  }, [matchingDefs.length]);

  return (
    <Box display="flex" flexDirection="column" gap={2} position="relative">
      {/* Valid from/to fields */}
      <Box display="flex" gap={2}>
        <DateRangePicker
          value={{ start: financial.valid_from || '', end: financial.valid_to || '' }}
          onChange={handleDateRangeChange}
        />
      </Box>

      <Typography variant="body2" color="text.secondary">
        Wählen Sie die passende Beitragsordnung für die Gruppe.
      </Typography>
      <RadioGroup
        value={typeDetails.financialDefId || ''}
        onChange={e => updateTypeDetails({ financialDefId: e.target.value })}
      >
        {matchingDefs.length === 0 && (
          <Typography variant="caption" color="error">
            Keine passende Beitragsordnung gefunden.
          </Typography>
        )}
        {matchingDefs.map(def => (
          <FormControlLabel
            key={def.id}
            value={def.id}
            control={<Radio />}
            label={def.description || def.id}
          />
        ))}
      </RadioGroup>
     
     
    </Box>
  );
}

export default FeeIncomeDetail;
