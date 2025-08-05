import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Box, TextField, Typography, MenuItem, Button, IconButton, Menu, List, ListItem, ListItemText, ListItemSecondaryAction } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useAvrExpenseCalculator } from '../../../../utils/financialCalculators/avrExpenseCalculator';
import { useOverlayData } from '../../../../hooks/useOverlayData';
import { calculateWorktimeFromBookings } from '../../../../utils/bookingUtils';
import { getAllStagesForGroup } from '../../../../utils/avr-calculator';

// Define bonus registry inline to avoid circular dependency
const BONUS_REGISTRY = [
  {
    value: 'bonus-yearly',
    label: 'Jahressonderzahlung',
    component: () => import('./Bonus/BonusYearlyDetail'),
    unique: true,
    deleteable: false,
  },
  {
    value: 'bonus-children',
    label: 'Kinderzuschlag',
    component: () => import('./Bonus/BonusChildrenDetail'),
    unique: false,
    deleteable: false,
  },
  {
    value: 'bonus-instructor',
    label: 'Praxisanleiterzulage',
    component: () => import('./Bonus/BonusInstructorDetail'),
    unique: false,
    deleteable: true,
  },
];

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

  // --- Always add yearly bonus if not present ---
  useEffect(() => {
    const bonuses = Array.isArray(financial.financial) ? financial.financial : [];
    const yearlyBonusIdx = bonuses.findIndex(b => b.type === 'bonus-yearly');
    if (yearlyBonusIdx === -1) {
      const newBonus = {
        id: `${Date.now()}-${Math.random()}`,
        type: 'bonus-yearly',
        label: BONUS_REGISTRY.find(b => b.value === 'bonus-yearly')?.label || 'Jahressonderzahlung',
        type_details: {},
        financial: []
      };
      onChange({
        ...financial,
        financial: [...bonuses, newBonus]
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  // --- Child Bonus Sync Logic ---
  // Use a ref to avoid infinite loops when onChange triggers a re-render
  const lastNoOfChildrenRef = useRef();

  useEffect(() => {
    const noOfChildren = Number(typeDetails.NoOfChildren) || 0;
    const bonuses = Array.isArray(financial.financial) ? financial.financial : [];
    const childBonusIdx = bonuses.findIndex(b => b.type === 'bonus-children');
    // Prevent unnecessary updates
    if (lastNoOfChildrenRef.current === noOfChildren && ((childBonusIdx !== -1) === (noOfChildren > 0))) {
      return;
    }
    lastNoOfChildrenRef.current = noOfChildren;
    if (noOfChildren > 0) {
      // Add or update child bonus
      if (childBonusIdx === -1) {
        const newBonus = {
          id: `${Date.now()}-${Math.random()}`,
          type: 'bonus-children',
          label: BONUS_REGISTRY.find(b => b.value === 'bonus-children')?.label || 'Kinderzuschlag',
          type_details: { noOfChildren },
          financial: []
        };
        onChange({
          ...financial,
          financial: [...bonuses, newBonus]
        });
      } else {
        const bonus = bonuses[childBonusIdx];
        if (bonus.type_details?.noOfChildren !== noOfChildren) {
          const updatedBonuses = [...bonuses];
          updatedBonuses[childBonusIdx] = {
            ...bonus,
            type_details: { ...bonus.type_details, noOfChildren }
          };
          onChange({
            ...financial,
            financial: updatedBonuses
          });
        }
      }
    } else if (childBonusIdx !== -1) {
      const updatedBonuses = [...bonuses];
      updatedBonuses.splice(childBonusIdx, 1);
      onChange({
        ...financial,
        financial: updatedBonuses
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeDetails.NoOfChildren, financial.financial]);

  // --- Sync Enddatum with data item's enddate if not set or if item.enddate changes ---
  useEffect(() => {
    if (item?.enddate && (!financial.enddate || financial.enddate !== item.enddate)) {
      onChange({
        ...financial,
        enddate: item.enddate
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.enddate]);

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
      label: BONUS_REGISTRY.find(b => b.value === bonusType)?.label || bonusType,
      type_details: {},
      financial: []
    };
    onChange({
      ...financial,
      financial: [...(Array.isArray(financial.financial) ? financial.financial : []), newBonus]
    });
  };

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

  const handleDeleteBonus = (bonusId) => {
    const updatedBonuses = (financial.financial || []).filter(b => b.id !== bonusId);
    onChange({
      ...financial,
      financial: updatedBonuses
    });
  };

  // --- NEW: Sync Eintrittsdatum with data item's startdate if not set ---
  const effectiveStartDate = typeDetails.StartDate || item?.startdate || '';
  // --- NEW: Use calculated working hours unless user overrides ---
  const effectiveWorkingHours = typeDetails.WorkingHours !== undefined && typeDetails.WorkingHours !== ''
    ? typeDetails.WorkingHours
    : calculatedWorkingHours;

  // Compute available bonus types from bonus registry, disabling unique types already present
  const bonusTypeRegistry = useMemo(() => {
    const bonuses = Array.isArray(financial.financial) ? financial.financial : [];
    return BONUS_REGISTRY.map(t => {
      const isPresent = !!bonuses.find(b => b.type === t.value);
      return {
        ...t,
        disabled: t.unique && isPresent
      };
    });
  }, [financial.financial]);

  // Load bonus components dynamically
  const [loadedBonusComponents, setLoadedBonusComponents] = useState({});

  useEffect(() => {
    const bonuses = Array.isArray(financial.financial) ? financial.financial : [];
    bonuses.forEach(bonus => {
      const registry = BONUS_REGISTRY.find(b => b.value === bonus.type);
      if (registry && !loadedBonusComponents[bonus.type]) {
        registry.component().then(module => {
          setLoadedBonusComponents(prev => ({
            ...prev,
            [bonus.type]: module.default
          }));
        });
      }
    });
  }, [financial.financial, loadedBonusComponents]);

  // Helper to render bonus detail component
  const renderBonusDetail = (bonus) => {
    const BonusDetail = loadedBonusComponents[bonus.type];
    if (!BonusDetail) return null;
    return (
      <BonusDetail
        financial={bonus}
        parentFinancial={financial}
        onChange={updatedBonus => {
          const updatedBonuses = (financial.financial || []).map(b => b.id === bonus.id ? updatedBonus : b);
          onChange({
            ...financial,
            financial: updatedBonuses
          });
        }}
      />
    );
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
      <TextField
          label="Enddatum"
          type="date"
          value={financial.enddate || ''}
          onChange={e => updateRootFields({ enddate: e.target.value })}
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
                disabled={bonusType.disabled}
              >
                {bonusType.label}
              </MenuItem>
            ))}
          </Menu>
        </Box>
        <List dense>
          {(Array.isArray(financial.financial) ? financial.financial : []).map(bonus => {
            const registry = BONUS_REGISTRY.find(b => b.value === bonus.type);
            const deleteable = registry?.deleteable !== false;
            return (
              <ListItem key={bonus.id} alignItems="flex-start" sx={{ pl: 0, flexDirection: 'column', alignItems: 'stretch' }}>
                <Box display="flex" alignItems="center" width="100%">
                  <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                    {bonus.label || bonus.type}
                  </Typography>
                  <IconButton
                    edge="end"
                    aria-label="delete"
                    size="small"
                    onClick={() => handleDeleteBonus(bonus.id)}
                    disabled={!deleteable}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
                <Box mt={1}>
                  {renderBonusDetail(bonus)}
                </Box>
              </ListItem>
            );
          })}
        </List>
      </Box>
     
    </Box>
  );
}

export default AvrExpenseDetail;