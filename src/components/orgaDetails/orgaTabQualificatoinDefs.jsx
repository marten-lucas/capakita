import React, { useState, useMemo } from 'react';
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
import { createSelector } from '@reduxjs/toolkit';
import { useOverlayData } from '../../hooks/useOverlayData';

// Memoized selector for qualiDefs
const getQualiDefs = createSelector(
  [
    state => state.simQualification.qualificationDefsByScenario,
    (state, scenarioId, baseScenarioId) => ({ scenarioId, baseScenarioId })
  ],
  (qualificationDefsByScenario, { scenarioId, baseScenarioId }) => {
    const currentDefs = qualificationDefsByScenario[scenarioId] || [];
    const baseDefs = baseScenarioId ? (qualificationDefsByScenario[baseScenarioId] || []) : [];
    
    // Merge base and current, with current taking precedence for same keys
    const merged = [...baseDefs];
    currentDefs.forEach(currentDef => {
      const existingIndex = merged.findIndex(def => def.key === currentDef.key);
      if (existingIndex >= 0) {
        merged[existingIndex] = currentDef; // Override base definition
      } else {
        merged.push(currentDef); // Add new definition
      }
    });
    
    return merged;
  }
);

// Create a stable selector for current scenario definitions
const getCurrentScenarioDefs = createSelector(
  [
    state => state.simQualification.qualificationDefsByScenario,
    (state, scenarioId) => scenarioId
  ],
  (qualificationDefsByScenario, scenarioId) => qualificationDefsByScenario[scenarioId] || []
);

function OrgaTabQualificationDefs() {
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  
  // Use overlay hook to get base scenario info
  const { baseScenario, isBasedScenario } = useOverlayData();
  
  const qualiDefs = useSelector(state => 
    getQualiDefs(state, selectedScenarioId, baseScenario?.id)
  );

  // Get current scenario definitions for checking if item is from base
  const currentScenarioDefs = useSelector(state => 
    getCurrentScenarioDefs(state, selectedScenarioId)
  );

  // Memoize the function to check if qualification is from base scenario
  const isFromBaseScenario = useMemo(() => {
    if (!isBasedScenario || !baseScenario) {
      return () => false;
    }
    return (qualification) => {
      return !currentScenarioDefs.some(def => def.key === qualification.key);
    };
  }, [isBasedScenario, baseScenario, currentScenarioDefs]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQualification, setEditingQualification] = useState(null);
  const [form, setForm] = useState({ key: '', name: '' });
  const [error, setError] = useState('');

  const handleOpenDialog = (qualification = null) => {
    setEditingQualification(qualification);
    setForm(qualification ? { key: qualification.key, name: qualification.name } : { key: '', name: '' });
    setError('');
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingQualification(null);
    setForm({ key: '', name: '' });
    setError('');
  };

  const handleSave = () => {
    if (!form.key.trim() || !form.name.trim()) {
      setError('Buchstabe und Anzeigename sind erforderlich');
      return;
    }
    if (editingQualification) {
      // Always update in current scenario
      dispatch(updateQualificationDef({ scenarioId: selectedScenarioId, qualiKey: editingQualification.key, updates: form }));
    } else {
      // Always add to current scenario
      dispatch(addQualificationDef({ scenarioId: selectedScenarioId, qualiDef: { ...form } }));
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
      // Always delete from current scenario
      dispatch(deleteQualificationDef({ scenarioId: selectedScenarioId, qualiKey: qualification.key }));
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
