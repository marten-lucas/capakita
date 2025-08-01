import React, { useState } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useSelector, useDispatch } from 'react-redux';
import {
  addQualificationDef,
  updateQualificationDef,
  deleteQualificationDef
} from '../../store/simQualificationSlice';
import { useOverlayData } from '../../hooks/useOverlayData';

function OrgaTabQualificationDefs() {
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);

  // Use overlay hook to get base scenario info and effective qualification defs
  const { baseScenario, isBasedScenario, getEffectiveQualificationDefs, overlaysByScenario } = useOverlayData();
  const qualiDefs = getEffectiveQualificationDefs();

  // Remove currentScenarioDefs and use only qualiDefs from the hook

  // Memoize the function to check if qualification is from base scenario
  const isFromBaseScenario = React.useMemo(() => {
    if (!isBasedScenario || !baseScenario) {
      return () => false;
    }
    // Use qualiDefs from the hook for display, but check if the def is present in the current scenario's own defs
    const ownDefs = (state) =>
      state.simQualification.qualificationDefsByScenario[selectedScenarioId] || [];
    return (qualification) => {
      // Only present in base if not in current scenario's own defs
      return !ownDefs({simQualification: {qualificationDefsByScenario: { [selectedScenarioId]: qualiDefs }}}).some(def => def.key === qualification.key);
    };
  }, [isBasedScenario, baseScenario, qualiDefs, selectedScenarioId]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQualification, setEditingQualification] = useState(null);
  const [form, setForm] = useState({ key: '', name: '', IsExpert: true });
  const [error, setError] = useState('');

  const handleOpenDialog = (qualification = null) => {
    setEditingQualification(qualification);
    setForm(qualification ? { 
      key: qualification.key, 
      name: qualification.name, 
      IsExpert: qualification.IsExpert !== false // default true
    } : { key: '', name: '', IsExpert: true });
    setError('');
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingQualification(null);
    setForm({ key: '', name: '', IsExpert: true }); // Ensure all keys are present
    setError('');
  };

  const handleSave = () => {
    if (!form.key.trim() || !form.name.trim()) {
      setError('Buchstabe und Anzeigename sind erforderlich');
      return;
    }
    
    if (isBasedScenario) {
      // For based scenarios, use overlays
      const currentOverlayDefs = overlaysByScenario[selectedScenarioId]?.qualificationDefs || [];
      let updatedOverlayDefs;
      
      if (editingQualification) {
        // Update existing definition
        updatedOverlayDefs = currentOverlayDefs.map(def => 
          def.key === editingQualification.key ? { ...def, ...form } : def
        );
        // If not found in overlay, add it
        if (!updatedOverlayDefs.some(def => def.key === editingQualification.key)) {
          updatedOverlayDefs.push({ ...form });
        }
      } else {
        // Add new definition
        updatedOverlayDefs = [...currentOverlayDefs, { ...form }];
      }
      
      dispatch({
        type: 'simOverlay/setQualificationDefOverlay',
        payload: {
          scenarioId: selectedScenarioId,
          overlayData: updatedOverlayDefs
        }
      });
    } else {
      // For base scenarios, use regular actions
      if (editingQualification) {
        dispatch(updateQualificationDef({ scenarioId: selectedScenarioId, qualiKey: editingQualification.key, updates: form }));
      } else {
        dispatch(addQualificationDef({ scenarioId: selectedScenarioId, qualiDef: { ...form } }));
      }
    }
    handleCloseDialog();
  };

  // Add this handler for Enter key
  const handleDialogKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  };

  const handleDelete = (qualification) => {
    if (window.confirm(`Möchten Sie die Qualifikation "${qualification.name}" wirklich löschen?`)) {
      if (isBasedScenario) {
        // For based scenarios, remove from overlay or add a deletion marker
        const currentOverlayDefs = overlaysByScenario[selectedScenarioId]?.qualificationDefs || [];
        const updatedOverlayDefs = currentOverlayDefs.filter(def => def.key !== qualification.key);
        
        dispatch({
          type: 'simOverlay/setQualificationDefOverlay',
          payload: {
            scenarioId: selectedScenarioId,
            overlayData: updatedOverlayDefs
          }
        });
      } else {
        dispatch(deleteQualificationDef({ scenarioId: selectedScenarioId, qualiKey: qualification.key }));
      }
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Qualifikationen verwalten</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Qualifikation hinzufügen
        </Button>
      </Box>
      {qualiDefs.length === 0 ? (
        <Alert severity="info">
          Keine Qualifikationen definiert. Fügen Sie Qualifikationen hinzu oder importieren Sie Mitarbeiterdaten.
        </Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Buchstabe</TableCell>
                <TableCell>Anzeigename</TableCell>
                <TableCell>Fachkraft</TableCell>
                <TableCell align="right">Aktionen</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {qualiDefs.map((q) => {
                const fromBase = isFromBaseScenario(q);
                return (
                  <TableRow key={q.key} sx={{ opacity: fromBase ? 0.7 : 1 }}>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: '1.2em' }}>{q.key}</TableCell>
                    <TableCell>
                      {q.name}
                      {fromBase && <Typography variant="caption" color="text.secondary"> (von Basis)</Typography>}
                    </TableCell>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={q.IsExpert !== false}
                        readOnly
                        tabIndex={-1}
                        style={{ pointerEvents: 'none' }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(q)}
                        title="Bearbeiten"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(q)}
                        title="Löschen"
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingQualification ? 'Qualifikation bearbeiten' : 'Neue Qualifikation hinzufügen'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              label="Buchstabe"
              value={form.key}
              onChange={(e) => setForm({ ...form, key: e.target.value.toUpperCase().slice(0, 2) })}
              fullWidth
              error={!!error && !form.key}
              helperText={error && !form.key ? error : ''}
              autoFocus
              onKeyDown={handleDialogKeyDown}
            />
            <TextField
              label="Anzeigename"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              fullWidth
              error={!!error && !form.name}
              helperText={error && !form.name ? error : ''}
              onKeyDown={handleDialogKeyDown}
            />
            {/* Add IsExpert checkbox */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <input
                type="checkbox"
                checked={form.IsExpert}
                onChange={e => setForm({ ...form, IsExpert: e.target.checked })}
                id="isExpertCheckbox"
              />
              <label htmlFor="isExpertCheckbox">Fachkraft-Qualifikation</label>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Abbrechen</Button>
          <Button onClick={handleSave} variant="contained">
            {editingQualification ? 'Speichern' : 'Hinzufügen'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default OrgaTabQualificationDefs;
