import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Typography, IconButton, InputAdornment } from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import CryptoJS from 'crypto-js';
import { useDispatch } from 'react-redux';
import { setSelectedScenarioId, setSelectedItem } from '../../store/simScenarioSlice';
import { setStichtag, setSelectedGroups, setSelectedQualifications, setWeeklySelectedScenarioId, setMidtermSelectedScenarioId, setMidtermTimeDimension, setMidtermSelectedGroups, setMidtermSelectedQualifications, setChartToggles } from '../../store/chartSlice';

function ScenarioLoadDialog({ open, onClose, onLoaded }) {
  const [pwValue, setPwValue] = useState('');
  const [pwError, setPwError] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [file, setFile] = useState(null);

  const dispatch = useDispatch();

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const isStrongPassword = (pw) => {
    // At least 8 chars, one uppercase, one lowercase, one number, one special char
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(pw);
  };

  const handleLoad = async () => {
    if (!file) return;
    if (!pwValue) {
      setPwError('Bitte Passwort eingeben.');
      return;
    }
    if (!isStrongPassword(pwValue)) {
      setPwError('Passwort muss mindestens 8 Zeichen lang sein und Großbuchstaben, Kleinbuchstaben, Zahl und Sonderzeichen enthalten.');
      return;
    }
    try {
      const ciphertext = await file.text();
      const bytes = CryptoJS.AES.decrypt(ciphertext, pwValue);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      if (!decrypted) throw new Error('Falsches Passwort oder beschädigte Datei.');
      const data = JSON.parse(decrypted);

      // Set scenarios and selectedScenarioId
      if (data.scenarios) {
        // You may need to dispatch an action to set scenarios array if you have one
        // dispatch(setScenarios(data.scenarios));
      }
      dispatch(setSelectedScenarioId(data.selectedScenarioId || null));

      // Set chart store values if present
      if (data.chartStore) {
        if (data.chartStore.stichtag) dispatch(setStichtag(data.chartStore.stichtag));
        if (data.chartStore.selectedGroups) dispatch(setSelectedGroups(data.chartStore.selectedGroups));
        if (data.chartStore.selectedQualifications) dispatch(setSelectedQualifications(data.chartStore.selectedQualifications));
        if (data.chartStore.weeklySelectedScenarioId) dispatch(setWeeklySelectedScenarioId(data.chartStore.weeklySelectedScenarioId));
        if (data.chartStore.midtermSelectedScenarioId) dispatch(setMidtermSelectedScenarioId(data.chartStore.midtermSelectedScenarioId));
        if (data.chartStore.midtermTimeDimension) dispatch(setMidtermTimeDimension(data.chartStore.midtermTimeDimension));
        if (data.chartStore.midtermSelectedGroups) dispatch(setMidtermSelectedGroups(data.chartStore.midtermSelectedGroups));
        if (data.chartStore.midtermSelectedQualifications) dispatch(setMidtermSelectedQualifications(data.chartStore.midtermSelectedQualifications));
        if (data.chartStore.chartToggles) dispatch(setChartToggles(data.chartStore.chartToggles));
      }

      dispatch(setSelectedItem(null));
      setPwError('');
      setPwValue('');
      setFile(null);
      onClose();
      if (onLoaded) onLoaded();
    } catch (err) {
      setPwError('Fehler beim Entschlüsseln/Laden: ' + err.message);
    }
  };

  const handleDialogClose = () => {
    setPwError('');
    setPwValue('');
    setFile(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleDialogClose}>
      <DialogTitle>CapaKita-Datei laden</DialogTitle>
      <DialogContent>
        <Button variant="contained" component="label" sx={{ mb: 2 }}>
          Datei auswählen
          <input type="file" hidden accept=".enc,.txt" onChange={handleFileChange} />
        </Button>
        {file && <Typography variant="body2" sx={{ mb: 2 }}>Ausgewählte Datei: {file.name}</Typography>}
        <TextField
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
          error={!!pwError}
          helperText={pwError}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleDialogClose}>Abbrechen</Button>
        <Button variant="contained" onClick={handleLoad} disabled={!file}>
          Laden
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ScenarioLoadDialog;
