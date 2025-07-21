import React, { useState, useEffect } from 'react';
import {
  Typography, Box, TextField, Switch, FormControlLabel, Button,
  FormControl, FormLabel, RadioGroup, Radio
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ModMonitor from './ModMonitor';

function SimDataGeneralTab({
  item,
  absenceState,
  startDate,
  endDate,
  initialStartDate,
  initialEndDate,
  geburtsdatum,
  initialGeburtsdatum,
  itemName,
  itemNote,
  itemQualification,
  initialQualification,
  qualiDefs,
  isManualEntry,
  handleDeleteItem,
  handleGeburtsdatumChange,
  handleRestoreGeburtsdatum,
  handleRestoreQualification,
  handleStartDateChange,
  handleEndDateChange,
  handleRestoreStartDate,
  handleRestoreEndDate,
  updateItemName,
  updateItemNote,
  updateItemQualification,
  handleAbsenceChange,
}) {
  // Local state for controlled fields
  const [localName, setLocalName] = useState(itemName);
  const [localNote, setLocalNote] = useState(itemNote);
  const [localGeburtsdatum, setLocalGeburtsdatum] = useState(geburtsdatum);
  const [localQualification, setLocalQualification] = useState(itemQualification);

  useEffect(() => { setLocalName(itemName); }, [itemName]);
  useEffect(() => { setLocalNote(itemNote); }, [itemNote]);
  useEffect(() => { setLocalGeburtsdatum(geburtsdatum); }, [geburtsdatum]);
  useEffect(() => { setLocalQualification(itemQualification); }, [itemQualification]);

  const today = new Date().toISOString().split('T')[0];

  return (
    <Box flex={1} display="flex" flexDirection="column" gap={2} sx={{ overflowY: 'auto' }}>
      {isManualEntry && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleDeleteItem}
            size="small"
          >
            Eintrag löschen
          </Button>
        </Box>
      )}
      <Box display="flex" alignItems="center" gap={2} sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ minWidth: 90 }}>Name</Typography>
        <TextField
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          onBlur={() => updateItemName(item.id, localName)}
          size="small"
          sx={{ width: 300 }}
          InputLabelProps={{ shrink: true }}
        />
        <Typography variant="body2" sx={{ minWidth: 90 }}>Bemerkungen</Typography>
        <TextField
          value={localNote}
          onChange={(e) => setLocalNote(e.target.value)}
          onBlur={() => updateItemNote(item.id, localNote)}
          size="small"
          sx={{ width: 300 }}
          multiline
          minRows={2}
          maxRows={4}
          InputLabelProps={{ shrink: true }}
        />
      </Box>
      {item.type === 'demand' && (
        <Box display="flex" alignItems="center" gap={2} sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ minWidth: 90 }}>Geburtsdatum</Typography>
          <TextField
            type="date"
            value={localGeburtsdatum}
            onChange={(e) => setLocalGeburtsdatum(e.target.value)}
            onBlur={() => handleGeburtsdatumChange(localGeburtsdatum)}
            size="small"
            sx={{ width: 150 }}
            InputLabelProps={{ shrink: true }}
          />
          <ModMonitor
            itemId={item.id}
            field="geburtsdatum"
            value={localGeburtsdatum}
            originalValue={initialGeburtsdatum}
            onRestore={handleRestoreGeburtsdatum}
            title="Geburtsdatum auf importierten Wert zurücksetzen"
            confirmMsg="Geburtsdatum auf importierten Wert zurücksetzen?"
          />
        </Box>
      )}
      {item.type === 'capacity' && (
        <Box sx={{ mb: 2 }}>
          <FormControl component="fieldset">
            <Box display="flex" alignItems="center" gap={1}>
              <FormLabel component="legend">Qualifikation</FormLabel>
              <ModMonitor
                itemId={item.id}
                field="qualification"
                value={localQualification}
                originalValue={initialQualification}
                onRestore={handleRestoreQualification}
                title="Qualifikation auf importierten Wert zurücksetzen"
                confirmMsg="Qualifikation auf importierten Wert zurücksetzen?"
              />
            </Box>
            <RadioGroup
              row
              value={localQualification}
              onChange={(e) => setLocalQualification(e.target.value)}
              onBlur={() => updateItemQualification(item.id, localQualification)}
            >
              {qualiDefs && qualiDefs.length > 0 ? (
                qualiDefs.map(q => (
                  <FormControlLabel
                    key={q.key}
                    value={q.key}
                    control={<Radio />}
                    label={`${q.name} (${q.key})`}
                  />
                ))
              ) : (
                <>
                  <FormControlLabel value="E" control={<Radio />} label="Erzieher (E)" />
                  <FormControlLabel value="K" control={<Radio />} label="Kinderpfleger (K)" />
                  <FormControlLabel value="H" control={<Radio />} label="Hilfskraft (H)" />
                  <FormControlLabel value="P" control={<Radio />} label="Praktikant (P)" />
                  <FormControlLabel value="" control={<Radio />} label="Keine Qualifikation" />
                </>
              )}
            </RadioGroup>
          </FormControl>
        </Box>
      )}
      <Box display="flex" alignItems="center" gap={2} sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ minWidth: 90 }}>Zeitraum von</Typography>
        <TextField
          label=""
          type="date"
          size="small"
          InputLabelProps={{ shrink: true }}
          value={startDate}
          onChange={(e) => handleStartDateChange(e.target.value)}
          sx={{ width: 150 }}
        />
        <ModMonitor
          itemId={item.id}
          field="startdate"
          value={startDate}
          originalValue={initialStartDate}
          onRestore={handleRestoreStartDate}
          title="Startdatum auf importierten Wert zurücksetzen"
          confirmMsg="Startdatum auf importierten Wert zurücksetzen?"
        />
        <Typography variant="body2" sx={{ minWidth: 24, textAlign: 'center' }}>bis</Typography>
        <TextField
          label=""
          type="date"
          size="small"
          InputLabelProps={{ shrink: true }}
          value={endDate}
          onChange={(e) => handleEndDateChange(e.target.value)}
          sx={{ width: 150 }}
        />
        <ModMonitor
          itemId={item.id}
          field="enddate"
          value={endDate}
          originalValue={initialEndDate}
          onRestore={handleRestoreEndDate}
          title="Enddatum auf importierten Wert zurücksetzen"
          confirmMsg="Enddatum auf importierten Wert zurücksetzen?"
        />
      </Box>
      <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <FormControlLabel
          control={
            <Switch
              checked={absenceState.enabled}
              onChange={(e) => handleAbsenceChange(e.target.checked, absenceState.start, absenceState.end)}
            />
          }
          label="Abwesenheit"
          sx={{ ml: 0 }}
        />
        {absenceState.enabled && (
          <Box display="flex" alignItems="center" gap={1} sx={{ mt: 1 }}>
            <TextField
              label="von"
              type="date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={absenceState.start}
              onChange={(e) => handleAbsenceChange(absenceState.enabled, e.target.value, absenceState.end)}
              sx={{ width: 130 }}
              inputProps={{ min: today }}
            />
            <Typography variant="body2" sx={{ minWidth: 24, textAlign: 'center' }}>bis</Typography>
            <TextField
              label="bis"
              type="date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={absenceState.end}
              onChange={(e) => handleAbsenceChange(absenceState.enabled, absenceState.start, e.target.value)}
              sx={{ width: 130 }}
              inputProps={{ min: today }}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default SimDataGeneralTab;
