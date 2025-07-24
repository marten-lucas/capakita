import React, { useState } from 'react';
import { Box, Button, Menu, MenuItem, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useSelector, useDispatch } from 'react-redux';
import FinancialsCards from './FinancialsCards';

const FINANCIAL_TYPES = [
  { value: 'expense-avr', label: 'Ausgabe: AVR-Entgelt', allowed: ['capacity'] },
  { value: 'income-fee', label: 'Einnahme: Beitrag', allowed: ['demand'] },
  { value: 'income-baykibig', label: 'Einnahme: BayKiBig-Förderung', allowed: ['demand'] },
  { value: 'income-other', label: 'Einnahme: Förderung', allowed: ['capacity', 'demand'] },
];

function SimDataFinanceTab({ item }) {
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const financials = useSelector(state => {
    if (!selectedScenarioId || !item?.id) return [];
    const scenarioFinancials = state.simFinancials.financialsByScenario[selectedScenarioId] || {};
    return Object.values(scenarioFinancials[item.id] || {});
  });
  const [anchorEl, setAnchorEl] = useState(null);
  const [expandedItems, setExpandedItems] = useState(new Set());
  const open = Boolean(anchorEl);

  const handleAddClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleAddFinancial = (type) => {
    const newId = `${Date.now()}-${Math.random()}`;
    const newObj = {
      id: newId,
      type: type,
      label: FINANCIAL_TYPES.find(t => t.value === type)?.label || '',
      amount: '',
      from: '',
      to: '',
      note: ''
    };
    dispatch({
      type: 'simFinancials/addFinancial',
      payload: {
        scenarioId: selectedScenarioId,
        dataItemId: item.id,
        financial: newObj
      }
    });
    setExpandedItems(prev => new Set([...prev, newId]));
    handleMenuClose();
  };

  const handleToggleExpanded = (financialId) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(financialId)) {
        newSet.delete(financialId);
      } else {
        newSet.add(financialId);
      }
      return newSet;
    });
  };

  const handleUpdateFinancial = (idx, updated) => {
    const financialId = financials[idx]?.id;
    if (!financialId) return;
    dispatch({
      type: 'simFinancials/updateFinancial',
      payload: {
        scenarioId: selectedScenarioId,
        dataItemId: item.id,
        financialId,
        updates: updated
      }
    });
  };

  const handleDeleteFinancial = (idx) => {
    const financialToDelete = financials[idx];
    if (!financialToDelete) return;
    dispatch({
      type: 'simFinancials/deleteFinancial',
      payload: {
        scenarioId: selectedScenarioId,
        dataItemId: item.id,
        financialId: financialToDelete.id
      }
    });
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      newSet.delete(financialToDelete.id);
      return newSet;
    });
  };

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2} sx={{ mb: 2 }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={handleAddClick}
        >
          Finanzobjekt hinzufügen
        </Button>
        <Menu
          anchorEl={anchorEl}
          open={open}
          onClose={handleMenuClose}
        >
          {FINANCIAL_TYPES
            .filter(opt => opt.allowed.includes(item.type))
            .map(opt => (
              <MenuItem 
                key={opt.value} 
                onClick={() => handleAddFinancial(opt.value)}
              >
                {opt.label}
              </MenuItem>
            ))}
        </Menu>
      </Box>
      <FinancialsCards
        financials={financials}
        expandedItems={expandedItems}
        onToggleExpanded={handleToggleExpanded}
        onUpdate={handleUpdateFinancial}
        onDelete={handleDeleteFinancial}
        item={item}
      />
      {(!financials || financials.length === 0) && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Keine Finanzobjekte vorhanden.
        </Typography>
      )}
    </Box>
  );
}

export default SimDataFinanceTab;
