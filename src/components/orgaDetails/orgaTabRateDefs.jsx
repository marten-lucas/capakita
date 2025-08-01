import React, { useState } from 'react';
import {
  Box, Typography, Paper, Button, Tabs, Tab, Select, MenuItem, FormControl, InputLabel,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, IconButton,
  OutlinedInput, InputAdornment
} from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import { createSelector } from '@reduxjs/toolkit';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
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
  (defs) => defs ? [...defs] : [] // Transform: create new array to avoid identity function
);

// Create memoized selector for groupDefs to prevent unnecessary re-renders
const selectGroupDefs = createSelector(
  [
    (state, scenarioId) => state.simGroup.groupDefsByScenario[scenarioId]
  ],
  (defs) => defs ? [...defs] : [] // Transform: create new array to avoid identity function
);

// GroupPicker component for selecting a group
const GroupPicker = ({ groupDefs, value, onChange }) => {

  return (
    <FormControl size="small" sx={{ minWidth: 200 }}>
      <InputLabel>Gruppe</InputLabel>
      <Select
        value={value || ''}
        label="Gruppe"
        onChange={onChange}
      >
        {groupDefs.map(group => (
          <MenuItem key={group.id} value={group.id}>{group.name}</MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

function OrgaTabRateDefs() {
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const scenarioDefs = useSelector(state => selectScenarioDefs(state, selectedScenarioId));
  const groupDefs = useSelector(state => selectGroupDefs(state, selectedScenarioId));

  // Remove getEffectiveFinancialDefs usage, use scenarioDefs directly
  const financialDefs = scenarioDefs;

  const [selectedDefIndex, setSelectedDefIndex] = useState(0);
  const [, setSelectedGroupIndex] = useState(0);
  const [hoveredTabId, setHoveredTabId] = useState(null);

  const currentDef = financialDefs[selectedDefIndex];

  const handleAddRateDef = () => {
    const newDef = {
      description: 'Neue Beitragsordnung',
      valid_from: '',
      valid_to: ''    };
    dispatch(addFinancialDefThunk({
      scenarioId: selectedScenarioId,
      financialDef: newDef
    }));
  };

  // Remove all feeGroups logic, work directly with fees on the financialDef
  const handleAddFee = () => {
    const newFee = {
      maxBookingHours: 0,
      amount: 0
    };
    const updatedDef = {
      ...currentDef,
      fees: [...(currentDef.fees || []), newFee]
    };
    dispatch(updateFinancialDefThunk({
      scenarioId: selectedScenarioId,
      financialDefId: currentDef.id,
      updates: updatedDef
    }));
  };

  const handleUpdateFee = (feeIndex, updates) => {
    const updatedFees = [...(currentDef.fees || [])];
    updatedFees[feeIndex] = { ...updatedFees[feeIndex], ...updates };
    dispatch(updateFinancialDefThunk({
      scenarioId: selectedScenarioId,
      financialDefId: currentDef.id,
      updates: { ...currentDef, fees: updatedFees }
    }));
  };

  const handleDeleteFee = (feeIndex) => {
    const updatedFees = [...(currentDef.fees || [])];
    updatedFees.splice(feeIndex, 1);
    dispatch(updateFinancialDefThunk({
      scenarioId: selectedScenarioId,
      financialDefId: currentDef.id,
      updates: { ...currentDef, fees: updatedFees }
    }));
  };

  const handleDeleteRateDef = (defId) => {
    dispatch(deleteFinancialDefThunk({
      scenarioId: selectedScenarioId,
      financialDefId: defId
    }));
    // Optionally reset selectedDefIndex if needed
  };

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
                <Box 
                  key={def.id} 
                  sx={{ 
                    position: 'relative',
                    '&:hover .delete-button': {
                      opacity: 1
                    }
                  }}
                  onMouseEnter={() => setHoveredTabId(def.id)}
                  onMouseLeave={() => setHoveredTabId(null)}
                >
                  <Tab
                    label={def.description || `Beitragsordnung ${index + 1}`}
                    value={index}
                  />
                  <IconButton
                    className="delete-button"
                    size="small"
                    sx={{ 
                      position: 'absolute', 
                      right: 8, 
                      top: '50%', 
                      transform: 'translateY(-50%)',
                      zIndex: 1,
                      opacity: hoveredTabId === def.id ? 1 : 0,
                      transition: 'opacity 0.2s',
                      backgroundColor: 'background.paper',
                      '&:hover': { backgroundColor: 'error.light' }
                    }}
                    onClick={() => handleDeleteRateDef(def.id)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Tabs>
          </Paper>

          {/* Right side: Beitragsordnung management */}
          {currentDef && (
            <Box sx={{ flex: 1 }}>
              <Paper sx={{ p: 2, mb: 2 }}>
                <Typography variant="h6">{currentDef.description}</Typography>
                <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                  <TextField
                    label="Beschreibung"
                    value={currentDef.description || ''}
                    onChange={e => dispatch(updateFinancialDefThunk({
                      scenarioId: selectedScenarioId,
                      financialDefId: currentDef.id,
                      updates: { ...currentDef, description: e.target.value }
                    }))}
                    size="small"
                    sx={{ minWidth: 200 }}
                  />
                  <GroupPicker
                    groupDefs={groupDefs}
                    value={currentDef.groupRef}
                    onChange={e => dispatch(updateFinancialDefThunk({
                      scenarioId: selectedScenarioId,
                      financialDefId: currentDef.id,
                      updates: { ...currentDef, groupRef: e.target.value }
                    }))}
                  />
                  <TextField
                    label="Gültig von"
                    type="date"
                    value={currentDef.valid_from || ''}
                    onChange={e => dispatch(updateFinancialDefThunk({
                      scenarioId: selectedScenarioId,
                      financialDefId: currentDef.id,
                      updates: { ...currentDef, valid_from: e.target.value }
                    }))}
                    size="small"
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    label="Gültig bis"
                    type="date"
                    value={currentDef.valid_to || ''}
                    onChange={e => dispatch(updateFinancialDefThunk({
                      scenarioId: selectedScenarioId,
                      financialDefId: currentDef.id,
                      updates: { ...currentDef, valid_to: e.target.value }
                    }))}
                    size="small"
                    InputLabelProps={{ shrink: true }}
                  />
                </Box>
              </Paper>
              {/* Gebühren table */}
              <Paper sx={{ flex: 1, p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAddFee}>
                    Gebühr hinzufügen
                  </Button>
                </Box>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Max. Stunden</TableCell>
                        <TableCell>Betrag (€)</TableCell>
                        <TableCell align="right">Aktionen</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(currentDef.fees || []).map((fee, feeIndex) => (
                        <TableRow key={feeIndex}>
                          <TableCell>
                            <TextField
                              type="number"
                              value={fee.maxBookingHours || 0}
                              onChange={e => handleUpdateFee(feeIndex, { maxBookingHours: Number(e.target.value) })}
                              size="small"
                              sx={{ width: 80 }}
                            />
                          </TableCell>
                          <TableCell>
                            <FormControl sx={{ m: 1 }}>
                              <InputLabel htmlFor={`outlined-adornment-amount-${feeIndex}`}>Amount</InputLabel>
                              <OutlinedInput
                                id={`outlined-adornment-amount-${feeIndex}`}
                                type="number"
                                value={fee.amount || 0}
                                onChange={e => handleUpdateFee(feeIndex, { amount: Number(e.target.value) })}
                                startAdornment={<InputAdornment position="start">€</InputAdornment>}
                                label="Amount"
                              />
                            </FormControl>
                          </TableCell>
                          <TableCell align="right">
                            <IconButton size="small" onClick={() => handleDeleteFee(feeIndex)}>
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

export default OrgaTabRateDefs;