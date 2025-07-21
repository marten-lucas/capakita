import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Typography, IconButton, InputAdornment } from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import CryptoJS from 'crypto-js';
import useSimScenarioStore from '../../store/simScenarioStore';
import useChartStore from '../../store/chartStore';

function ScenarioLoadDialog({ open, onClose, onLoaded }) {
  const [pwValue, setPwValue] = useState('');
  const [pwError, setPwError] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [file, setFile] = useState(null);

  const setSelectedItem = useSimScenarioStore(state => state.setSelectedItem);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleLoad = async () => {
    if (!file) return;
    if (!pwValue) {
      setPwError('Bitte Passwort eingeben.');
      return;
    }
    try {
      const ciphertext = await file.text();
      const bytes = CryptoJS.AES.decrypt(ciphertext, pwValue);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      if (!decrypted) throw new Error('Falsches Passwort oder beschädigte Datei.');
      const data = JSON.parse(decrypted);
      useSimScenarioStore.setState({
        scenarios: data.scenarios || [],
        selectedScenarioId: data.selectedScenarioId || null
      });
      useChartStore.setState(data.chartStore || {});
      setSelectedItem(null);
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
