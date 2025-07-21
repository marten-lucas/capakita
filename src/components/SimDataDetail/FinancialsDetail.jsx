import React from 'react';
import { Box, TextField, Button, Typography, MenuItem, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import avgData from '../../assets/avg-data/avg-data-2024.json'; // Adjust as needed

function FinancialsDetail({ financial, onChange, onDelete, item }) {
  console.log('FinancialsDetail item:', item); // Debug: verify item prop

  const handleField = (field, value) => {
    onChange({ ...financial, [field]: value });
  };

  // Get Eintrittsdatum from parseddata.startdate, fallback to empty string
  const eintrittsdatum = item?.parseddata?.startdate
    ? item.parseddata.startdate.split('.').reverse().join('-')
    : '';

  if (financial.type === 'expense-avr') {
    // Gruppe options
    const groupOptions = avgData.salery_groups.map(g => ({
      value: g.group_id,
      label: g.group_name
    }));

    // Find selected group
    const selectedGroup = avgData.salery_groups.find(
      g => g.group_id === financial.group
    );

    // Stufe options
    const stageOptions = selectedGroup
      ? selectedGroup.amount.map(a => ({
          value: a.stage,
          label: `Stufe ${a.stage}`
        }))
      : [];

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
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
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
        <Box>
          <IconButton
            aria-label="Entfernen"
            onClick={onDelete}
            size="small"
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    );
  }

  return (
    <Box display="flex" flexDirection="column" gap={2} position="relative">
      <IconButton
        aria-label="Entfernen"
        onClick={onDelete}
        size="small"
        sx={{ position: 'absolute', top: 0, right: 0 }}
      >
        <DeleteIcon fontSize="small" />
      </IconButton>
      <Typography variant="body2">{financial.label}</Typography>
      <TextField
        label="Betrag (€)"
        type="number"
        size="small"
        value={financial.amount}
        onChange={e => handleField('amount', e.target.value)}
        sx={{ maxWidth: 180 }}
      />
      <Box display="flex" gap={2}>
        <TextField
          label="von"
          type="date"
          size="small"
          value={financial.from}
          onChange={e => handleField('from', e.target.value)}
        />
        <TextField
          label="bis"
          type="date"
          size="small"
          value={financial.to}
          onChange={e => handleField('to', e.target.value)}
        />
      </Box>
      <TextField
        label="Bemerkung"
        size="small"
        value={financial.note}
        onChange={e => handleField('note', e.target.value)}
        multiline
        minRows={2}
        maxRows={4}
      />
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

export default FinancialsDetail;
