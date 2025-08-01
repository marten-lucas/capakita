import React, { useState, useMemo } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Alert, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField
} from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import { useOverlayData } from '../../hooks/useOverlayData';
import {
  addFinancialDefThunk,
  updateFinancialDefThunk,
  deleteFinancialDefThunk
} from '../../store/simFinancialsSlice';

function OrgaTabRateDefs() {
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const scenarioDefs = useSelector(state => state.simFinancials.financialDefsByScenario[selectedScenarioId] || []);

  // Overlay systematik: get effective financialDefs
  const { baseScenario, isBasedScenario, overlaysByScenario } = useOverlayData();
  
  // Memoize the financial defs to prevent unnecessary re-renders
  const financialDefs = useMemo(() => {
    const baseDefs = baseScenario?.financialDefs || [];
    const overlayDefs = overlaysByScenario[selectedScenarioId]?.financialDefs || [];
    
    return isBasedScenario
      ? [...baseDefs, ...overlayDefs]
      : scenarioDefs;
  }, [baseScenario, isBasedScenario, overlaysByScenario, selectedScenarioId, scenarioDefs]);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDef, setEditingDef] = useState(null);
  const [form, setForm] = useState({
    id: '',
    description: '',
    valid_from: '',
    valid_to: '',
    feeGroups: []
  });

  const handleOpenDialog = (def = null) => {
    setEditingDef(def);
    setForm(def ? { ...def } : {
      id: '',
      description: '',
      valid_from: '',
      valid_to: '',
      feeGroups: []
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingDef(null);
    setForm({
      id: '',
      description: '',
      valid_from: '',
      valid_to: '',
      feeGroups: []
    });
  };

  const handleSave = () => {
    if (!form.description.trim()) return;
    if (editingDef) {
      dispatch(updateFinancialDefThunk({
        scenarioId: selectedScenarioId,
        financialDefId: editingDef.id,
        updates: form
      }));
    } else {
      dispatch(addFinancialDefThunk({
        scenarioId: selectedScenarioId,
        financialDef: form
      }));
    }
    handleCloseDialog();
  };

  const handleDelete = (def) => {
    if (window.confirm(`Beitragsordnung "${def.description}" wirklich löschen?`)) {
      dispatch(deleteFinancialDefThunk({
        scenarioId: selectedScenarioId,
        financialDefId: def.id
      }));
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Beitragsordnungen</Typography>
        <Button variant="contained" onClick={() => handleOpenDialog()}>
          Neue Beitragsordnung
        </Button>
      </Box>
      {financialDefs.length === 0 ? (
        <Alert severity="info">
          Keine Beitragsordnungen definiert.
        </Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Beschreibung</TableCell>
                <TableCell>Gültig von</TableCell>
                <TableCell>Gültig bis</TableCell>
                <TableCell>Gruppen</TableCell>
                <TableCell align="right">Aktionen</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {financialDefs.map(def => (
                <TableRow key={def.id}>
                  <TableCell>{def.id}</TableCell>
                  <TableCell>{def.description}</TableCell>
                  <TableCell>{def.valid_from}</TableCell>
                  <TableCell>{def.valid_to}</TableCell>
                  <TableCell>
                    {def.feeGroups?.map(g => g.groupRef).join(', ')}
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => handleOpenDialog(def)}>Bearbeiten</Button>
                    <Button size="small" color="error" onClick={() => handleDelete(def)}>Löschen</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingDef ? 'Beitragsordnung bearbeiten' : 'Neue Beitragsordnung'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Beschreibung"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              fullWidth
            />
            <TextField
              label="Gültig von"
              value={form.valid_from}
              onChange={e => setForm({ ...form, valid_from: e.target.value })}
              fullWidth
            />
            <TextField
              label="Gültig bis"
              value={form.valid_to}
              onChange={e => setForm({ ...form, valid_to: e.target.value })}
              fullWidth
            />
            {/* FeeGroups als JSON für schnellen Prototyp */}
            <TextField
              label="Gruppen & Gebühren (JSON)"
              value={JSON.stringify(form.feeGroups)}
              onChange={e => {
                try {
                  setForm({ ...form, feeGroups: JSON.parse(e.target.value) });
                } catch {
                  // ignore parse error
                }
              }}
              fullWidth
              multiline
              minRows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Abbrechen</Button>
          <Button onClick={handleSave} variant="contained">
            {editingDef ? 'Speichern' : 'Hinzufügen'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default OrgaTabRateDefs;