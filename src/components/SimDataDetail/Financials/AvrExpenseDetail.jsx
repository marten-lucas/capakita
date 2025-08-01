import React, { useState } from 'react';
import { Box, TextField, Typography, MenuItem, Button, Table, TableBody, TableCell, TableHead, TableRow, Checkbox, IconButton, Menu } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useAvrExpenseCalculator } from '../../../utils/financialCalculators/avrExpenseCalculator';

function AvrExpenseDetail({ financial, onChange, onDelete, item }) {
  // Use calculator for all AVR logic
  const {
    groupOptions,
    stageOptions,
    avrSalary,
    bonusRows,
    eintrittsdatum,
    wochenstunden,
    handleBonusDateChange,
    handleBonusDelete,
    handleBonusAdd,
    availableBonusTypes,
    filteredBonusRows,
    bonusMenuAnchor,
    setBonusMenuAnchor,
    bonusMenuOpen,
  } = useAvrExpenseCalculator({ financial, onChange, item });

  return (
    <Box display="flex" flexDirection="column" gap={2} position="relative">
      <TextField
        select
        label="Gruppe"
        value={financial.group || ''}
        onChange={e =>
          onChange({ ...financial, group: Number(e.target.value), stage: '' })
        }
      >
        {groupOptions.map(opt => (
          <MenuItem key={opt.group_id} value={opt.group_id}>
            {opt.group_name}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        label="Stufe"
        value={financial.stage || ''}
        onChange={e =>
          onChange({ ...financial, stage: Number(e.target.value) })
        }
        disabled={!financial.group}
      >
        {stageOptions.map(opt => (
          <MenuItem key={opt.value} value={opt.value}>
            {opt.label}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        label="Eintrittsdatum"
        value={eintrittsdatum}
        InputProps={{ readOnly: true }}
        disabled
      />
      <TextField
        label="Anzahl Kinder"
        type="number"
        size="small"
        value={financial.kinderanzahl || ''}
        onChange={e => onChange({ ...financial, kinderanzahl: e.target.value })}
        sx={{ maxWidth: 180 }}
        inputProps={{ min: 0 }}
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
            onClick={(e) => setBonusMenuAnchor(e.currentTarget)}
            disabled={availableBonusTypes.length === 0}
          >
            Bonus hinzufügen
          </Button>
        </Box>
        <Menu
          anchorEl={bonusMenuAnchor}
          open={bonusMenuOpen}
          onClose={() => setBonusMenuAnchor(null)}
        >
          {availableBonusTypes.map((bonus) => (
            <MenuItem key={bonus.value} onClick={() => handleBonusAdd(bonus.value)}>
              {bonus.label}
            </MenuItem>
          ))}
        </Menu>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Auszahlung</TableCell>
              <TableCell>Betrag</TableCell>
              <TableCell>Fortzahlung</TableCell>
              <TableCell>Gültig von</TableCell>
              <TableCell>Gültig bis</TableCell>
              <TableCell>Aktion</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredBonusRows.map((row) => (
              <TableRow key={row.value}>
                <TableCell>
                  {row.label}
                  {row.payoutDate && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      Auszahlung: {row.payoutDate}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>{row.payout}</TableCell>
                <TableCell>
                  {row.amount !== null && row.amount !== undefined && row.amount !== ''
                    ? Number(row.amount).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
                    : ''}
                </TableCell>
                <TableCell>
                  <Checkbox checked={row.continueOnAbsence} disabled />
                </TableCell>
                <TableCell>
                  {row.startInput ? (
                    <TextField
                      type="date"
                      size="small"
                      value={row.bonusStart || ''}
                      onChange={e => handleBonusDateChange(row.value, 'start', e.target.value)}
                      sx={{ minWidth: 120 }}
                    />
                  ) : (
                    row.bonusStart ? row.bonusStart : ''
                  )}
                </TableCell>
                <TableCell>
                  {row.endInput ? (
                    <TextField
                      type="date"
                      size="small"
                      value={row.bonusEnd || ''}
                      onChange={e => handleBonusDateChange(row.value, 'end', e.target.value)}
                      sx={{ minWidth: 120 }}
                    />
                  ) : (
                    row.bonusEnd ? row.bonusEnd : ''
                  )}
                </TableCell>
                <TableCell>
                  <IconButton
                    aria-label="Entfernen"
                    size="small"
                    onClick={() => handleBonusDelete(row.value)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      <Button
        variant="outlined"
        color="error"
        size="small"
        onClick={onDelete}
      >
        Entfernen
      </Button>
    </Box>
  );
}

export default AvrExpenseDetail;