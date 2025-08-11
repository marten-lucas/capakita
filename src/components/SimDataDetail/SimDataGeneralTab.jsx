import React, { useState, useEffect, useRef } from 'react';
import {
  Typography, Box, TextField, Button,
  FormControl, RadioGroup, FormControlLabel, Radio
} from '@mui/material';
import RestoreIcon from '@mui/icons-material/Restore';
import QualificationPicker from './QualificationPicker';
import { useSelector, useDispatch } from 'react-redux';
import { useOverlayData } from '../../hooks/useOverlayData';
import { updateDataItemThunk } from '../../store/simDataSlice';
import AccordionListDetail from '../common/AccordionListDetail';

// --- Tailgrids-style DateRangePicker (minimal, local) ---
function TailgridDateRangePicker({ value, onChange }) {
  const [currentDate, setCurrentDate] = useState(() => {
    if (value?.start) return new Date(value.start);
    return new Date();
  });
  const [selectedStartDate, setSelectedStartDate] = useState(value?.start || null);
  const [selectedEndDate, setSelectedEndDate] = useState(value?.end || null);
  const [isOpen, setIsOpen] = useState(false);
  const datepickerRef = useRef(null);

  useEffect(() => {
    setSelectedStartDate(value?.start || null);
    setSelectedEndDate(value?.end || null);
  }, [value?.start, value?.end]);

  const handleDayClick = (dayString) => {
    if (!selectedStartDate || (selectedStartDate && selectedEndDate)) {
      setSelectedStartDate(dayString);
      setSelectedEndDate(null);
      onChange({ start: dayString, end: '' });
    } else {
      if (new Date(dayString) < new Date(selectedStartDate)) {
        setSelectedEndDate(selectedStartDate);
        setSelectedStartDate(dayString);
        onChange({ start: dayString, end: selectedStartDate });
      } else {
        setSelectedEndDate(dayString);
        onChange({ start: selectedStartDate, end: dayString });
      }
    }
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysArray = [];

    for (let i = 0; i < firstDayOfMonth; i++) {
      daysArray.push(<div key={`empty-${i}`}></div>);
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const day = new Date(year, month, i);
      const dayString = day.toISOString().slice(0, 10);
      let className =
        "flex h-[32px] w-[32px] items-center justify-center rounded-full hover:bg-gray-200 mb-1 cursor-pointer";
      if (selectedStartDate && dayString === selectedStartDate) {
        className += " bg-primary text-white rounded-r-none";
      }
      if (selectedEndDate && dayString === selectedEndDate) {
        className += " bg-primary text-white rounded-l-none";
      }
      if (
        selectedStartDate &&
        selectedEndDate &&
        new Date(day) > new Date(selectedStartDate) &&
        new Date(day) < new Date(selectedEndDate)
      ) {
        className += " bg-gray-300 rounded-none";
      }
      daysArray.push(
        <div
          key={i}
          className={className}
          data-date={dayString}
          onClick={() => handleDayClick(dayString)}
        >
          {i}
        </div>
      );
    }
    return daysArray;
  };

  const updateInput = () => {
    if (selectedStartDate && selectedEndDate) {
      return `${selectedStartDate} - ${selectedEndDate}`;
    } else if (selectedStartDate) {
      return selectedStartDate;
    } else {
      return "";
    }
  };

  const toggleDatepicker = () => setIsOpen((v) => !v);

  return (
    <Box sx={{ position: 'relative', mb: 1, width: '100%' }}>
      <TextField
        label=""
        value={updateInput()}
        onClick={toggleDatepicker}
        size="small"
        sx={{ width: '100%' }}
        placeholder="Zeitraum wählen"
        InputProps={{ readOnly: true }}
      />
      {isOpen && (
        <Box
          ref={datepickerRef}
          sx={{
            position: 'absolute',
            zIndex: 10,
            bgcolor: 'background.paper',
            border: '1px solid #eee',
            borderRadius: 2,
            boxShadow: 3,
            p: 2,
            mt: 1,
            minWidth: 260,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Button
              size="small"
              onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
            >{"<"}</Button>
            <Typography variant="body2">
              {currentDate.toLocaleString("default", { month: "long" })} {currentDate.getFullYear()}
            </Typography>
            <Button
              size="small"
              onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
            >{">"}</Button>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: 1 }}>
            {["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"].map((day) => (
              <Typography key={day} variant="caption" sx={{ textAlign: 'center' }}>{day}</Typography>
            ))}
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {renderCalendar()}
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 1 }}>
            <Button size="small" variant="outlined">
              {selectedStartDate || "Start"}
            </Button>
            <Button size="small" variant="outlined">
              {selectedEndDate || "Ende"}
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}

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

  // Handler for adding a new absence
  const handleAddAbsence = () => {
    const absences = Array.isArray(localAbsences) ? localAbsences : [];
    const newAbsence = { start: '', end: '' };
    const newList = [...absences, newAbsence];
    setLocalAbsences(newList);
    handleUpdateDataItem({ absences: newList });
  };

  // Handler for updating an absence (with TailgridDateRangePicker)
  const handleUpdateAbsence = (idx, updates) => {
    let newList;
    if (updates.range) {
      const { start, end } = updates.range;
      newList = localAbsences.map((a, i) =>
        i === idx ? { ...a, start, end } : a
      );
    } else {
      newList = localAbsences.map((a, i) => (i === idx ? { ...a, ...updates } : a));
    }
    setLocalAbsences(newList);
    handleUpdateDataItem({ absences: newList });
  };

  // Handler for deleting an absence
  const handleDeleteAbsence = (idx) => {
    const newList = localAbsences.filter((_, i) => i !== idx);
    setLocalAbsences(newList);
    handleUpdateDataItem({ absences: newList });
  };

  // Absence summary and detail components for AccordionListDetail
  const AbsenceSummary = ({ item }) => {
    let workdays = 0;
    if (item.start && item.end) {
      const start = new Date(item.start);
      const end = new Date(item.end);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const day = d.getDay();
        if (day >= 1 && day <= 5) workdays++;
      }
    }
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant="body2">
          {item.start || 'von'} - {item.end || 'bis'}
        </Typography>
        <Typography variant="body2" sx={{ minWidth: 80 }}>
          {workdays > 0 ? `${workdays} Arbeitstage` : ''}
        </Typography>
        <Typography variant="body2">
          {item.payType === 'limited_paid' && 'Lohnfortzahlung'}
          {item.payType === 'fully_paid' && 'Voll bezahlt'}
          {item.payType === 'unpaid' && 'Unbezahlt'}
        </Typography>
      </Box>
    );
  };

  const AbsenceDetail = ({ item, index }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
      <TailgridDateRangePicker
        value={{ start: item.start, end: item.end }}
        onChange={range => handleUpdateAbsence(index, { range })}
      />
      <FormControl component="fieldset" sx={{ ml: 2 }}>
        <RadioGroup
          row
          value={item.payType || 'fully_paid'}
          onChange={e => handleUpdateAbsence(index, { payType: e.target.value })}
        >
          <FormControlLabel value="limited_paid" control={<Radio size="small" />} label="Lohnfortzahlung" />
          <FormControlLabel value="fully_paid" control={<Radio size="small" />} label="Voll bezahlt" />
          <FormControlLabel value="unpaid" control={<Radio size="small" />} label="Unbezahlt" />
        </RadioGroup>
      </FormControl>
    </Box>
  );

  // For main "Anwesenheit" (presence) range
  const handleMainRangeChange = (range) => {
    setLocalStartDate(range.start || '');
    setLocalEndDate(range.end || '');
    handleUpdateDataItem({ startdate: range.start || '', enddate: range.end || '' });
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
    <Box
      flex={1}
      display="flex"
      flexDirection="column"
      sx={{ overflowY: 'auto', gap: 0, height: '100%', minHeight: 0 }}
    >
      <Box sx={{ display: 'flex', flex: 1, gap: 4, minHeight: 0 }}>
        {/* Left column */}
        <Box sx={{ flex: 1, minWidth: 0, maxWidth: '33%', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Name */}
          <Box>
            <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 700 }}>Name</Typography>
            <TextField
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              onBlur={() => {
                if (localName !== item.name) {
                  handleUpdateDataItem({ name: localName });
                }
              }}
              size="small"
              sx={{ width: '100%' }}
              InputLabelProps={{ shrink: true }}
            />
          </Box>

          {/* Bemerkungen */}
          <Box>
            <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 700 }}>Bemerkungen</Typography>
            <TextField
              value={localNote}
              onChange={(e) => setLocalNote(e.target.value)}
              onBlur={() => {
                if (localNote !== item.remark) {
                  handleUpdateDataItem({ remark: localNote });
                }
              }}
              size="small"
              sx={{ width: '100%' }}
              multiline
              minRows={4}
              maxRows={8}
              InputLabelProps={{ shrink: true }}
            />
          </Box>

          {/* Date of Birth */}
          {item.type === 'demand' && (
            <Box>
              <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 700 }}>Geburtsdatum</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TextField
                  type="date"
                  value={localDateOfBirth}
                  onChange={(e) => {
                    setLocalDateOfBirth(e.target.value);
                    handleUpdateDataItem({ dateofbirth: e.target.value });
                  }}
                  size="small"
                  sx={{ width: '100%' }}
                  InputLabelProps={{ shrink: true }}
                />
              </Box>
            </Box>
          )}

          {/* Zeitraum */}
          <Box>
            <Typography variant="body2" sx={{ mt: 1, mb: 0.5, fontWeight: 700 }}>Anwesenheit</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2,  }}>
              <TailgridDateRangePicker
                value={{ start: localStartDate, end: localEndDate }}
                onChange={handleMainRangeChange}
              />
            </Box>
          </Box>
          
          {/* Qualification Picker for capacity items */}
          {item.type === 'capacity' && qualiDefs.length > 0 && (
            <Box>
              <Typography variant="body2" sx={{ mb: 0.5 }}>Qualifikation</Typography>
              <QualificationPicker
                qualificationDefs={qualiDefs}
                value={assignedQualification}
                onChange={handleQualificationChange}
              />
            </Box>
          )}
        </Box>
        {/* Right column */}
        <Box sx={{ flex: 2, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ mb: 2, pr: 2 }}>
            <Typography variant="body2" sx={{ mb: 1, fontWeight: 700 }}>
              Abwesenheit
            </Typography>
            <AccordionListDetail
              items={localAbsences}
              SummaryComponent={AbsenceSummary}
              DetailComponent={AbsenceDetail}
              AddButtonLabel="Abwesenheit hinzufügen"
              onAdd={handleAddAbsence}
              onDelete={(_, item, idx) => handleDeleteAbsence(idx)}
              emptyText="Keine Abwesenheiten vorhanden."
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default SimDataGeneralTab;
