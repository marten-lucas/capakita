import React, { useMemo, useState } from 'react';
import { Box, TextField, Typography, MenuItem, Button, Table, TableBody, TableCell, TableHead, TableRow, IconButton, Menu } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useAvrExpenseCalculator } from '../../../utils/financialCalculators/avrExpenseCalculator';
import { useOverlayData } from '../../../hooks/useOverlayData';
import { calculateWorktimeFromBookings } from '../../../utils/bookingUtils';
import { getAllStagesForGroup } from '../../../utils/avr-calculator';
import { FINANCIAL_BONUS_REGISTRY } from '../../../config/financialTypeRegistry';
import FinancialsCards from './FinancialsCards'; // Import for nested accordion rendering

function AvrExpenseDetail({ financial, onChange, item }) {
  // Use calculator for all AVR logic
  const {
    groupOptions,
    avrSalary
  } = useAvrExpenseCalculator({ financial, onChange, item });

  // Overlay-aware data access
  const { getEffectiveBookings } = useOverlayData();
  const bookingsObj = getEffectiveBookings(item?.id);
  const bookings = useMemo(() => Object.values(bookingsObj || {}), [bookingsObj]);

  // Calculate working hours from bookings (sum of all booking hours)
  const calculatedWorkingHours = useMemo(() => {
    return calculateWorktimeFromBookings(bookings);
  }, [bookings]);

  // Extract type_details for editing
  const typeDetails = financial.type_details || {};

  // Handler for updating root-level fields (valid_from, valid_to)
  const updateRootFields = (updates) => {
    onChange({
      ...financial,
      ...updates
    });
  };

  // --- NEW: Get available stages for selected group from AVR data ---
  const stageDropdownOptions = useMemo(() => {
    if (!typeDetails.group) return [];
    // Use item's startdate or today as reference date
    const refDate = item?.startdate || new Date().toISOString().slice(0, 10);
    return getAllStagesForGroup(refDate, Number(typeDetails.group)).map(stage => ({
      value: stage,
      label: `Stufe ${stage}`
    }));
  }, [typeDetails.group, item?.startdate]);

  // Handler for updating type_details
  const updateTypeDetails = (updates) => {
    onChange({
      ...financial,
      type_details: { ...typeDetails, ...updates }
    });
  };

  // Local state for bonus menu anchor
  const [bonusMenuAnchor, setBonusMenuAnchor] = useState(null);

  // Handler for stacking bonuses as nested financials
  const handleAddBonus = (bonusType) => {
    const newBonus = {
      id: `${Date.now()}-${Math.random()}`,
      type: bonusType,
      label: FINANCIAL_BONUS_REGISTRY.find(b => b.value === bonusType)?.label || bonusType,
      type_details: {},
      financial: []
    };
    onChange({
      ...financial,
      financial: [...(Array.isArray(financial.financial) ? financial.financial : []), newBonus]
    });
  };

  

  // --- NEW: Sync Eintrittsdatum with data item's startdate if not set ---
  const effectiveStartDate = typeDetails.StartDate || item?.startdate || '';
  // --- NEW: Use calculated working hours unless user overrides ---
  const effectiveWorkingHours = typeDetails.WorkingHours !== undefined && typeDetails.WorkingHours !== ''
    ? typeDetails.WorkingHours
    : calculatedWorkingHours;

  // Compute available bonus types from bonus registry
  const bonusTypeRegistry = useMemo(() =>
    FINANCIAL_BONUS_REGISTRY.filter(t =>
      t.allowed.includes('capacity')
    ).map(t => ({ value: t.value, label: t.label })),
    []
  );

  // Handler for opening bonus menu
  const handleBonusMenuOpen = (event) => {
    setBonusMenuAnchor(event.currentTarget);
  };

  // Handler for closing bonus menu
  const handleBonusMenuClose = () => {
    setBonusMenuAnchor(null);
  };

  // Handler for selecting a bonus type
  const handleSelectBonusType = (type) => {
    handleAddBonus(type);
    handleBonusMenuClose();
  };

  return (
    <Box display="flex" flexDirection="column" gap={2} position="relative">
      {/* Valid from/to fields */}
      <Box display="flex" gap={2}>
        <TextField
          label="Gültig von"
          type="date"
          value={financial.valid_from || ''}
          onChange={e => updateRootFields({ valid_from: e.target.value })}
          InputLabelProps={{ shrink: true }}
          size="small"
          sx={{ maxWidth: 180 }}
        />
        <TextField
          label="Gültig bis"
          type="date"
          value={financial.valid_to || ''}
          onChange={e => updateRootFields({ valid_to: e.target.value })}
          InputLabelProps={{ shrink: true }}
          size="small"
          sx={{ maxWidth: 180 }}
        />
      </Box>
      {/* Group selection */}
      <TextField
        select
        label="Gruppe"
        value={typeDetails.group || ''}
        onChange={e => updateTypeDetails({ group: Number(e.target.value), stage: '' })}
      >
        {groupOptions.map(opt => (
          <MenuItem key={opt.group_id} value={opt.group_id}>
            {opt.group_name}
          </MenuItem>
        ))}
      </TextField>
      {/* Stage selection */}
      <TextField
        select
        label="Stufe"
        value={typeDetails.stage || ''}
        onChange={e => updateTypeDetails({ stage: Number(e.target.value) })}
        disabled={!typeDetails.group}
      >
        {stageDropdownOptions.map(opt => (
          <MenuItem key={opt.value} value={opt.value}>
            {opt.label}
          </MenuItem>
        ))}
      </TextField>
      {/* Eintrittsdatum as datepicker, synced with data item */}
      <TextField
        label="Eintrittsdatum"
        type="date"
        value={effectiveStartDate}
        onChange={e => updateTypeDetails({ StartDate: e.target.value })}
        InputLabelProps={{ shrink: true }}
        size="small"
        sx={{ maxWidth: 180 }}
      />
      {/* NoOfChildren */}
      <TextField
        label="Anzahl Kinder"
        type="number"
        size="small"
        value={typeDetails.NoOfChildren || ''}
        onChange={e => updateTypeDetails({ NoOfChildren: e.target.value })}
        sx={{ maxWidth: 180 }}
        inputProps={{ min: 0 }}
      />
      {/* Wochenstunden, calculated from bookings */}
      <TextField
        label="Wochenstunden"
        type="number"
        size="small"
        value={effectiveWorkingHours}
        onChange={e => updateTypeDetails({ WorkingHours: e.target.value })}
        sx={{ maxWidth: 180 }}
        inputProps={{ min: 0 }}
        helperText={
          calculatedWorkingHours !== undefined && calculatedWorkingHours !== ''
            ? `Berechnet aus Buchungen: ${calculatedWorkingHours} h/Woche`
            : undefined
        }
      />
      {avrSalary !== null && (
        <Typography variant="body2" color="primary">
          AVR-Gehalt: {avrSalary.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
        </Typography>
      )}

      {/* Bonus-Tabelle */}
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="subtitle2">Boni</Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={handleBonusMenuOpen}
          >
            Bonus hinzufügen
          </Button>
          <Menu
            anchorEl={bonusMenuAnchor}
            open={Boolean(bonusMenuAnchor)}
            onClose={handleBonusMenuClose}
          >
            {bonusTypeRegistry.map(bonusType => (
              <MenuItem
                key={bonusType.value}
                onClick={() => handleSelectBonusType(bonusType.value)}
              >
                {bonusType.label}
              </MenuItem>
            ))}
          </Menu>
        </Box>

      </Box>
     
    </Box>
  );
}

export default AvrExpenseDetail;