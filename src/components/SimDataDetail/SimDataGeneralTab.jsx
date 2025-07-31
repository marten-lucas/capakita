import React, { useState, useEffect } from 'react';
import {
  Typography, Box, TextField, Button,
  FormControl, RadioGroup, FormControlLabel, Radio
} from '@mui/material';
import RestoreIcon from '@mui/icons-material/Restore';
import QualificationPicker from './QualificationPicker';
import { useSelector, useDispatch } from 'react-redux';
import { useOverlayData } from '../../hooks/useOverlayData';
import { updateDataItemThunk } from '../../store/simDataSlice';

function SimDataGeneralTab() {
  // Get scenario and item selection
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const selectedItemId = useSelector(state => state.simScenario.selectedItems?.[selectedScenarioId]);
  
  // Use overlay hook
  const { 
    isBasedScenario, 
    getEffectiveDataItem, 
    getEffectiveQualificationDefs,
    getEffectiveQualificationAssignments
  } = useOverlayData();
  
  // Get effective item data (overlay if exists, otherwise base/direct data)
  const item = getEffectiveDataItem(selectedItemId);

  // Use overlay helpers for qualification definitions and assignments
  const qualiDefs = getEffectiveQualificationDefs();
  const qualiAssignments = getEffectiveQualificationAssignments(selectedItemId);

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

  // Sync local state with item
  useEffect(() => { setLocalName(item?.name ?? ''); }, [item?.name, selectedItemId]);
  useEffect(() => { setLocalNote(item?.remark ?? ''); }, [item?.remark, selectedItemId]);
  useEffect(() => { setLocalStartDate(item?.startdate ?? ''); }, [item?.startdate, selectedItemId]);
  useEffect(() => { setLocalEndDate(item?.enddate ?? ''); }, [item?.enddate, selectedItemId]);
  useEffect(() => { setLocalAbsences(Array.isArray(item?.absences) ? item.absences : []); }, [item?.absences, selectedItemId]);
  useEffect(() => { setLocalDateOfBirth(item?.dateofbirth ?? ''); }, [item?.dateofbirth, selectedItemId]);

  // Handlers

  // Handler for qualification change
  const handleQualificationChange = (newKey) => {
    const existingAssignment = qualiAssignments.find(
      (a) => String(a.dataItemId) === String(selectedItemId)
    );

    if (isBasedScenario) {
      // Use the overlay dispatch pattern for overlay scenarios
      dispatch({
        type: 'simOverlay/setQualificationDefOverlay',
        payload: {
          scenarioId: selectedScenarioId,
          dataItemId: selectedItemId,
          overlayData: { dataItemId: selectedItemId, qualification: newKey, id: `${newKey}-${Date.now()}` },
        },
      });
    } else if (existingAssignment) {
      // For base scenarios, update the qualification assignment
      dispatch({
        type: 'simQualification/updateQualificationAssignment',
        payload: {
          scenarioId: selectedScenarioId,
          dataItemId: selectedItemId,
          assignmentId: existingAssignment.id,
          updates: { qualification: newKey },
        },
      });
    } else {
      // For base scenarios, add the qualification assignment
      dispatch({
        type: 'simQualification/addQualificationAssignment',
        payload: {
          scenarioId: selectedScenarioId,
          dataItemId: selectedItemId,
          assignment: { qualification: newKey, dataItemId: selectedItemId },
        },
      });
    }
  };

  // Handle revert to base for overlay scenarios

  // Replace updateDataItem with overlay-aware thunk
  const handleUpdateDataItem = (updates) => {
    dispatch(updateDataItemThunk({
      scenarioId: selectedScenarioId,
      itemId: selectedItemId,
      updates
    }));
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
      {/* Name */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ mb: 0.5 }}>Name</Typography>
        <TextField
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          onBlur={() => {
            if (localName !== item.name) {
              handleUpdateDataItem({ name: localName });
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
              handleUpdateDataItem({ remark: localNote });
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
                handleUpdateDataItem({ dateofbirth: e.target.value });
              }}
              size="small"
              sx={{ width: 355 }}
              InputLabelProps={{ shrink: true }}
            />
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
              handleUpdateDataItem({ startdate: e.target.value });
            }}
            sx={{ width: 150 }}
          />
          <Typography variant="body2" sx={{ minWidth: 24, textAlign: 'center' }}>bis</Typography>
          <TextField
            label="bis"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={localEndDate}
            onChange={(e) => {
              setLocalEndDate(e.target.value);
              handleUpdateDataItem({ enddate: e.target.value });
            }}
            sx={{ width: 150 }}
          />
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
            handleUpdateDataItem({ absences: newList });
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
                      handleUpdateDataItem({ absences: newList });
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
                      handleUpdateDataItem({ absences: newList });
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
                      handleUpdateDataItem({ absences: newList });
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
