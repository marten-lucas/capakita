import {
  Typography, Box, Accordion, AccordionSummary, AccordionDetails, Button,
  FormControl, FormLabel, RadioGroup, FormControlLabel, Radio, TextField
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import React, { useState, useEffect } from 'react';
import { convertYYYYMMDDtoDDMMYYYY, convertDDMMYYYYtoYYYYMMDD } from '../../utils/dateUtils';
import ModMonitor from './ModMonitor';

function GroupAccordion({ group, index, allGroups, defaultExpanded, onDelete, canDelete, onRestore, originalGroup, onUpdateGroup }) {
  const [groupState, setGroupState] = useState(group);
  const [expanded, setExpanded] = useState(!!defaultExpanded);

  const handleDateChange = (field, value) => {
    const updatedGroup = { ...groupState, [field]: convertYYYYMMDDtoDDMMYYYY(value) };
    setGroupState(updatedGroup); // Update local state
    onUpdateGroup(updatedGroup); // Persist changes to global state
  };


  useEffect(() => {
    setGroupState(group);
  }, [group]);

  // Restore für Feld
  const handleRestoreGroupDate = (field) => {
    if (!originalGroup) return;
    const updatedGroup = { ...groupState, [field]: originalGroup[field] || '' };
    setGroupState(updatedGroup); // Update local state
    onUpdateGroup(updatedGroup); // Persist restored value to global state
  };

  // Restore für Gruppen-ID
  const handleRestoreGroupId = () => {
    if (!originalGroup) return;
    const updatedGroup = {
      ...groupState,
      id: originalGroup.id,
      name: allGroups[originalGroup.id] || `Gruppe ${originalGroup.id}`,
    };
    setGroupState(updatedGroup); // Update local state
    onUpdateGroup(updatedGroup); // Persist restored value to global state
  };

  // Restore für alles
  const handleRestoreAll = () => {
    if (window.confirm('Gruppenzuordnung auf importierte Adebis-Daten zurücksetzen?')) {
      onRestore && onRestore(index);
    }
  };

  const { id, start, end } = groupState;
  let dateRangeText = '';
  if (start && end) {
    dateRangeText = `von ${start} bis ${end}`;
  } else if (start) {
    dateRangeText = `ab ${start}`;
  } else if (end) {
    dateRangeText = `bis ${end}`;
  }

  return (
    <Accordion onChange={() => setExpanded(e => !e)}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <Typography sx={{ flex: 1 }}>
            {groupState.name || 'Gruppenzuordnung'}{dateRangeText ? `: ${dateRangeText}` : ''}
          </Typography>
          {expanded && (
            <ModMonitor
              value={JSON.stringify(groupState)}
              originalValue={originalGroup ? JSON.stringify(originalGroup) : undefined}
              onRestore={handleRestoreAll}
              title="Komplette Gruppenzuordnung auf importierte Werte zurücksetzen"
              confirmMsg="Gruppenzuordnung auf importierte Adebis-Daten zurücksetzen?"
              iconProps={{ sx: { ml: 1 } }}
            />
          )}
        </Box>
        {onDelete && canDelete && (
          <Button
            size="small"
            color="error"
            sx={{ ml: 2 }}
            onClick={e => { e.stopPropagation(); onDelete(index); }}
          >
            Löschen
          </Button>
        )}
      </AccordionSummary>
      <AccordionDetails>
        <Box display="flex" flexDirection="column" gap={3}>
          <FormControl component="fieldset">
            <Box display="flex" alignItems="center">
              <FormLabel component="legend" sx={{ mr: 1 }}>Gruppe</FormLabel>
              <ModMonitor
                itemId={`group-${index}`}
                field="id"
                value={groupState.id}
                originalValue={originalGroup ? originalGroup.id : undefined}
                onRestore={handleRestoreGroupId}
                title="Gruppenzuordnung auf importierten Wert zurücksetzen"
                confirmMsg="Gruppenzuordnung auf importierten Wert zurücksetzen?"
              />
            </Box>
            <RadioGroup
              row
              aria-label="gruppe"
              name={`gruppe-radio-buttons-group-${index}`}
              value={groupState.id ? String(groupState.id) : ''}
              onChange={(event) => {
                const newGroupId = parseInt(event.target.value, 10);
                const newGroupName = allGroups[newGroupId] || `Gruppe ${newGroupId}`;
                const updatedGroup = { ...groupState, id: newGroupId, name: newGroupName };
                setGroupState(updatedGroup); // Update local state
                onUpdateGroup(updatedGroup); // Persist changes to global state
              }}
            >
              {Object.entries(allGroups).map(([groupId, groupName]) => (
                <FormControlLabel key={groupId} value={groupId} control={<Radio />} label={groupName} />
              ))}
            </RadioGroup>
          </FormControl>
          <Box display="flex" gap={2} alignItems="center">
            <TextField
              label="Startdatum"
              type="date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={convertDDMMYYYYtoYYYYMMDD(groupState.start)}
              onChange={(e) => handleDateChange('start', e.target.value)}
              sx={{ width: 150 }}
              inputProps={{ readOnly: false }}
            />
            <ModMonitor
              itemId={`group-${index}`}
              field="start"
              value={groupState.start}
              originalValue={originalGroup ? originalGroup.start : undefined}
              onRestore={() => handleRestoreGroupDate('start')}
              title="Startdatum auf importierten Wert zurücksetzen"
              confirmMsg="Startdatum auf importierten Wert zurücksetzen?"
            />
            <Typography>bis</Typography>
            <TextField
              label="Enddatum"
              type="date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={convertDDMMYYYYtoYYYYMMDD(groupState.end)}
              onChange={(e) => handleDateChange('end', e.target.value)}
              sx={{ width: 150 }}
              inputProps={{ readOnly: false }}
            />
            <ModMonitor
              itemId={`group-${index}`}
              field="end"
              value={groupState.end}
              originalValue={originalGroup ? originalGroup.end : undefined}
              onRestore={() => handleRestoreGroupDate('end')}
              title="Enddatum auf importierten Wert zurücksetzen"
              confirmMsg="Enddatum auf importierten Wert zurücksetzen?"
            />
          </Box>
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}

export default GroupAccordion;
