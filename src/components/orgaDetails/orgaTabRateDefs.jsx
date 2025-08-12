import {
  Box, Typography, Paper, Button, TextField, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  FormControl, InputLabel, Select, MenuItem, OutlinedInput, InputAdornment
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
import TabbedListDetail from '../common/TabbedListDetail';
import AccordionListDetail from '../common/AccordionListDetail';
import DateRangePicker from '../common/DateRangePicker';

// GroupPicker component for selecting a group
const GroupPicker = ({ groupDefs, value, onChange }) => (
  <FormControl size="small" sx={{ minWidth: 200, width: '100%', height: 40 }}>
    <Select
      value={value || ''}
      onChange={onChange}
      sx={{ height: 40 }}
    >
      {groupDefs.map(group => (
        <MenuItem key={group.id} value={group.id}>{group.name}</MenuItem>
      ))}
    </Select>
  </FormControl>
);

// Memoized selector for financial definitions
const selectFinancialDefs = createSelector(
  [
    (state, scenarioId) => state.simFinancials.financialDefsByScenario[scenarioId]
  ],
  (financialDefs) => financialDefs || []
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

  // FeeSet summary and detail components for AccordionListDetail
  const FeeSetSummary = ({ item: FeeSet }) => {
    const groupName = groupDefs.find(g => g.id === FeeSet.groupref)?.name;
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography sx={{ minWidth: 120, fontWeight: 500 }}>
          {groupName ? `Beiträge für ${groupName}` : 'Gruppe wählen'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {FeeSet.valid_from ? `von ${FeeSet.valid_from}` : ''} {FeeSet.valid_to ? `bis ${FeeSet.valid_to}` : ''}
        </Typography>
      </Box>
    );
  };

  const FeeSetDetail = ({ item: FeeSet, index: groupIndex }) => (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2, mb: 1 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Gruppe
          </Typography>
          <GroupPicker
            groupDefs={groupDefs}
            value={FeeSet.groupref}
            onChange={e => handleUpdateFeeSetField(groupIndex, 'groupref', e.target.value)}
          />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Zeitraum
          </Typography>
          <Box sx={{ height: 40 }}>
            <DateRangePicker
              value={{ start: FeeSet.valid_from, end: FeeSet.valid_to }}
              onChange={({ start, end }) => {
                handleUpdateFeeSetField(groupIndex, 'valid_from', start);
                handleUpdateFeeSetField(groupIndex, 'valid_to', end);
              }}
            />
          </Box>
        </Box>
      </Box>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Stunden</TableCell>
              <TableCell>Betrag</TableCell>
              <TableCell align="right">Aktionen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(FeeSet.fees || []).map((fee, feeIndex) => {
              const prevMax = feeIndex === 0 ? 0 : FeeSet.fees[feeIndex - 1]?.maxHours || 0;
              return (
                <TableRow key={feeIndex}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Typography variant="body2" sx={{ mr: 1, whiteSpace: 'nowrap' }}>
                        {`von ${prevMax} h bis `}
                      </Typography>
                      <TextField
                        type="text"
                        inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                        value={fee.maxHours || ''}
                        onChange={e => {
                          const val = e.target.value.replace(/\D/g, '');
                          handleUpdateFee(groupIndex, feeIndex, { maxHours: val === '' ? '' : Number(val) });
                        }}
                        size="small"
                        sx={{ width: 80 }}
                        InputProps={{
                          endAdornment: <span style={{ color: '#888', marginLeft: 4 }}>h</span>
                        }}
                      />
                    </Box>
                  </TableCell>
                  <TableCell>
                    <FormControl sx={{ m: 1 }}>
                      <InputLabel htmlFor={`outlined-adornment-amount-${groupIndex}-${feeIndex}`}>Betrag</InputLabel>
                      <OutlinedInput
                        id={`outlined-adornment-amount-${groupIndex}-${feeIndex}`}
                        type="text"
                        inputProps={{ inputMode: 'decimal', pattern: '[0-9.]*' }}
                        value={fee.amount || ''}
                        onChange={e => {
                          const val = e.target.value.replace(/[^0-9.]/g, '');
                          handleUpdateFee(groupIndex, feeIndex, { amount: val === '' ? '' : Number(val) });
                        }}
                        startAdornment={<InputAdornment position="start">€</InputAdornment>}
                        label="Betrag"
                      />
                    </FormControl>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleDeleteFee(groupIndex, feeIndex)}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <Box sx={{ mt: 1 }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => handleAddFee(groupIndex)}
        >
          Gebühr hinzufügen
        </Button>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ flex: 1 }}>
      <Box sx={{ p: 2, mb: 2 }}>
        <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
          Name
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
          <TextField
            label=""
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
      </Box>
      <AccordionListDetail
        items={currentDef.fee_sets || []}
        SummaryComponent={FeeSetSummary}
        DetailComponent={FeeSetDetail}
        AddButtonLabel="Gebühren-Gruppe hinzufügen"
        onAdd={handleAddFeeSet}
        onDelete={(idx) => handleDeleteFeeSet(idx)}
        getItemKey={(item, idx) => item.id || idx}
        emptyText="Keine Gebühren-Gruppen vorhanden."
      />
    </Box>
  );
}

function OrgaTabRateDefs() {
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const financialDefs = useSelector(state => selectFinancialDefs(state, selectedScenarioId));
  
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