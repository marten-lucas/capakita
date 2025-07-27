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
import { useSaveLoad } from '../../hooks/useSaveLoad';
import { useSelector, useDispatch } from 'react-redux';
import { setSaveDialogOpen } from '../../store/simScenarioSlice';

function ScenarioSaveDialog() {
  const dispatch = useDispatch();
  const open = useSelector(state => state.simScenario.saveDialogOpen);
  const { saveData } = useSaveLoad();
  const [pwValue, setPwValue] = useState('');
  const [pwValue2, setPwValue2] = useState('');
  const [pwError, setPwError] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    if (pwValue !== pwValue2) {
      setPwError('Passwörter stimmen nicht überein.');
      return;
    }

    setIsSaving(true);
    const result = await saveData(pwValue);
    
    if (result.success) {
      setPwValue('');
      setPwValue2('');
      setPwError('');
      setShowPw(false);
      dispatch(setSaveDialogOpen(false));
    } else {
      setPwError(result.error);
    }
    setIsSaving(false);
  };

  const handleClose = () => {
    if (isSaving) return;
    setPwValue('');
    setPwValue2('');
    setPwError('');
    setShowPw(false);
    dispatch(setSaveDialogOpen(false));
  };

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>Szenarien speichern</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Passwort"
          type={showPw ? 'text' : 'password'}
          fullWidth
          value={pwValue}
          onChange={e => setPwValue(e.target.value)}
          disabled={isSaving}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label="Passwort anzeigen"
                  onClick={() => setShowPw(s => !s)}
                  edge="end"
                  disabled={isSaving}
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
          disabled={isSaving}
          sx={{ mt: 2 }}
        />
        {pwError && (
          <Typography color="error" variant="body2" sx={{ mt: 1 }}>
            {pwError}
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Das Passwort muss mindestens 8 Zeichen lang sein und Groß- und Kleinbuchstaben, 
          Zahlen sowie Sonderzeichen enthalten.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isSaving}>
          Abbrechen
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={isSaving}>
          {isSaving ? 'Speichere...' : 'Speichern'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ScenarioSaveDialog;
