import React from 'react';
import { Box, Typography, IconButton, Button, RadioGroup, FormControlLabel, Radio, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useSelector } from 'react-redux';
import { useOverlayData } from '../../../hooks/useOverlayData';
import { calculateWorktimeFromBookings } from '../../../utils/bookingUtils';

function FeeIncomeDetail({ financial, onChange, onDelete, item }) {
  // Get effective financial defs and group assignments
  const { getEffectiveGroupAssignments } = useOverlayData();
  const groupAssignments = getEffectiveGroupAssignments(item.id);
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const financialDefs = useSelector(state => state.simFinancials.financialDefsByScenario[selectedScenarioId]) || [];

  // Find groupRef from group assignments (first active group)
  const now = new Date().toISOString().slice(0, 10);
  let groupRef = null;
  if (groupAssignments) {
    const activeAssignment = Object.values(groupAssignments).find(a => {
      const startOk = !a.start || a.start <= now;
      const endOk = !a.end || a.end >= now;
      return startOk && endOk;
    });
    groupRef = activeAssignment?.groupId || item.groupId || null;
  } else {
    groupRef = item.groupId || null;
  }

  // Find selected financialDef
  const selectedDef = financialDefs.find(def => def.id === financial.financialDefId);

  // Find the fee group for the current groupRef
  let matchedFeeGroup = null;
  if (selectedDef && Array.isArray(selectedDef.fee_groups)) {
    matchedFeeGroup = selectedDef.fee_groups.find(g => g.groupref === groupRef);
  }

  // Calculate sum of booking times for the item (overlay-aware)
  const sumOfBookingTimes = calculateWorktimeFromBookings(item.bookings || []);

  // Find the fee that matches the sumOfBookingTimes in the matched fee group
  let matchedFee = null;
  if (matchedFeeGroup && Array.isArray(matchedFeeGroup.fees)) {
    // Sort fees by minHours ascending
    const sortedFees = [...matchedFeeGroup.fees].sort((a, b) => (a.minHours ?? 0) - (b.minHours ?? 0));
    for (let i = 0; i < sortedFees.length; i++) {
      const lowerBound = sortedFees[i].minHours ?? 0;
      const upperBound = sortedFees[i + 1]?.minHours ?? Infinity;
      if (sumOfBookingTimes >= lowerBound && sumOfBookingTimes < upperBound) {
        matchedFee = sortedFees[i];
        break;
      }
      // Special case: sum == 0 should match first fee
      if (sumOfBookingTimes === 0 && i === 0) {
        matchedFee = sortedFees[0];
        break;
      }
    }
  }

  // Only show financialDefs that have a fee_group for the current groupRef
  const matchingDefs = financialDefs.filter(def =>
    Array.isArray(def.fee_groups) && def.fee_groups.some(g => g.groupref === groupRef)
  );

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
      <Typography variant="body2" color="text.secondary">
        Wählen Sie die passende Beitragsordnung für die Gruppe.
      </Typography>
      <RadioGroup
        value={financial.financialDefId || ''}
        onChange={e => onChange({ ...financial, financialDefId: e.target.value })}
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
      {selectedDef && matchedFeeGroup && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2">{selectedDef.description}</Typography>
          <Typography variant="caption" color="text.secondary">
            Gültig von: {selectedDef.valid_from} bis {selectedDef.valid_to}
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Min. Stunden</TableCell>
                  <TableCell>Betrag</TableCell>
                  <TableCell>Währung</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {matchedFee ? (
                  <TableRow>
                    <TableCell>{matchedFee.minHours}</TableCell>
                    <TableCell>{matchedFee.amount}</TableCell>
                    <TableCell>{matchedFee.currency}</TableCell>
                  </TableRow>
                ) : (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <Typography variant="caption" color="error">
                        Keine passende Gebühr gefunden für {sumOfBookingTimes} Stunden.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
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
