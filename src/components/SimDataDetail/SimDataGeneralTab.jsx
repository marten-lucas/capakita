import React, { useState, useEffect } from 'react';
import {
  Typography, Box, TextField, Button,
  FormControl, RadioGroup, FormControlLabel, Radio
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ModMonitor from './ModMonitor';
import QualificationPicker from './QualificationPicker';
import { useSelector, useDispatch } from 'react-redux';
import { createSelector } from '@reduxjs/toolkit';

// Create memoized selectors
const selectQualificationDefs = createSelector(
  [
    state => state.simQualification.qualificationDefsByScenario,
    (state, scenarioId) => scenarioId
  ],
  (qualificationDefsByScenario, scenarioId) => {
    return qualificationDefsByScenario[scenarioId] || [];
  }
);

const selectQualificationAssignments = createSelector(
  [
    state => state.simQualification.qualificationAssignmentsByScenario,
    (state, scenarioId) => scenarioId,
    (state, scenarioId, itemId) => itemId
  ],
  (qualificationAssignmentsByScenario, scenarioId, itemId) => {
    if (!scenarioId || !itemId) return [];
    const scenarioAssignments = qualificationAssignmentsByScenario[scenarioId];
    if (!scenarioAssignments) return [];
    const itemAssignments = scenarioAssignments[itemId];
    return itemAssignments ? Object.values(itemAssignments) : [];
  }
);

function SimDataGeneralTab() {
  // Get scenario and item selection
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const selectedItemId = useSelector(state => state.simScenario.selectedItems?.[selectedScenarioId]);
  // Get the item directly by key
  const item = useSelector(state => state.simData.dataByScenario[selectedScenarioId]?.[selectedItemId]);

  // Use memoized selectors
  const qualiDefs = useSelector(state => selectQualificationDefs(state, selectedScenarioId));
  const qualiAssignments = useSelector(state => selectQualificationAssignments(state, selectedScenarioId, selectedItemId));

  const assignedQualification = React.useMemo(() => {
    if (!item || item.type !== 'capacity') return '';
    const assignment = qualiAssignments.find(a => String(a.dataItemId) === String(selectedItemId));
    return assignment ? assignment.qualification : '';
  }, [qualiAssignments, item, selectedItemId]);

  // Local state for controlled fields
  const [localName, setLocalName] = useState(item?.name ?? '');
  const [localNote, setLocalNote] = useState(item?.remark ?? '');
  const [localStartDate, setLocalStartDate] = useState(item?.startdate ?? '');
  const [localEndDate, setLocalEndDate] = useState(item?.enddate ?? '');
  const [localAbsences, setLocalAbsences] = useState(Array.isArray(item?.absences) ? item.absences : []);
  const [localDateOfBirth, setLocalDateOfBirth] = useState(item?.dateofbirth ?? '');

  // Manual entry check
  const isManualEntry = item?.rawdata?.source === 'manual';

  // Sync local state with item
  useEffect(() => { setLocalName(item?.name ?? ''); }, [item?.name, selectedItemId]);
  useEffect(() => { setLocalNote(item?.remark ?? ''); }, [item?.remark, selectedItemId]);
  useEffect(() => { setLocalStartDate(item?.startdate ?? ''); }, [item?.startdate, selectedItemId]);
  useEffect(() => { setLocalEndDate(item?.enddate ?? ''); }, [item?.enddate, selectedItemId]);
  useEffect(() => { setLocalAbsences(Array.isArray(item?.absences) ? item.absences : []); }, [item?.absences, selectedItemId]);
  useEffect(() => { setLocalDateOfBirth(item?.dateofbirth ?? ''); }, [item?.dateofbirth, selectedItemId]);

  // Handlers
  const handleDeleteItem = () => {
    dispatch({
      type: 'simData/deleteDataItem',
      payload: { scenarioId: selectedScenarioId, itemId: selectedItemId } // use store key
    });
    dispatch({
      type: 'simScenario/setSelectedItem',
      payload: null
    });
  };

  // For capacity: derive selected qualification from assignment if present
  // const selectedQualification =
  //   item?.type === 'capacity'
  //     ? (qualificationAssignment?.qualification ?? '')
  //     : (item?.qualification ?? '');

  // Handler for qualification change
  const handleQualificationChange = (newKey) => {
    // Update assignment in store
    dispatch({
      type: 'simQualification/importQualificationAssignments',
      payload: {
        scenarioId: selectedScenarioId,
        assignments: qualiAssignments
          .filter(a => String(a.dataItemId) !== String(selectedItemId))
          .concat([{ dataItemId: selectedItemId, qualification: newKey }])
      }
    });
  };

  // Guard: If item is null, show a placeholder and return
  if (!item) {
    return (
      <Box sx={{ p: 2, color: 'text.secondary' }}>
        Kein Eintrag ausgewählt.
      </Box>
    );
  }

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
                payload: { scenarioId: selectedScenarioId, itemId: selectedItemId, fields: { name: localName } } // use selectedItemId
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
                payload: { scenarioId: selectedScenarioId, itemId: selectedItemId, fields: { remark: localNote } } // use selectedItemId
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
              value={localDateOfBirth}
              onChange={(e) => {
                setLocalDateOfBirth(e.target.value);
                dispatch({
                  type: 'simData/updateDataItemFields',
                  payload: { scenarioId: selectedScenarioId, itemId: selectedItemId, fields: { dateofbirth: e.target.value } } // use selectedItemId
                });
              }}
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

      {/* Zeitraum */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ mt: 1, mb: 1.5 }}>Anwesenheit</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <TextField
            label="von"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={localStartDate}
            onChange={(e) => {
              setLocalStartDate(e.target.value);
              dispatch({
                type: 'simData/updateDataItemFields',
                payload: { scenarioId: selectedScenarioId, itemId: selectedItemId, fields: { startdate: e.target.value } } // use selectedItemId
              });
            }}
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
            value={localEndDate}
            onChange={(e) => {
              setLocalEndDate(e.target.value);
              dispatch({
                type: 'simData/updateDataItemFields',
                payload: { scenarioId: selectedScenarioId, itemId: selectedItemId, fields: { enddate: e.target.value } } // use selectedItemId
              });
            }}
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
      
      {/* Qualification Picker for capacity items */}
      {item.type === 'capacity' && qualiDefs.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 0.5 }}>Qualifikation</Typography>
          <QualificationPicker
            qualificationDefs={qualiDefs}
            value={assignedQualification}
            onChange={handleQualificationChange}
          />
        </Box>
      )}

      {/* Abwesenheiten */}

      <Box sx={{ mt: 4, mb: 2 }}>
        <Button
          variant="outlined"
          size="small"
          onClick={() => {
            const absences = Array.isArray(localAbsences) ? localAbsences : [];
            const newAbsence = { start: '', end: '' };
            const newList = [...absences, newAbsence];
            setLocalAbsences(newList);
            dispatch({
              type: 'simData/updateDataItemFields',
              payload: { scenarioId: selectedScenarioId, itemId: selectedItemId, fields: { absences: newList } } // use selectedItemId
            });
          }}
          sx={{ mb: 1 }}
        >
          Abwesenheit hinzufügen
        </Button>
        {localAbsences && localAbsences.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {localAbsences.map((absence, idx) => {
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
                      const newList = localAbsences.map((a, i) => (i === idx ? newAbsence : a));
                      setLocalAbsences(newList);
                      dispatch({
                        type: 'simData/updateDataItemFields',
                        payload: { scenarioId: selectedScenarioId, itemId: selectedItemId, fields: { absences: newList } } // use selectedItemId
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
                      const newList = localAbsences.map((a, i) => (i === idx ? newAbsence : a));
                      setLocalAbsences(newList);
                      dispatch({
                        type: 'simData/updateDataItemFields',
                        payload: { scenarioId: selectedScenarioId, itemId: selectedItemId, fields: { absences: newList } } // use selectedItemId
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
                      const newList = localAbsences.filter((_, i) => i !== idx);
                      setLocalAbsences(newList);
                      dispatch({
                        type: 'simData/updateDataItemFields',
                        payload: { scenarioId: selectedScenarioId, itemId: selectedItemId, fields: { absences: newList } } // use selectedItemId
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
