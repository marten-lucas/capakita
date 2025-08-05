import React, { useState } from 'react';
import { Box, Button, Menu, MenuItem, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FinancialsCards from './FinancialsCards';
import { useOverlayData } from '../../../hooks/useOverlayData';
import { FINANCIAL_TYPE_REGISTRY } from '../../../config/financialTypeRegistry';
import { useFinancialsActions } from '../../../hooks/useFinancialsActions';

function SimDataFinanceTab({ item }) {
  const { addFinancial, updateFinancial, deleteFinancial } = useFinancialsActions();
  const { getEffectiveFinancials } = useOverlayData();
  const financialsObj = getEffectiveFinancials(item?.id);
  const financials = Object.values(financialsObj || {});

  const [anchorEl, setAnchorEl] = useState(null);
  const [expandedItems, setExpandedItems] = useState(new Set());
  const open = Boolean(anchorEl);

  const allowedTypes = FINANCIAL_TYPE_REGISTRY.filter(opt => opt.allowed.includes(item.type));

  const handleAddClick = (event) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  const handleAddFinancial = (type) => {
    const typeEntry = FINANCIAL_TYPE_REGISTRY.find(t => t.value === type);
    const newId = `${Date.now()}-${Math.random()}`;
    const newObj = {
      id: newId,
      type: type,
      label: typeEntry?.label || '',
      amount: '',
      from: '',
      to: '',
      note: '',
      ...(type === 'income-fee' ? { type_details: { financialDefId: '' } } : {})
    };
    addFinancial(item.id, newObj);
    setExpandedItems(prev => new Set([...prev, newId]));
    handleMenuClose();
  };

  const handleToggleExpanded = (financialId) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(financialId)) newSet.delete(financialId);
      else newSet.add(financialId);
      return newSet;
    });
  };

  const handleUpdateFinancial = (idx, updated) => {
    const financialId = financials[idx]?.id;
    if (!financialId) return;
    updateFinancial(item.id, financialId, updated);
  };

  const handleDeleteFinancial = (idx) => {
    const financialToDelete = financials[idx];
    if (!financialToDelete) return;
    deleteFinancial(item.id, financialToDelete.id);
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
          {allowedTypes.map(opt => (
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
