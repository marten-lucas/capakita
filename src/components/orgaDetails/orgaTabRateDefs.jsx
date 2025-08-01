import React, { useState, useMemo } from 'react';
import {
  Box, Typography, Paper, Button, Tabs, Tab, Select, MenuItem, FormControl, InputLabel,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, IconButton
} from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import { createSelector } from '@reduxjs/toolkit';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { useOverlayData } from '../../hooks/useOverlayData';
import {
  addFinancialDefThunk,
  updateFinancialDefThunk,
  deleteFinancialDefThunk
} from '../../store/simFinancialsSlice';

// Create memoized selector to prevent unnecessary re-renders
const selectScenarioDefs = createSelector(
  [
    (state, scenarioId) => state.simFinancials.financialDefsByScenario[scenarioId]
  ],
  (defs) => defs || []
);

// Create memoized selector for groupDefs to prevent unnecessary re-renders
const selectGroupDefs = createSelector(
  [
    (state, scenarioId) => state.simGroup.groupDefsByScenario[scenarioId]
  ],
  (defs) => defs || []
);

function OrgaTabRateDefs() {
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const scenarioDefs = useSelector(state => selectScenarioDefs(state, selectedScenarioId));
  const groupDefs = useSelector(state => selectGroupDefs(state, selectedScenarioId));

  // Overlay systematik: get effective financialDefs
  const { baseScenario, isBasedScenario, overlaysByScenario } = useOverlayData();
  
  // Memoize financial defs calculation to prevent hook order issues
  const financialDefs = useMemo(() => {
    const baseDefs = baseScenario?.financialDefs || [];
    const overlayDefs = overlaysByScenario?.[selectedScenarioId]?.financialDefs || [];
    
    return isBasedScenario
      ? [...baseDefs, ...overlayDefs]
      : scenarioDefs;
  }, [baseScenario, isBasedScenario, overlaysByScenario, selectedScenarioId, scenarioDefs]);

  const [selectedDefIndex, setSelectedDefIndex] = useState(0);
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);

  const currentDef = financialDefs[selectedDefIndex];

  const handleAddRateDef = () => {
    const newDef = {
      description: 'Neue Beitragsordnung',
      valid_from: '',
      valid_to: '',
      feeGroups: []
    };
    dispatch(addFinancialDefThunk({
      scenarioId: selectedScenarioId,
      financialDef: newDef
    }));
  };

  const handleAddFeeGroup = () => {
    if (!currentDef) return;
    const updatedDef = {
      ...currentDef,
      feeGroups: [
        ...currentDef.feeGroups,
        {
          groupRef: '',
          fees: []
        }
      ]
    };
    dispatch(updateFinancialDefThunk({
      scenarioId: selectedScenarioId,
      financialDefId: currentDef.id,
      updates: updatedDef
    }));
    setSelectedGroupIndex(updatedDef.feeGroups.length - 1);
  };

  const handleUpdateFeeGroup = (groupIndex, updates) => {
    if (!currentDef) return;
    const updatedFeeGroups = [...currentDef.feeGroups];
    updatedFeeGroups[groupIndex] = { ...updatedFeeGroups[groupIndex], ...updates };
    dispatch(updateFinancialDefThunk({
      scenarioId: selectedScenarioId,
      financialDefId: currentDef.id,
      updates: { ...currentDef, feeGroups: updatedFeeGroups }
    }));
  };

  const handleAddFee = (groupIndex) => {
    const newFee = {
      minBookingHours: 0,
      maxBookingHours: 0,
      amount: 0
    };
    const updatedFeeGroups = [...currentDef.feeGroups];
    updatedFeeGroups[groupIndex].fees.push(newFee);
    dispatch(updateFinancialDefThunk({
      scenarioId: selectedScenarioId,
      financialDefId: currentDef.id,
      updates: { ...currentDef, feeGroups: updatedFeeGroups }
    }));
  };

  const handleUpdateFee = (groupIndex, feeIndex, updates) => {
    const updatedFeeGroups = [...currentDef.feeGroups];
    updatedFeeGroups[groupIndex].fees[feeIndex] = { ...updatedFeeGroups[groupIndex].fees[feeIndex], ...updates };
    dispatch(updateFinancialDefThunk({
      scenarioId: selectedScenarioId,
      financialDefId: currentDef.id,
      updates: { ...currentDef, feeGroups: updatedFeeGroups }
    }));
  };

  const handleDeleteFee = (groupIndex, feeIndex) => {
    const updatedFeeGroups = [...currentDef.feeGroups];
    updatedFeeGroups[groupIndex].fees.splice(feeIndex, 1);
    dispatch(updateFinancialDefThunk({
      scenarioId: selectedScenarioId,
      financialDefId: currentDef.id,
      updates: { ...currentDef, feeGroups: updatedFeeGroups }
    }));
  };

  const currentFeeGroup = currentDef?.feeGroups[selectedGroupIndex];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Beitragsordnungen</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddRateDef}>
          Neue Beitragsordnung
        </Button>
      </Box>

      {financialDefs.length === 0 ? (
        <Typography>Keine Beitragsordnungen definiert.</Typography>
      ) : (
        <Box sx={{ display: 'flex', gap: 2 }}>
          {/* Left side: Rate definitions */}
          <Paper sx={{ minWidth: 300, p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Beitragsordnungen</Typography>
            <Tabs
              orientation="vertical"
              variant="scrollable"
              value={selectedDefIndex}
              onChange={(_, newValue) => {
                setSelectedDefIndex(newValue);
                setSelectedGroupIndex(0);
              }}
              sx={{ borderRight: 1, borderColor: 'divider' }}
            >
              {financialDefs.map((def, index) => (
                <Tab key={def.id} label={def.description || `Ordnung ${index + 1}`} />
              ))}
            </Tabs>
          </Paper>

          {/* Right side: Fee groups management */}
          {currentDef && (
            <Box sx={{ flex: 1 }}>
              <Paper sx={{ p: 2, mb: 2 }}>
                <Typography variant="h6">{currentDef.description}</Typography>
                <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                  <TextField
                    label="Gültig von"
                    value={currentDef.valid_from || ''}
                    onChange={e => dispatch(updateFinancialDefThunk({
                      scenarioId: selectedScenarioId,
                      financialDefId: currentDef.id,
                      updates: { ...currentDef, valid_from: e.target.value }
                    }))}
                    size="small"
                  />
                  <TextField
                    label="Gültig bis"
                    value={currentDef.valid_to || ''}
                    onChange={e => dispatch(updateFinancialDefThunk({
                      scenarioId: selectedScenarioId,
                      financialDefId: currentDef.id,
                      updates: { ...currentDef, valid_to: e.target.value }
                    }))}
                    size="small"
                  />
                  <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAddFeeGroup}>
                    Gebührengruppe hinzufügen
                  </Button>
                </Box>
              </Paper>

              {currentDef.feeGroups.length > 0 && (
                <Box sx={{ display: 'flex', gap: 2 }}>
                  {/* Fee groups tabs */}
                  <Paper sx={{ minWidth: 200, p: 1 }}>
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>Gebührengruppen</Typography>
                    <Tabs
                      orientation="vertical"
                      variant="scrollable"
                      value={selectedGroupIndex}
                      onChange={(_, newValue) => setSelectedGroupIndex(newValue)}
                    >
                      {currentDef.feeGroups.map((group, index) => {
                        const groupName = groupDefs.find(g => g.id === group.groupRef)?.name || 'Unbekannte Gruppe';
                        return (
                          <Tab key={index} label={groupName || `Gruppe ${index + 1}`} />
                        );
                      })}
                    </Tabs>
                  </Paper>

                  {/* Fee table for selected group */}
                  {currentFeeGroup && (
                    <Paper sx={{ flex: 1, p: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <FormControl size="small" sx={{ minWidth: 200 }}>
                          <InputLabel>Gruppe</InputLabel>
                          <Select
                            value={currentFeeGroup.groupRef || ''}
                            label="Gruppe"
                            onChange={e => handleUpdateFeeGroup(selectedGroupIndex, { groupRef: e.target.value })}
                          >
                            {groupDefs.map(group => (
                              <MenuItem key={group.id} value={group.id}>{group.name}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <Button variant="outlined" startIcon={<AddIcon />} onClick={() => handleAddFee(selectedGroupIndex)}>
                          Gebühr hinzufügen
                        </Button>
                      </Box>

                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Min. Stunden</TableCell>
                              <TableCell>Max. Stunden</TableCell>
                              <TableCell>Betrag (€)</TableCell>
                              <TableCell align="right">Aktionen</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {currentFeeGroup.fees.map((fee, feeIndex) => (
                              <TableRow key={feeIndex}>
                                <TableCell>
                                  <TextField
                                    type="number"
                                    value={fee.minBookingHours || 0}
                                    onChange={e => handleUpdateFee(selectedGroupIndex, feeIndex, { minBookingHours: Number(e.target.value) })}
                                    size="small"
                                    sx={{ width: 80 }}
                                  />
                                </TableCell>
                                <TableCell>
                                  <TextField
                                    type="number"
                                    value={fee.maxBookingHours || 0}
                                    onChange={e => handleUpdateFee(selectedGroupIndex, feeIndex, { maxBookingHours: Number(e.target.value) })}
                                    size="small"
                                    sx={{ width: 80 }}
                                  />
                                </TableCell>
                                <TableCell>
                                  <TextField
                                    type="number"
                                    value={fee.amount || 0}
                                    onChange={e => handleUpdateFee(selectedGroupIndex, feeIndex, { amount: Number(e.target.value) })}
                                    size="small"
                                    sx={{ width: 100 }}
                                  />
                                </TableCell>
                                <TableCell align="right">
                                  <IconButton size="small" onClick={() => handleDeleteFee(selectedGroupIndex, feeIndex)}>
                                    <DeleteIcon />
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Paper>
                  )}
                </Box>
              )}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

export default OrgaTabRateDefs;
