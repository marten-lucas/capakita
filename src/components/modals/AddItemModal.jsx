// TODO: use stores
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Box,
  Typography
} from '@mui/material';

function AddItemModal({ open, onClose, onAdd }) {
  const [itemType, setItemType] = useState('demand');

  const handleSubmit = () => {
    const newItem = {
      id: Date.now(), // Simple ID generation
      type: itemType,
      name: itemType === 'demand' ? 'Neues Kind' : 'Neuer Mitarbeiter',
      rawdata: {
        source: 'manual entry',
        data: {}
      },
      parseddata: {
        startdate: '',
        enddate: '',
        booking: [],
        group: []
      },
      modifications: [],
      modifiers: {},
      simudata: {}
    };

    // Add specific fields based on item type
    if (itemType === 'demand') {
      newItem.parseddata.geburtsdatum = '';
    } else if (itemType === 'capacity') {
      newItem.parseddata.qualification = '';
      newItem.parseddata.vacation = '';
      newItem.parseddata.worktime = '';
    }

    onAdd(newItem);
    handleClose();
  };

  const handleClose = () => {
    setItemType('demand');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Neuen Eintrag hinzufügen</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
          <Typography variant="body1" color="text.secondary">
            Wählen Sie den Typ des neuen Eintrags. Alle weiteren Details können Sie anschließend im Detail-Formular bearbeiten.
          </Typography>
          
          <FormControl component="fieldset">
            <FormLabel component="legend">Typ</FormLabel>
            <RadioGroup
              value={itemType}
              onChange={(e) => setItemType(e.target.value)}
              sx={{ mt: 1 }}
            >
              <FormControlLabel 
                value="demand" 
                control={<Radio />} 
                label="Bedarf (Kind)" 
              />
              <FormControlLabel 
                value="capacity" 
                control={<Radio />} 
                label="Kapazität (Mitarbeiter)" 
              />
            </RadioGroup>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Abbrechen</Button>
        <Button onClick={handleSubmit} variant="contained">Hinzufügen</Button>
      </DialogActions>
    </Dialog>
  );
}

export default AddItemModal;
