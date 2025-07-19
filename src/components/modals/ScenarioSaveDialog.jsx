import React, { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';

function ScenarioSaveDialog({ open, onClose, onSave }) {
  const [pwValue, setPwValue] = useState('');
  const [pwValue2, setPwValue2] = useState('');
  const [pwError, setPwError] = useState('');
  const [showPw, setShowPw] = useState(false);

  const handleSubmit = () => {
    if (!pwValue) {
      setPwError('Bitte Passwort eingeben.');
      return;
    }
    if (pwValue !== pwValue2) {
      setPwError('Passwörter stimmen nicht überein.');
      return;
    }
    setPwError('');
    onSave(pwValue);
    setPwValue('');
    setPwValue2('');
  };

  const handleClose = () => {
    setPwValue('');
    setPwValue2('');
    setPwError('');
    setShowPw(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>Passwort zum Speichern</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Passwort"
          type={showPw ? 'text' : 'password'}
          fullWidth
          value={pwValue}
          onChange={e => setPwValue(e.target.value)}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label="Passwort anzeigen"
                  onClick={() => setShowPw(s => !s)}
                  edge="end"
                >
                  {showPw ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            )
          }}
        />
        <TextField
          margin="dense"
          label="Passwort bestätigen"
          type={showPw ? 'text' : 'password'}
          fullWidth
          value={pwValue2}
          onChange={e => setPwValue2(e.target.value)}
          sx={{ mt: 2 }}
        />
        {pwError && (
          <Typography color="error" variant="body2" sx={{ mt: 1 }}>
            {pwError}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Abbrechen</Button>
        <Button onClick={handleSubmit} variant="contained">
          OK
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ScenarioSaveDialog;
