import React, { useState } from 'react';
import { Box, TextField, Button, Typography, MenuItem, IconButton, Menu } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

const ALLOWANCE_TYPES = [
  { value: 'child', label: 'AVR: Kinderzuschlag' },
  { value: 'yearly', label: 'AVR: Jahressonderzahlung' },
  { value: 'praxis', label: 'AVR: Praxisanleiterzulage' }
];

function FinancialBonusDetails({ bonus = [], onChange }) {
  const [menuAnchor, setMenuAnchor] = useState(null);

  const handleAddAllowance = (type) => {
    const newAllowance = {
      id: `${type}-${Date.now()}-${Math.random()}`,
      type,
      amount: '',
      note: ''
    };
    onChange([...(bonus || []), newAllowance]);
    setMenuAnchor(null);
  };

  const handleAllowanceChange = (idx, field, value) => {
    const updated = bonus.map((a, i) =>
      i === idx ? { ...a, [field]: value } : a
    );
    onChange(updated);
  };

  const handleDeleteAllowance = (idx) => {
    const updated = bonus.filter((_, i) => i !== idx);
    onChange(updated);
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Bonus</Typography>
      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon />}
          onClick={e => setMenuAnchor(e.currentTarget)}
        >
          Bonus hinzufügen
        </Button>
        <Menu
          anchorEl={menuAnchor}
          open={!!menuAnchor}
          onClose={() => setMenuAnchor(null)}
        >
          {ALLOWANCE_TYPES.filter(t => !(bonus || []).some(a => a.type === t.value)).map(opt => (
            <MenuItem key={opt.value} onClick={() => handleAddAllowance(opt.value)}>
              {opt.label}
            </MenuItem>
          ))}
        </Menu>
      </Box>
      {(bonus || []).length === 0 && (
        <Typography variant="body2" color="text.secondary">Kein Bonus hinzugefügt.</Typography>
      )}
      {(bonus || []).map((a, idx) => {
        const typeLabel = ALLOWANCE_TYPES.find(t => t.value === a.type)?.label || a.type;
        return (
          <Box key={a.id || idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <TextField
              label="Typ"
              value={typeLabel}
              size="small"
              InputProps={{ readOnly: true }}
              sx={{ width: 180 }}
            />
            <TextField
              label="Betrag (€)"
              type="number"
              size="small"
              value={a.amount}
              onChange={e => handleAllowanceChange(idx, 'amount', e.target.value)}
              sx={{ width: 120 }}
            />
            <TextField
              label="Bemerkung"
              size="small"
              value={a.note || ''}
              onChange={e => handleAllowanceChange(idx, 'note', e.target.value)}
              sx={{ width: 180 }}
            />
            <IconButton
              aria-label="Entfernen"
              onClick={() => handleDeleteAllowance(idx)}
              size="small"
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        );
      })}
    </Box>
  );
}

export default FinancialBonusDetails;
