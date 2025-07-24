import React, { useState, useEffect } from 'react';
import {
  Typography, Box, TextField, Button,
  FormControl, RadioGroup, FormControlLabel, Radio
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ModMonitor from './ModMonitor';
import { useSelector, useDispatch } from 'react-redux';
import { selectDataItemsByScenario } from '../../store/simDataSlice';

function SimDataGeneralTab() {
  // Get scenarioId and selected item from store
  const dispatch = useDispatch();
  const scenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const selectedItemId = useSelector(state => state.simScenario.selectedItems?.[scenarioId]);

  const dataItemsSelector = React.useMemo(
    () => (state) => selectDataItemsByScenario(state, scenarioId),
    [scenarioId]
  );
  const dataItems = useSelector(dataItemsSelector);

  // Get item from data store using scenarioId and selectedItemId
  const item = dataItems?.find(i => i.id === selectedItemId);

  // Organisation/qualidefs from qualification store (not scenario)
  const qualiDefs = useSelector(state => {
    return state.simQualification.qualificationDefsByScenario[scenarioId] || [];
  });

  // Get qualification assignment for this item (for capacity)
  const qualificationAssignment = useSelector(state => {
    if (item?.type === 'capacity') {
      const assignments = state.simQualification.qualificationAssignmentsByScenario[scenarioId] || [];
      return assignments.find(a => a.dataItemId === item.id) || null;
    }
    return null;
  });

  // Local state for controlled fields
  const [localName, setLocalName] = useState(item?.name ?? '');
  const [localNote, setLocalNote] = useState(item?.remark ?? '');

  // Manual entry check
  const isManualEntry = item?.rawdata?.source === 'manual';

  // Sync local state with item
  useEffect(() => { setLocalName(item?.name ?? ''); }, [item?.name]);
  useEffect(() => { setLocalNote(item?.remark ?? ''); }, [item?.remark]);

  // Handlers
  const handleDeleteItem = () => {
    dispatch({
      type: 'simData/deleteDataItem',
      payload: { scenarioId, itemId: item.id }
    });
    dispatch({
      type: 'simScenario/setSelectedItem',
      payload: null
    });
  };

  // For capacity: derive selected qualification from assignment if present
  const selectedQualification =
    item?.type === 'capacity'
      ? (qualificationAssignment?.qualification ?? '')
      : (item?.qualification ?? '');

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
          onBlur={() => {
            if (localName !== item.name) {
              dispatch({
                type: 'simData/updateDataItemFields',
                payload: { scenarioId, itemId: item.id, fields: { name: localName } }
              });
            }
          }}
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
          onBlur={() => {
            if (localNote !== item.remark) {
              dispatch({
                type: 'simData/updateDataItemFields',
                payload: { scenarioId, itemId: item.id, fields: { remark: localNote } }
              });
            }
          }}
          size="small"
          sx={{ width: 355 }}
          multiline
          minRows={2}
          maxRows={4}
          InputLabelProps={{ shrink: true }}
        />
      </Box>

      {/* Date of Birth */}
      {item.type === 'demand' && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 0.5 }}>Geburtsdatum</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              type="date"
              value={item.dateofbirth ?? ''}
              onChange={(e) => dispatch({
                type: 'simData/updateDataItemFields',
                payload: { scenarioId, itemId: item.id, fields: { dateofbirth: e.target.value } }
              })}
              onBlur={() => {}}
              size="small"
              sx={{ width: 355 }}
              InputLabelProps={{ shrink: true }}
            />
            {/* <ModMonitor
              itemId={item.id}
              field="dateofbirth"
              value={item.dateofbirth ?? ''}
              originalValue={initialDateOfBirth}
              onRestore={() => simDataStore.updateDataItemFields(scenarioId, item.id, { dateofbirth: initialDateOfBirth })}
              title="Geburtsdatum auf importierten Wert zurücksetzen"
              confirmMsg="Geburtsdatum auf importierten Wert zurücksetzen?"
            /> */}
          </Box>
        </Box>
      )}

      {/* Qualifikation */}
      {item.type === 'capacity' && (
        <Box sx={{ mb: 2 }}>
          <FormControl component="fieldset">
            <Typography variant="body2" sx={{ mb: 0.5 }}>Qualifikation</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {/* <ModMonitor
                itemId={item.id}
                field="qualification"
                value={item.qualification ?? ''}
                originalValue={initialQualification}
                onRestore={() => simDataStore.updateDataItemFields(scenarioId, item.id, { qualification: initialQualification })}
                title="Qualifikation auf importierten Wert zurücksetzen"
                confirmMsg="Qualifikation auf importierten Wert zurücksetzen?"
              /> */}
            </Box>
            <RadioGroup
              row
              value={selectedQualification}
              onChange={(e) => {
                // Update assignment in qualification store
                if (qualificationAssignment) {
                  dispatch({
                    type: 'simQualification/updateQualificationAssignment',
                    payload: {
                      scenarioId,
                      assignmentId: qualificationAssignment.id,
                      updates: { qualification: e.target.value }
                    }
                  });
                } else {
                  dispatch({
                    type: 'simQualification/addQualificationAssignment',
                    payload: {
                      scenarioId,
                      assignment: {
                        qualification: e.target.value,
                        rawdata: { QUALIFIK: e.target.value },
                        originalData: { qualification: e.target.value, rawdata: { QUALIFIK: e.target.value } },
                        dataItemId: item.id
                      }
                    }
                  });
                }
              }}
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
            value={item.startdate ?? ''}
            onChange={(e) => dispatch({
              type: 'simData/updateDataItemFields',
              payload: { scenarioId, itemId: item.id, fields: { startdate: e.target.value } }
            })}
            sx={{ width: 150 }}
          />
          {/* <ModMonitor
            itemId={item.id}
            field="startdate"
            value={item.startdate ?? ''}
            originalValue={initialStartDate}
            onRestore={() => simDataStore.updateDataItemFields(scenarioId, item.id, { startdate: initialStartDate })}
            title="Startdatum auf importierten Wert zurücksetzen"
            confirmMsg="Startdatum auf importierten Wert zurücksetzen?"
          /> */}
          <Typography variant="body2" sx={{ minWidth: 24, textAlign: 'center' }}>bis</Typography>
          <TextField
            label="bis"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={item.enddate ?? ''}
            onChange={(e) => dispatch({
              type: 'simData/updateDataItemFields',
              payload: { scenarioId, itemId: item.id, fields: { enddate: e.target.value } }
            })}
            sx={{ width: 150 }}
          />
          {/* <ModMonitor
            itemId={item.id}
            field="enddate"
            value={item.enddate ?? ''}
            originalValue={initialEndDate}
            onRestore={() => simDataStore.updateDataItemFields(scenarioId, item.id, { enddate: initialEndDate })}
            title="Enddatum auf importierten Wert zurücksetzen"
            confirmMsg="Enddatum auf importierten Wert zurücksetzen?"
          /> */}
        </Box>
      </Box>

      {/* Abwesenheiten */}
      <Box sx={{ mt: 4, mb: 2 }}>
        <Button
          variant="outlined"
          size="small"
          onClick={() => {
            const absences = Array.isArray(item?.absences) ? item.absences : [];
            const newAbsence = { start: '', end: '' };
            const newList = [...absences, newAbsence];
            dispatch({
              type: 'simData/updateDataItemFields',
              payload: { scenarioId, itemId: item.id, fields: { absences: newList } }
            });
          }}
          sx={{ mb: 1 }}
        >
          Abwesenheit hinzufügen
        </Button>
        {item?.absences && item.absences.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {item.absences.map((absence, idx) => {
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
                    onChange={(e) => {
                      const newAbsence = { ...absence, start: e.target.value };
                      const newList = item.absences.map((a, i) => (i === idx ? newAbsence : a));
                      dispatch({
                        type: 'simData/updateDataItemFields',
                        payload: { scenarioId, itemId: item.id, fields: { absences: newList } }
                      });
                    }}
                    sx={{ width: 130 }}
                    inputProps={{ min: new Date().toISOString().split('T')[0] }}
                  />
                  <Typography variant="body2" sx={{ minWidth: 24, textAlign: 'center' }}>bis</Typography>
                  <TextField
                    label="bis"
                    type="date"
                    size="small"
                    InputLabelProps={{ shrink: true }}
                    value={absence.end}
                    onChange={(e) => {
                      const newAbsence = { ...absence, end: e.target.value };
                      const newList = item.absences.map((a, i) => (i === idx ? newAbsence : a));
                      dispatch({
                        type: 'simData/updateDataItemFields',
                        payload: { scenarioId, itemId: item.id, fields: { absences: newList } }
                      });
                    }}
                    sx={{ width: 130 }}
                    inputProps={{ min: new Date().toISOString().split('T')[0] }}
                  />
                  <Typography variant="body2" sx={{ minWidth: 80 }}>
                    {workdays > 0 ? `${workdays} Arbeitstage` : ''}
                  </Typography>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    onClick={() => {
                      const newList = item.absences.filter((_, i) => i !== idx);
                      dispatch({
                        type: 'simData/updateDataItemFields',
                        payload: { scenarioId, itemId: item.id, fields: { absences: newList } }
                      });
                    }}
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
