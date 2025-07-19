import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert
} from '@mui/material';
import GroupIcon from '@mui/icons-material/Group';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import PersonIcon from '@mui/icons-material/Person';
import useAppSettingsStore from '../store/appSettingsStore';
import IconPicker from '../components/IconPicker';

function GroupsTab() {
  const { groups, addGroup, updateGroup, deleteGroup } = useAppSettingsStore();
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
      updateGroup(editingGroup.id, groupForm);
    } else {
      addGroup(groupForm);
    }
    
    handleCloseDialog();
  };

  const handleDeleteGroup = (group) => {
    if (window.confirm(`Möchten Sie die Gruppe "${group.name}" wirklich löschen?`)) {
      deleteGroup(group.id);
    }
  };

  const isAdebisGroup = (group) => {
    // Check if group ID is numeric (Adebis groups have numeric IDs)
    return /^\d+$/.test(group.id);
  };

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

      {groups.length === 0 ? (
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
              {groups.map((group) => (
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

      {/* Group Dialog */}
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

function QualificationsTab() {
  const {
    qualifications,
    addQualification,
    updateQualification,
    deleteQualification
  } = useAppSettingsStore();

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
      updateQualification(editingQualification.key, form);
    } else {
      addQualification(form);
    }
    handleCloseDialog();
  };

  const handleDelete = (qualification) => {
    if (window.confirm(`Möchten Sie die Qualifikation "${qualification.name}" wirklich löschen?`)) {
      deleteQualification(qualification.key);
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
      
      {qualifications.length === 0 ? (
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
              {qualifications.map((q) => (
                <TableRow key={q.key}>
                  <TableCell sx={{ fontWeight: 'bold', fontSize: '1.2em' }}>{q.key}</TableCell>
                  <TableCell>{q.name}</TableCell>
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
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Dialog */}
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
            />
            <TextField
              label="Anzeigename"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              fullWidth
              error={!!error && !form.name}
              helperText={error && !form.name ? error : ''}
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

function OrgaPage() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#f0f2f5' }}>
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" sx={{ mb: 3 }}>Einstellungen</Typography>
        
        <Paper sx={{ p: 0 }}>
          <Tabs
            value={activeTab}
            onChange={(_, newTab) => setActiveTab(newTab)}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab icon={<GroupIcon />} label="Gruppen" />
            <Tab icon={<PersonIcon />} label="Qualifikationen" />
          </Tabs>
          
          <Box sx={{ p: 3 }}>
            {activeTab === 0 && <GroupsTab />}
            {activeTab === 1 && <QualificationsTab />}
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}

export default OrgaPage;
