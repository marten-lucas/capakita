import React, { useState } from 'react';
import { Box, Button, Menu, MenuItem, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import useSimScenarioDataStore from '../../../store/simScenarioStore';
import FinancialsCards from './FinancialsCards';

const FINANCIAL_TYPES = [
  { value: 'expense-avr', label: 'Ausgabe: AVR-Entgelt', allowed: ['capacity'] },
  { value: 'income-fee', label: 'Einnahme: Beitrag', allowed: ['demand'] },
  { value: 'income-baykibig', label: 'Einnahme: BayKiBig-Förderung', allowed: ['demand'] },
  { value: 'income-other', label: 'Einnahme: Förderung', allowed: ['capacity', 'demand'] },
];

function SimDataFinanceTab({ item }) {
  const { getItemFinancials, updateItemFinancials } = useSimScenarioDataStore();
  const financials = getItemFinancials(item.id);
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
    updateItemFinancials(item.id, [...financials, newObj]);
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
    const updatedArr = financials.map((f, i) => (i === idx ? updated : f));
    updateItemFinancials(item.id, updatedArr);
  };

  const handleDeleteFinancial = (idx) => {
    const financialToDelete = financials[idx];
    const updatedArr = financials.filter((_, i) => i !== idx);
    updateItemFinancials(item.id, updatedArr);
    
    // Remove deleted item from expanded state
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
        item={item} // <-- pass item here
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
