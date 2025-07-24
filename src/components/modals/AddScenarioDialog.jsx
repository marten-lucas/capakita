import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box } from '@mui/material';
import { useDispatch } from 'react-redux';
import { addScenario } from '../../store/simScenarioSlice';

function AddScenarioDialog({ open, onClose, onAdded }) {
  const dispatch = useDispatch();

  const [form, setForm] = useState({
    name: 'Neues Szenario',
    remark: '',
    confidence: 50,
    likelihood: 50,
    baseScenarioId: null
  });

  const handleChange = (field, value) => {
    setForm(f => ({ ...f, [field]: value }));
  };

  const handleAdd = () => {
    dispatch(addScenario(form));
    if (onAdded) onAdded();
    setForm({
      name: 'Neues Szenario',
      remark: '',
      confidence: 50,
      likelihood: 50,
      baseScenarioId: null
    });
  };

  const handleDialogClose = () => {
    setForm({
      name: 'Neues Szenario',
      remark: '',
      confidence: 50,
      likelihood: 50,
      baseScenarioId: null
    });
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleDialogClose} maxWidth="sm" fullWidth>
      <DialogTitle>Leeres Szenario anlegen</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Szenarioname"
            value={form.name}
            onChange={e => handleChange('name', e.target.value)}
            fullWidth
            autoFocus
            size="small"
          />
          <TextField
            label="Bemerkung"
            value={form.remark}
            onChange={e => handleChange('remark', e.target.value)}
            fullWidth
            multiline
            minRows={2}
            maxRows={4}
            size="small"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleDialogClose}>Abbrechen</Button>
        <Button onClick={handleAdd} variant="contained">
          Anlegen
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default AddScenarioDialog;
