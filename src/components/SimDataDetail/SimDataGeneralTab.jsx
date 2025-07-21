import React, { useState, useEffect } from 'react';
import {
  Typography, Box, TextField, Switch, FormControlLabel, Button,
  FormControl, FormLabel, RadioGroup, Radio
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ModMonitor from './ModMonitor';

function SimDataGeneralTab({
  item,
  absenceStateList, // jetzt Array von Abwesenheiten
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
  handleAddAbsence,
  handleUpdateAbsence,
  handleDeleteAbsence,
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
    <Box flex={1} display="flex" flexDirection="column" sx={{ overflowY: 'auto', gap: 0 }}>
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

      {/* Name */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ mb: 0.5 }}>Name</Typography>
        <TextField
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          onBlur={() => updateItemName(item.id, localName)}
          size="small"
          sx={{ width: 355 }}
          InputLabelProps={{ shrink: true }}
        />
      </Box>

      {/* Bemerkungen */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ mb: 0.5 }}>Bemerkungen</Typography>
        <TextField
          value={localNote}
          onChange={(e) => setLocalNote(e.target.value)}
          onBlur={() => updateItemNote(item.id, localNote)}
          size="small"
          sx={{ width: 355 }}
          multiline
          minRows={2}
          maxRows={4}
          InputLabelProps={{ shrink: true }}
        />
      </Box>

      {/* Geburtsdatum */}
      {item.type === 'demand' && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 0.5 }}>Geburtsdatum</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              type="date"
              value={localGeburtsdatum}
              onChange={(e) => setLocalGeburtsdatum(e.target.value)}
              onBlur={() => handleGeburtsdatumChange(localGeburtsdatum)}
              size="small"
              sx={{ width: 355 }}
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
        </Box>
      )}

      {/* Qualifikation */}
      {item.type === 'capacity' && (
        <Box sx={{ mb: 2 }}>
          <FormControl component="fieldset">
          <Typography variant="body2" sx={{ mb: 0.5 }}>Qualifikation</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
                    label={`${q.name}`}
                  />
                ))
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ ml: 2, mt: 1 }}>
                  Keine Qualifikationsdefinitionen geladen. Bitte Organisation prüfen.
                </Typography>
              )}
            </RadioGroup>
          </FormControl>
        </Box>
      )}

      {/* Zeitraum */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ mt: 1, mb: 1.5}}>Anwesenheit</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <TextField
            label="von"
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
            label="bis"
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
      </Box>

      {/* Abwesenheiten */}
      <Box sx={{ mt: 4, mb: 2 }}>
        <Button
          variant="outlined"
          size="small"
          onClick={handleAddAbsence}
          sx={{ mb: 1 }}
        >
          Abwesenheit hinzufügen
        </Button>
        {absenceStateList && absenceStateList.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {absenceStateList.map((absence, idx) => {
              // Berechne die Anzahl der Arbeitstage (Mo-Fr) für diese Abwesenheit
              let workdays = 0;
              if (absence.start && absence.end) {
                const start = new Date(absence.start);
                const end = new Date(absence.end);
                for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                  const day = d.getDay();
                  if (day >= 1 && day <= 5) workdays++;
                }
              }
              return (
                <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TextField
                    label="von"
                    type="date"
                    size="small"
                    InputLabelProps={{ shrink: true }}
                    value={absence.start}
                    onChange={(e) => handleUpdateAbsence(idx, { ...absence, start: e.target.value })}
                    sx={{ width: 130 }}
                    inputProps={{ min: today }}
                  />
                  <Typography variant="body2" sx={{ minWidth: 24, textAlign: 'center' }}>bis</Typography>
                  <TextField
                    label="bis"
                    type="date"
                    size="small"
                    InputLabelProps={{ shrink: true }}
                    value={absence.end}
                    onChange={(e) => handleUpdateAbsence(idx, { ...absence, end: e.target.value })}
                    sx={{ width: 130 }}
                    inputProps={{ min: today }}
                  />
                  <Typography variant="body2" sx={{ minWidth: 80 }}>
                    {workdays > 0 ? `${workdays} Arbeitstage` : ''}
                  </Typography>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    onClick={() => handleDeleteAbsence(idx)}
                    sx={{ ml: 1 }}
                  >
                    Entfernen
                  </Button>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default SimDataGeneralTab;
