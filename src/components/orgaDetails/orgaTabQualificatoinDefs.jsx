import React, { useState } from 'react';
import {
  Box, Typography, Button, IconButton, TextField, Checkbox, FormControlLabel, Chip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { useSelector, useDispatch } from 'react-redux';
import {
  addQualificationDef,
  updateQualificationDef,
  deleteQualificationDef
} from '../../store/simQualificationSlice';
import { useOverlayData } from '../../hooks/useOverlayData';
import TabbedListDetail from '../common/TabbedListDetail';

function QualificationDetail({ item: qualification }) {
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);

  const [form, setForm] = useState(() => ({
    key: qualification?.key || '',
    initial: qualification?.initial || '',
    name: qualification?.name || '',
    IsExpert: qualification?.IsExpert !== false
  }));
  const [error, setError] = useState('');

  React.useEffect(() => {
    setForm({
      key: qualification?.key || '',
      initial: qualification?.initial || '',
      name: qualification?.name || '',
      IsExpert: qualification?.IsExpert !== false
    });
    setError('');
  }, [qualification]);

  // Save key onBlur (only if new/empty)

  // Save initial onBlur
  const handleInitialBlur = () => {
    if (!form.initial.trim()) {
      setError('Kurzname ist erforderlich');
      return;
    }
    if (form.initial !== qualification.initial) {
      dispatch(updateQualificationDef({ scenarioId: selectedScenarioId, qualiKey: qualification.key, updates: { initial: form.initial } }));
    }
    setError('');
  };

  // Save name onBlur
  const handleNameBlur = () => {
    if (!form.name.trim()) {
      setError('Anzeigename ist erforderlich');
      return;
    }
    if (form.name !== qualification.name) {
      dispatch(updateQualificationDef({ scenarioId: selectedScenarioId, qualiKey: qualification.key, updates: { name: form.name } }));
    }
    setError('');
  };

  // Save IsExpert on change
  const handleIsExpertChange = (e) => {
    const IsExpert = e.target.checked;
    setForm(f => ({ ...f, IsExpert }));
    if (IsExpert !== qualification.IsExpert) {
      dispatch(updateQualificationDef({ scenarioId: selectedScenarioId, qualiKey: qualification.key, updates: { IsExpert } }));
    }
  };


  return (
    <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 480 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <TextField
          label="Kurzname"
          value={form.initial}
          onChange={e => setForm(f => ({ ...f, initial: e.target.value }))}
          onBlur={handleInitialBlur}
          fullWidth
          sx={{ maxWidth: 120 }}
        />
        <TextField
          label="Anzeigename"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          onBlur={handleNameBlur}
          fullWidth
          error={!!error}
          helperText={error}
          autoFocus
        />
      </Box>
      <Box>
        <FormControlLabel
          control={
            <Checkbox
              checked={!!form.IsExpert}
              onChange={handleIsExpertChange}
            />
          }
          label="Fachkraft-Qualifikation"
        />
      </Box>
    </Box>
  );
}

function OrgaTabQualificationDefs() {
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);

  // Use overlay hook to get base scenario info and effective qualification defs
  const { getEffectiveQualificationDefs } = useOverlayData();
  const qualiDefs = getEffectiveQualificationDefs();

  // Track a temporary key for new qualifications
  const [newKeyCounter, setNewKeyCounter] = useState(1);

  const handleAddQualification = () => {
    // Generate a unique key for each new qualification
    const newKey = `NEU${Date.now()}_${newKeyCounter}`;
    setNewKeyCounter(c => c + 1);
    dispatch(addQualificationDef({
      scenarioId: selectedScenarioId,
      qualiDef: { key: newKey, initial: '', name: '', IsExpert: true }
    }));
  };

  const handleDeleteQualification = (qualification) => {
    if (window.confirm(`Möchten Sie die Qualifikation "${qualification.name}" wirklich löschen?`)) {
      dispatch(deleteQualificationDef({ scenarioId: selectedScenarioId, qualiKey: qualification.key }));
    }
  };

  // TabbedListDetail props
  // Map qualiDefs to add id property for TabbedListDetail selection
  const items = qualiDefs.map(q => ({ ...q, id: q.key }));
  // Show initial as avatar and name as title
  const ItemTitle = item => item.name || 'Qualifikation';
  const ItemSubTitle = () => ''; // No subtitle
  const ItemChips = item => item.IsExpert !== false
    ? <Chip label="Fachkraft" color="primary" size="small" sx={{ ml: 1 }} />
    : null;
  const ItemAvatar = item => (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 32,
      height: 32,
      borderRadius: '50%',
      background: '#e3e3e3',
      fontWeight: 600,
      fontSize: '1.1em',
      marginRight: 8
    }}>
      {item.initial || (item.name ? item.name[0] : '')}
    </span>
  );
  const ItemHoverIcons = item => [
    {
      icon: <DeleteIcon fontSize="small" />,
      title: 'Löschen',
      onClick: () => handleDeleteQualification(item)
    }
  ];
  const ItemAddButton = {
    label: 'Neue Qualifikation',
    icon: <AddIcon />,
    onClick: handleAddQualification,
    title: 'Qualifikationen'
  };

  return (
    <Box sx={{ height: '100%' }}>
      <TabbedListDetail
        items={items}
        ItemTitle={ItemTitle}
        ItemSubTitle={ItemSubTitle}
        ItemChips={ItemChips}
        ItemAvatar={ItemAvatar}
        ItemHoverIcons={ItemHoverIcons}
        ItemAddButton={ItemAddButton}
        Detail={QualificationDetail}
        emptyText="Keine Qualifikationen vorhanden."
      />
    </Box>
  );
}

export default OrgaTabQualificationDefs;
