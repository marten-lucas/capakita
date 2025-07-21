import React from 'react';
import { Box, TextField, Button, Typography } from '@mui/material';

function FinancialsDetail({ financial, onChange, onDelete }) {
  const handleField = (field, value) => {
    onChange({ ...financial, [field]: value });
  };

  return (
    <Box display="flex" flexDirection="column" gap={2}>
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
