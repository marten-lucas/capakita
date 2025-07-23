import React, { useState } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert
} from '@mui/material';
import GroupIcon from '@mui/icons-material/Group';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import useSimScenarioStore from '../../store/simScenarioStore';
import useSimGroupStore from '../../store/simGroupStore';
import IconPicker from '../IconPicker';

function OrgaTabGroupDefs() {
  const selectedScenarioId = useSimScenarioStore(state => state.selectedScenarioId);

  // Use group store for groupdefs CRUD
  const groupDefs = useSimGroupStore(state => state.getGroupDefs(selectedScenarioId));
  const addGroupDef = useSimGroupStore(state => state.addGroupDef);
  const updateGroupDef = useSimGroupStore(state => state.updateGroupDef);
  const deleteGroupDef = useSimGroupStore(state => state.deleteGroupDef);

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
      updateGroupDef(selectedScenarioId, editingGroup.id, groupForm);
    } else {
      addGroupDef(selectedScenarioId, { ...groupForm });
    }
    handleCloseDialog();
  };

  const handleDeleteGroup = (group) => {
    if (window.confirm(`Möchten Sie die Gruppe "${group.name}" wirklich löschen?`)) {
      deleteGroupDef(selectedScenarioId, group.id);
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
            <TextField
              label="Gruppenname"
              value={groupForm.name}
              onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
              fullWidth
              error={!!error}
              helperText={error}
              autoFocus
            />
            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>Icon:</Typography>
              <IconPicker
                value={groupForm.icon}
                onChange={(icon) => setGroupForm({ ...groupForm, icon })}
              />
            </Box>
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
 