import {
  Typography, Box, Accordion, AccordionSummary, AccordionDetails, Button,
  FormControl, FormLabel, RadioGroup, FormControlLabel, Radio, TextField
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RestoreIcon from '@mui/icons-material/Restore';
import React, { useState, useEffect } from 'react';
import { convertYYYYMMDDtoDDMMYYYY, convertDDMMYYYYtoYYYYMMDD } from '../../utils/dateUtils';

// Removed local definitions of convertYYYYMMDDtoDDMMYYYY, convertDDMMYYYYtoYYYYMMDD

function GroupAccordion({ group, index, allGroups, defaultExpanded, onDelete, canDelete, onRestore, originalGroup }) {
  const [groupState, setGroupState] = useState(group);
  const [expanded, setExpanded] = useState(!!defaultExpanded);

  const handleDateChange = (field, value) => {
    setGroupState(prev => ({
      ...prev,
      [field]: convertYYYYMMDDtoDDMMYYYY(value)
    }));
  };

  useEffect(() => {
    setGroupState(group);
  }, [group]);

  // Prüft, ob ein Feld (start, end) geändert wurde
  function isGroupDateModified(field) {
    if (!originalGroup) return false;
    const orig = originalGroup[field];
    const local = groupState[field];
    if (!orig && !local) return false;
    if (!orig || !local) return true;
    // orig: DD.MM.YYYY, local: DD.MM.YYYY
    return orig !== local;
  }

  // Prüft, ob die Gruppen-ID geändert wurde
  function isGroupIdModified() {
    if (!originalGroup) return false;
    // id kann Zahl oder String sein
    return String(groupState.id ?? '') !== String(originalGroup.id ?? '');
  }

  // Prüft, ob irgendwas geändert ist (für Restore-Icon im Akkordeon)
  function isAnyModified() {
    return isGroupDateModified('start') || isGroupDateModified('end') || isGroupIdModified();
  }

  // Restore für Feld
  const handleRestoreGroupDate = (field) => {
    if (!originalGroup) return;
    setGroupState(prev => ({
      ...prev,
      [field]: originalGroup[field] || ''
    }));
  };

  // Restore für Gruppen-ID
  const handleRestoreGroupId = () => {
    if (!originalGroup) return;
    setGroupState(prev => ({
      ...prev,
      id: originalGroup.id,
      name: allGroups[originalGroup.id] || `Gruppe ${originalGroup.id}`,
    }));
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
    <Accordion expanded={expanded} onChange={() => setExpanded(e => !e)}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <Typography sx={{ flex: 1 }}>
            {groupState.name || 'Gruppenzuordnung'}{dateRangeText ? `: ${dateRangeText}` : ''}
          </Typography>
          {expanded && isAnyModified() && (
            <RestoreIcon
              color="warning"
              sx={{ ml: 1, cursor: 'pointer' }}
              titleAccess="Komplette Gruppenzuordnung auf importierte Werte zurücksetzen"
              onClick={e => {
                e.stopPropagation();
                handleRestoreAll();
              }}
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
              {isGroupIdModified() && (
                <RestoreIcon
                  color="warning"
                  sx={{ cursor: 'pointer' }}
                  titleAccess="Gruppenzuordnung auf importierten Wert zurücksetzen"
                  onClick={() => {
                    if (window.confirm('Gruppenzuordnung auf importierten Wert zurücksetzen?')) {
                      handleRestoreGroupId();
                    }
                  }}
                />
              )}
            </Box>
            <RadioGroup
              row
              aria-label="gruppe"
              name={`gruppe-radio-buttons-group-${index}`}
              value={id ? String(id) : ''}
              onChange={event => {
                const newGroupId = parseInt(event.target.value, 10);
                const newGroupName = allGroups[newGroupId] || `Gruppe ${newGroupId}`;
                setGroupState(prev => ({
                  ...prev,
                  id: newGroupId,
                  name: newGroupName,
                }));
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
              value={convertDDMMYYYYtoYYYYMMDD(start)}
              onChange={(e) => handleDateChange('start', e.target.value)}
              sx={{ width: 150 }}
              inputProps={{ readOnly: false }}
            />
            {isGroupDateModified('start') && (
              <RestoreIcon
                color="warning"
                sx={{ cursor: 'pointer' }}
                titleAccess="Startdatum auf importierten Wert zurücksetzen"
                onClick={() => {
                  if (window.confirm('Startdatum auf importierten Wert zurücksetzen?')) {
                    handleRestoreGroupDate('start');
                  }
                }}
              />
            )}
            <Typography>bis</Typography>
            <TextField
              label="Enddatum"
              type="date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={convertDDMMYYYYtoYYYYMMDD(end)}
              onChange={(e) => handleDateChange('end', e.target.value)}
              sx={{ width: 150 }}
              inputProps={{ readOnly: false }}
            />
            {isGroupDateModified('end') && (
              <RestoreIcon
                color="warning"
                sx={{ cursor: 'pointer' }}
                titleAccess="Enddatum auf importierten Wert zurücksetzen"
                onClick={() => {
                  if (window.confirm('Enddatum auf importierten Wert zurücksetzen?')) {
                    handleRestoreGroupDate('end');
                  }
                }}
              />
            )}
          </Box>
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}

// Helper: compare groups for modification
function groupsModified(localGroups, origGroups) {
  if (!Array.isArray(localGroups) && !Array.isArray(origGroups)) return false;
  if (!Array.isArray(localGroups) || !Array.isArray(origGroups)) return true;
  if (localGroups.length !== origGroups.length) return true;
  for (let i = 0; i < localGroups.length; ++i) {
    const l = localGroups[i], o = origGroups[i];
    if (String(l.id) !== String(o.id)) return true;
    if (l.start !== o.start) return true;
    if (l.end !== o.end) return true;
  }
  return false;
}

function GroupCards({ groups, allGroups, lastAddedIndex, onDelete, importedCount, originalGroups, onRestoreGroup }) {
  if (!groups || groups.length === 0) {
    return <Typography variant="body2" color="text.secondary">Keine Gruppenzuordnungen vorhanden.</Typography>;
  }
  return (
    <Box>
      {groups.map((group, idx) => {
        const orig = Array.isArray(originalGroups) ? originalGroups[idx] : undefined;
        const isMod = orig ? groupsModified([group], [orig]) : false;
        return (
          <GroupAccordion
            key={idx}
            group={group}
            index={idx}
            allGroups={allGroups}
            defaultExpanded={lastAddedIndex === idx}
            onDelete={onDelete}
            canDelete={typeof importedCount === 'number' ? idx >= importedCount : true}
            isModified={isMod}
            onRestore={onRestoreGroup}
            originalGroup={orig}
          />
        );
      })}
    </Box>
  );
}

export default GroupCards;