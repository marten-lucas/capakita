import React, { useState } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert
} from '@mui/material';
import GroupIcon from '@mui/icons-material/Group';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useSelector, useDispatch } from 'react-redux';
import { addGroupDef, updateGroupDef, deleteGroupDef } from '../../store/simGroupSlice';
import IconPicker from './IconPicker';
import { createSelector } from '@reduxjs/toolkit';

const getGroupDefs = createSelector(
  [
    state => state.simGroup.groupDefsByScenario,
    (state, scenarioId) => scenarioId
  ],
  (groupDefsByScenario, scenarioId) => groupDefsByScenario[scenarioId] || []
);

function OrgaTabGroupDefs() {
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const groupDefs = useSelector(state => getGroupDefs(state, selectedScenarioId));

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [groupForm, setGroupForm] = useState({ name: '', icon: '👥' });
  const [error, setError] = useState('');

  const handleOpenDialog = (group = null) => {
    setEditingGroup(group);
    setGroupForm(group ? { name: group.name, icon: group.icon } : { name: '', icon: '👥' });
    setError('');
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingGroup(null);
    setGroupForm({ name: '', icon: '👥' });
    setError('');
  };

  const handleSaveGroup = () => {
    if (!groupForm.name.trim()) {
      setError('Gruppenname ist erforderlich');
      return;
    }
    if (editingGroup) {
      dispatch(updateGroupDef({ scenarioId: selectedScenarioId, groupId: editingGroup.id, updates: groupForm }));
    } else {
      dispatch(addGroupDef({ scenarioId: selectedScenarioId, groupDef: { ...groupForm } }));
    }
    handleCloseDialog();
  };

  const handleDeleteGroup = (group) => {
    if (window.confirm(`Möchten Sie die Gruppe "${group.name}" wirklich löschen?`)) {
      dispatch(deleteGroupDef({ scenarioId: selectedScenarioId, groupId: group.id }));
    }
  };

  const isAdebisGroup = (group) => /^\d+$/.test(group.id);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Gruppen verwalten</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Gruppe hinzufügen
        </Button>
      </Box>
      {groupDefs.length === 0 ? (
        <Alert severity="info">
          Keine Gruppen definiert. Fügen Sie Gruppen hinzu oder importieren Sie Adebis-Daten.
        </Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Icon</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>ID</TableCell>
                <TableCell>Quelle</TableCell>
                <TableCell align="right">Aktionen</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {groupDefs.map((group) => (
                <TableRow key={group.id}>
                  <TableCell sx={{ fontSize: '1.5em' }}>{group.icon}</TableCell>
                  <TableCell>{group.name}</TableCell>
                  <TableCell>{group.id}</TableCell>
                  <TableCell>
                    {isAdebisGroup(group) ? 'Adebis Import' : 'Manuell erstellt'}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleOpenDialog(group)}
                      title="Bearbeiten"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteGroup(group)}
                      title="Löschen"
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingGroup ? 'Gruppe bearbeiten' : 'Neue Gruppe hinzufügen'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2em',
                  backgroundColor: 'background.paper'
                }}
              >
                {groupForm.icon || '👥'}
              </Box>
              <TextField
                label="Gruppenname"
                value={groupForm.name}
                onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                fullWidth
                error={!!error}
                helperText={error}
                autoFocus
              />
            </Box>
            <Typography variant="body2" sx={{ mb: 1 }}>Icon auswählen:</Typography>
            <IconPicker
              value={groupForm.icon}
              onChange={(icon) => setGroupForm({ ...groupForm, icon })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Abbrechen</Button>
          <Button onClick={handleSaveGroup} variant="contained">
            {editingGroup ? 'Speichern' : 'Hinzufügen'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default OrgaTabGroupDefs;
