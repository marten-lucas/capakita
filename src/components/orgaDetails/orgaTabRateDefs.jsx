import {
  Box, Typography, Paper, Button, TextField, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  FormControl, InputLabel, Select, MenuItem, OutlinedInput, InputAdornment
} from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  addFinancialDefThunk,
  updateFinancialDefThunk,
  deleteFinancialDefThunk
} from '../../store/simFinancialsSlice';
import TabbedListDetail from '../common/TabbedListDetail';

// GroupPicker component for selecting a group
const GroupPicker = ({ groupDefs, value, onChange }) => (
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

function RateDefDetail({ item: currentDef }) {
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const groupDefs = useSelector(state => state.simGroup.groupDefsByScenario[selectedScenarioId] || []);

  // Add Fee Group
  const handleAddFeeSet = () => {
    const newGroup = {
      id: Math.random().toString(36).slice(2),
      groupref: '',
      valid_from: '',
      valid_to: '',
      fees: []
    };
    const updatedDef = {
      ...currentDef,
      fee_sets: [...(currentDef.fee_sets || []), newGroup]
    };
    dispatch(updateFinancialDefThunk({
      scenarioId: selectedScenarioId,
      financialDefId: currentDef.id,
      updates: updatedDef
    }));
  };

  // Remove Fee Group
  const handleDeleteFeeSet = (groupIndex) => {
    const updatedGroups = [...(currentDef.fee_sets || [])];
    updatedGroups.splice(groupIndex, 1);
    dispatch(updateFinancialDefThunk({
      scenarioId: selectedScenarioId,
      financialDefId: currentDef.id,
      updates: { ...currentDef, fee_sets: updatedGroups }
    }));
  };

  // Add Fee to FeeSet
  const handleAddFee = (groupIndex) => {
    const updatedGroups = [...(currentDef.fee_sets || [])];
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
      updates: { ...currentDef, fee_sets: updatedGroups }
    }));
  };

  // Update Fee in FeeSet
  const handleUpdateFee = (groupIndex, feeIndex, updates) => {
    const updatedGroups = [...(currentDef.fee_sets || [])];
    const updatedFees = [...(updatedGroups[groupIndex].fees || [])];
    updatedFees[feeIndex] = { ...updatedFees[feeIndex], ...updates };
    updatedGroups[groupIndex] = { ...updatedGroups[groupIndex], fees: updatedFees };
    dispatch(updateFinancialDefThunk({
      scenarioId: selectedScenarioId,
      financialDefId: currentDef.id,
      updates: { ...currentDef, fee_sets: updatedGroups }
    }));
  };

  // Delete Fee from FeeSet
  const handleDeleteFee = (groupIndex, feeIndex) => {
    const updatedGroups = [...(currentDef.fee_sets || [])];
    const updatedFees = [...(updatedGroups[groupIndex].fees || [])];
    updatedFees.splice(feeIndex, 1);
    updatedGroups[groupIndex] = { ...updatedGroups[groupIndex], fees: updatedFees };
    dispatch(updateFinancialDefThunk({
      scenarioId: selectedScenarioId,
      financialDefId: currentDef.id,
      updates: { ...currentDef, fee_sets: updatedGroups }
    }));
  };

  // Update FeeSet fields (valid_from, valid_to, groupref)
  const handleUpdateFeeSetField = (groupIndex, field, value) => {
    const updatedGroups = [...(currentDef.fee_sets || [])];
    updatedGroups[groupIndex] = { ...updatedGroups[groupIndex], [field]: value };
    dispatch(updateFinancialDefThunk({
      scenarioId: selectedScenarioId,
      financialDefId: currentDef.id,
      updates: { ...currentDef, fee_sets: updatedGroups }
    }));
  };

  return (
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
          <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAddFeeSet}>
            Gebühren-Gruppe hinzufügen
          </Button>
        </Box>
        {(currentDef.fee_sets || []).map((FeeSet, groupIndex) => (
          <Box key={FeeSet.id || groupIndex} sx={{ mb: 4, border: '1px solid #eee', borderRadius: 2, p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
              <GroupPicker
                groupDefs={groupDefs}
                value={FeeSet.groupref}
                onChange={e => handleUpdateFeeSetField(groupIndex, 'groupref', e.target.value)}
              />
              <TextField
                label="Gültig von"
                type="date"
                value={FeeSet.valid_from || ''}
                onChange={e => handleUpdateFeeSetField(groupIndex, 'valid_from', e.target.value)}
                size="small"
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Gültig bis"
                type="date"
                value={FeeSet.valid_to || ''}
                onChange={e => handleUpdateFeeSetField(groupIndex, 'valid_to', e.target.value)}
                size="small"
                InputLabelProps={{ shrink: true }}
              />
              <IconButton size="small" onClick={() => handleDeleteFeeSet(groupIndex)}>
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
                  {(FeeSet.fees || []).map((fee, feeIndex) => (
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
  );
}

function OrgaTabRateDefs() {
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const financialDefs = useSelector(state => state.simFinancials.financialDefsByScenario[selectedScenarioId] || []);

  // TabbedListDetail props
  const items = financialDefs;
  const ItemTitle = item => item.description || 'Beitragsordnung';
  const ItemSubTitle = item =>
    (item.valid_from || item.valid_to)
      ? `Gültig: ${item.valid_from || '-'} bis ${item.valid_to || '-'}` : '';
  const ItemChips = () => null;
  const ItemAvatar = () => null;
  const ItemHoverIcons = item => [
    {
      icon: <DeleteIcon fontSize="small" />,
      title: 'Löschen',
      onClick: () => dispatch(deleteFinancialDefThunk({
        scenarioId: selectedScenarioId,
        financialDefId: item.id
      }))
    }
  ];
  const ItemAddButton = {
    label: 'Neue Beitragsordnung',
    icon: <AddIcon />,
    onClick: () => {
      const newDef = {
        description: 'Neue Beitragsordnung',
        valid_from: '',
        valid_to: ''
      };
      dispatch(addFinancialDefThunk({
        scenarioId: selectedScenarioId,
        financialDef: newDef
      }));
    },
    title: 'Beitragsordnungen'
  };

  return (
    <TabbedListDetail
      items={items}
      ItemTitle={ItemTitle}
      ItemSubTitle={ItemSubTitle}
      ItemChips={ItemChips}
      ItemAvatar={ItemAvatar}
      ItemHoverIcons={ItemHoverIcons}
      ItemAddButton={ItemAddButton}
      Detail={RateDefDetail}
      emptyText="Keine Beitragsordnungen definiert."
    />
  );
}

export default OrgaTabRateDefs;