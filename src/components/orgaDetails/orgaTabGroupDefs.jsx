import React, { useState } from 'react';
import {
  Box, Typography, Button, IconButton, TextField, Checkbox, FormControlLabel, Chip, Popover
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useSelector, useDispatch } from 'react-redux';
import { addGroupDef, updateGroupDef, deleteGroupDef } from '../../store/simGroupSlice';
import { useOverlayData } from '../../hooks/useOverlayData';
import TabbedListDetail from '../common/TabbedListDetail';
import EmojiPicker from 'emoji-picker-react';

function IconPicker({ value, onChange }) {
  const [anchorEl, setAnchorEl] = useState(null);

  const handleOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleEmojiClick = (emojiData) => {
    onChange(emojiData.emoji);
    handleClose();
  };

  return (
    <>
      <Button
        variant="outlined"
        onClick={handleOpen}
        startIcon={<span style={{ fontSize: '1.5em' }}>{value || '👥'}</span>}
        sx={{ width: 120, justifyContent: 'flex-start' }}
      >
        Icon wählen
      </Button>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 1 }}>
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            height={300}
            width={260}
            lazyLoadEmojis={true}
            emojiStyle="native"
            previewConfig={{ showPreview: false }}
            reactionsDefaultOpen={false}
            allowExpandReactions={false}
            searchDisabled={false}
            autoFocusSearch={true}
            theme="light"
          />
        </Box>
      </Popover>
    </>
  );
}

function GroupDetail({ item: group }) {
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);

  const [form, setForm] = useState(() => ({
    name: group?.name || '',
    icon: group?.icon || '👥',
    IsSchool: !!group?.IsSchool
  }));
  const [error, setError] = useState('');

  React.useEffect(() => {
    setForm({
      name: group?.name || '',
      icon: group?.icon || '👥',
      IsSchool: !!group?.IsSchool
    });
    setError('');
  }, [group]);

  // Save name onBlur
  const handleTextBlur = () => {
    if (!form.name.trim()) {
      setError('Gruppenname ist erforderlich');
      return;
    }
    if (form.name !== group.name) {
      dispatch(updateGroupDef({ scenarioId: selectedScenarioId, groupId: group.id, updates: { name: form.name } }));
    }
    setError('');
  };

  // Save icon on change
  const handleIconChange = (icon) => {
    setForm(f => ({ ...f, icon }));
    if (icon !== group.icon) {
      dispatch(updateGroupDef({ scenarioId: selectedScenarioId, groupId: group.id, updates: { icon } }));
    }
  };

  // Save IsSchool on change
  const handleIsSchoolChange = (e) => {
    const IsSchool = e.target.checked;
    setForm(f => ({ ...f, IsSchool }));
    if (IsSchool !== group.IsSchool) {
      dispatch(updateGroupDef({ scenarioId: selectedScenarioId, groupId: group.id, updates: { IsSchool } }));
    }
  };

  return (
    <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 480 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>

        <TextField
          label="Gruppenname"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          onBlur={handleTextBlur}
          fullWidth
          error={!!error}
          helperText={error}
          autoFocus
        />
      </Box>
      <IconPicker
        value={form.icon}
        onChange={handleIconChange}
      />
      <FormControlLabel
        control={
          <Checkbox
            checked={!!form.IsSchool}
            onChange={handleIsSchoolChange}
          />
        }
        label="Schulkind-Gruppe"
      />
    </Box>
  );
}

function OrgaTabGroupDefs() {
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);

  // Use overlay hook to get base scenario info and effective group defs
  const { baseScenario, isBasedScenario, getEffectiveGroupDefs } = useOverlayData();
  const groupDefs = getEffectiveGroupDefs();

  // Memoize the current scenario definitions selector to prevent new array creation
  const currentScenarioDefs = useSelector(state => {
    if (!selectedScenarioId) return [];
    return state.simGroup.groupDefsByScenario[selectedScenarioId] || [];
  }, (left, right) => {
    if (left.length !== right.length) return false;
    return left.every((item, index) => item.id === right[index]?.id);
  });

  // Memoize the function to check if group is from base scenario
  const isFromBaseScenario = React.useMemo(() => {
    if (!isBasedScenario || !baseScenario) {
      return () => false;
    }
    return (group) => {
      return !currentScenarioDefs.some(def => def.id === group.id);
    };
  }, [isBasedScenario, baseScenario, currentScenarioDefs]);

  const handleAddGroup = () => {
    dispatch(addGroupDef({
      scenarioId: selectedScenarioId,
      groupDef: { name: '', icon: '👥', IsSchool: false, id: Date.now().toString() }
    }));
  };

  const handleDeleteGroup = (group) => {
    if (window.confirm(`Möchten Sie die Gruppe "${group.name}" wirklich löschen?`)) {
      dispatch(deleteGroupDef({ scenarioId: selectedScenarioId, groupId: group.id }));
    }
  };

  const isAdebisGroup = (group) => /^\d+$/.test(group.id);

  // TabbedListDetail props
  const items = groupDefs;
  const ItemTitle = item => item.name || 'Gruppe';
  const ItemSubTitle = () => ''; // No subtitle
  const ItemChips = item => item.IsSchool
    ? <Chip label="Schulkind-Gruppe" color="primary" size="small" sx={{ ml: 1 }} />
    : null;
  const ItemAvatar = item => (
    <span style={{ fontSize: '1.5em', marginRight: 8 }}>{item.icon}</span>
  );
  const ItemHoverIcons = item => [
    {
      icon: <DeleteIcon fontSize="small" />,
      title: 'Löschen',
      onClick: () => handleDeleteGroup(item)
    }
  ];
  const ItemAddButton = {
    label: 'Neue Gruppe',
    icon: <AddIcon />,
    onClick: handleAddGroup,
    title: 'Gruppen'
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Gruppen verwalten</Typography>
      </Box>
      <TabbedListDetail
        items={items}
        ItemTitle={ItemTitle}
        ItemSubTitle={ItemSubTitle}
        ItemChips={ItemChips}
        ItemAvatar={ItemAvatar}
        ItemHoverIcons={ItemHoverIcons}
        ItemAddButton={ItemAddButton}
        Detail={GroupDetail}
        emptyText="Keine Gruppen vorhanden."
      />
    </Box>
  );
}

export default OrgaTabGroupDefs;
