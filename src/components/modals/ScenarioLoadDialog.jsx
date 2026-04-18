import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Typography, IconButton, InputAdornment, Checkbox, FormControlLabel } from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useSaveLoad } from '../../hooks/useSaveLoad';
import { useSelector, useDispatch } from 'react-redux';
import { setLoadDialogOpen } from '../../store/simScenarioSlice';

function ScenarioLoadDialog({ onLoaded }) {
  const dispatch = useDispatch();
  const open = useSelector(state => state.simScenario.loadDialogOpen);
  const { loadData } = useSaveLoad();
  const [pwValue, setPwValue] = useState('');
  const [pwError, setPwError] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnonymized, setIsAnonymized] = useState(true);

  useEffect(() => {
    if (open) {
      setIsAnonymized(true);
    }
  }, [open]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setPwError('');
    }
  };
  
  const handleCheckboxChange = (e) => {
    setIsAnonymized(e.target.checked);
  };

  const handleLoad = async () => {
    if (!file || !pwValue) {
      setPwError('Bitte Datei und Passwort eingeben.');
      return;
    }

    setIsLoading(true);
    // pass anonymization option to the loader
    const result = await loadData(file, pwValue, { isAnonymized });
    
    if (result.success) {
      setPwError('');
      setPwValue('');
      setFile(null);
      setIsAnonymized(true);
      dispatch(setLoadDialogOpen(false));
      if (onLoaded) onLoaded();
    } else {
      setPwError(result.error);
    }
    setIsLoading(false);
  };

  const handleDialogClose = () => {
    if (isLoading) return;
    setPwError('');
    setPwValue('');
    setFile(null);
    setShowPw(false);
    setIsAnonymized(true);
    dispatch(setLoadDialogOpen(false));
  };

  return (
    <Dialog open={open} onClose={handleDialogClose}>
      <DialogTitle>CapaKita-Datei laden</DialogTitle>
      <DialogContent>
        <Button 
          variant="contained" 
          component="label" 
          sx={{ mb: 2 }}
          disabled={isLoading}
        >
          Datei auswählen
          <input type="file" hidden accept=".enc,.txt" onChange={handleFileChange} />
        </Button>
        {file && (
          <Typography variant="body2" sx={{ mb: 2 }}>
            Ausgewählte Datei: {file.name}
          </Typography>
        )}
        <FormControlLabel
          control={
            <Checkbox checked={isAnonymized} onChange={handleCheckboxChange} disabled={isLoading} />
          }
          label="Daten anonymisieren"
        />
        <TextField
          margin="dense"
          label="Passwort"
          type={showPw ? 'text' : 'password'}
          fullWidth
          value={pwValue}
          onChange={e => setPwValue(e.target.value)}
          disabled={isLoading}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label="Passwort anzeigen"
                  onClick={() => setShowPw(s => !s)}
                  edge="end"
                  disabled={isLoading}
                >
                  {showPw ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            )
          }}
          error={!!pwError}
          helperText={pwError}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleDialogClose} disabled={isLoading}>
          Abbrechen
        </Button>
        <Button 
          variant="contained" 
          onClick={handleLoad} 
          disabled={!file || isLoading}
        >
          {isLoading ? 'Lade...' : 'Laden'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ScenarioLoadDialog;
