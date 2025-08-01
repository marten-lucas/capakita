import React, { useState } from 'react';
import { Box, TextField, Button, Typography, MenuItem, IconButton, Table, TableBody, TableCell, TableHead, TableRow, Checkbox, Menu } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { 
  getSalaryForGroupAndStage, 
  normalizeDateString, 
  getAllSalaryGroups, 
  getAllSalaryStages, 
  getAllBonusTypes,
  getBonusDefinition,
  calcAvrChildBonus,
  calcAvrInstructorBonus,
  calcAvrYearlyBonus} from '../../../utils/avr-calculator';
import { FINANCIAL_TYPE_REGISTRY } from '../../../config/financialTypeRegistry';

function FinancialsDetail({ financial, onChange, onDelete, item }) {
  // Find registry entry for this financial type
  const typeEntry = FINANCIAL_TYPE_REGISTRY.find(t => t.value === financial.type);
  if (!typeEntry) return null;
  const DetailComponent = typeEntry.component;
  return (
    <DetailComponent
      financial={financial}
      onChange={onChange}
      onDelete={onDelete}
      item={item}
    />
  );
}

export default FinancialsDetail;