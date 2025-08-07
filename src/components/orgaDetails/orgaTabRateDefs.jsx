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

// Utility wrapper to avoid passing unwanted props to DOM
const RemoveDomProps = ({ style, children }) => (
  <div style={style}>{children}</div>
);

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

  // Add Fee Group
  const handleAddFeeGroup = () => {
    const newGroup = {
      id: Math.random().toString(36).slice(2),
      groupref: '',
      valid_from: '',
      valid_to: '',
      fees: []
    };
    const updatedDef = {
      ...currentDef,
      fee_groups: [...(currentDef.fee_groups || []), newGroup]
    };
    dispatch(updateFinancialDefThunk({
      scenarioId: selectedScenarioId,
      financialDefId: currentDef.id,
      updates: updatedDef
    }));
  };

  // Remove Fee Group
  const handleDeleteFeeGroup = (groupIndex) => {
    const updatedGroups = [...(currentDef.fee_groups || [])];
    updatedGroups.splice(groupIndex, 1);
    dispatch(updateFinancialDefThunk({
      scenarioId: selectedScenarioId,
      financialDefId: currentDef.id,
      updates: { ...currentDef, fee_groups: updatedGroups }
    }));
  };

  // Add Fee to FeeGroup
  const handleAddFee = (groupIndex) => {
    const updatedGroups = [...(currentDef.fee_groups || [])];
    updatedGroups[groupIndex] = {
      ...updatedGroups[groupIndex],
      fees: [
        ...(updatedGroups[groupIndex].fees || []),
        { maxHours: 0, amount: 0, currency: 'EUR' }
      ]
    };
    dispatch(updateFinancialDefThunk({
      scenarioId: selectedScenarioId,
      financialDefId: currentDef.id,
      updates: { ...currentDef, fee_groups: updatedGroups }
    }));
  };

  // Update Fee in FeeGroup
  const handleUpdateFee = (groupIndex, feeIndex, updates) => {
    const updatedGroups = [...(currentDef.fee_groups || [])];
    const updatedFees = [...(updatedGroups[groupIndex].fees || [])];
    updatedFees[feeIndex] = { ...updatedFees[feeIndex], ...updates };
    updatedGroups[groupIndex] = { ...updatedGroups[groupIndex], fees: updatedFees };
    dispatch(updateFinancialDefThunk({
      scenarioId: selectedScenarioId,
      financialDefId: currentDef.id,
      updates: { ...currentDef, fee_groups: updatedGroups }
    }));
  };

  // Delete Fee from FeeGroup
  const handleDeleteFee = (groupIndex, feeIndex) => {
    const updatedGroups = [...(currentDef.fee_groups || [])];
    const updatedFees = [...(updatedGroups[groupIndex].fees || [])];
    updatedFees.splice(feeIndex, 1);
    updatedGroups[groupIndex] = { ...updatedGroups[groupIndex], fees: updatedFees };
    dispatch(updateFinancialDefThunk({
      scenarioId: selectedScenarioId,
      financialDefId: currentDef.id,
      updates: { ...currentDef, fee_groups: updatedGroups }
    }));
  };



  // Update FeeGroup fields (valid_from, valid_to, groupref)
  const handleUpdateFeeGroupField = (groupIndex, field, value) => {
    const updatedGroups = [...(currentDef.fee_groups || [])];
    updatedGroups[groupIndex] = { ...updatedGroups[groupIndex], [field]: value };
    dispatch(updateFinancialDefThunk({
      scenarioId: selectedScenarioId,
      financialDefId: currentDef.id,
      updates: { ...currentDef, fee_groups: updatedGroups }
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
                <RemoveDomProps
                  key={def.id}
                  style={{
                    position: 'relative'
                  }}
                >
                  <Box
                    sx={{
                      '&:hover .delete-button': { opacity: 1 }
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
                </RemoveDomProps>
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
                  
                </Box>
              </Paper>
              {/* Fee Groups */}
              <Paper sx={{ flex: 1, p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAddFeeGroup}>
                    Gebühren-Gruppe hinzufügen
                  </Button>
                </Box>
                {(currentDef.fee_groups || []).map((feeGroup, groupIndex) => (
                  <Box key={feeGroup.id || groupIndex} sx={{ mb: 4, border: '1px solid #eee', borderRadius: 2, p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                      <GroupPicker
                        groupDefs={groupDefs}
                        value={feeGroup.groupref}
                        onChange={e => handleUpdateFeeGroupField(groupIndex, 'groupref', e.target.value)}
                      />
                      <TextField
                        label="Gültig von"
                        type="date"
                        value={feeGroup.valid_from || ''}
                        onChange={e => handleUpdateFeeGroupField(groupIndex, 'valid_from', e.target.value)}
                        size="small"
                        InputLabelProps={{ shrink: true }}
                      />
                      <TextField
                        label="Gültig bis"
                        type="date"
                        value={feeGroup.valid_to || ''}
                        onChange={e => handleUpdateFeeGroupField(groupIndex, 'valid_to', e.target.value)}
                        size="small"
                        InputLabelProps={{ shrink: true }}
                      />
                      <IconButton size="small" onClick={() => handleDeleteFeeGroup(groupIndex)}>
                        <DeleteIcon />
                      </IconButton>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => handleAddFee(groupIndex)}
                      >
                        Gebühr hinzufügen
                      </Button>
                    </Box>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Max. Stunden</TableCell>
                            <TableCell>Betrag</TableCell>
                            <TableCell>Währung</TableCell>
                            <TableCell align="right">Aktionen</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(feeGroup.fees || []).map((fee, feeIndex) => (
                            <TableRow key={feeIndex}>
                              <TableCell>
                                <TextField
                                  type="number"
                                  value={fee.maxHours || 0}
                                  onChange={e => handleUpdateFee(groupIndex, feeIndex, { maxHours: Number(e.target.value) })}
                                  size="small"
                                  sx={{ width: 80 }}
                                />
                              </TableCell>
                              <TableCell>
                                <FormControl sx={{ m: 1 }}>
                                  <InputLabel htmlFor={`outlined-adornment-amount-${groupIndex}-${feeIndex}`}>Betrag</InputLabel>
                                  <OutlinedInput
                                    id={`outlined-adornment-amount-${groupIndex}-${feeIndex}`}
                                    type="number"
                                    value={fee.amount || 0}
                                    onChange={e => handleUpdateFee(groupIndex, feeIndex, { amount: Number(e.target.value) })}
                                    startAdornment={<InputAdornment position="start">€</InputAdornment>}
                                    label="Betrag"
                                  />
                                </FormControl>
                              </TableCell>
                              <TableCell>
                                <TextField
                                  value={fee.currency || 'EUR'}
                                  onChange={e => handleUpdateFee(groupIndex, feeIndex, { currency: e.target.value })}
                                  size="small"
                                  sx={{ width: 80 }}
                                />
                              </TableCell>
                              <TableCell align="right">
                                <IconButton size="small" onClick={() => handleDeleteFee(groupIndex, feeIndex)}>
                                  <DeleteIcon />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                ))}
              </Paper>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

export default OrgaTabRateDefs;