import React from 'react';
import {
  Box,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Chip,
  OutlinedInput,
  Typography,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import BarChartIcon from '@mui/icons-material/BarChart';
import TimelineIcon from '@mui/icons-material/Timeline';
import { useSelector, useDispatch } from 'react-redux';
import {
  setReferenceDate,
  setTimedimension,
  setChartToggles,
  setFilterGroups,
  setFilterQualifications,
  ensureScenario,
  updateWeeklyChartData
} from '../../store/chartSlice';
import { createSelector } from '@reduxjs/toolkit';

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
};

// Selectors for groupDefs and qualiDefs from their respective slices
const selectGroupDefs = createSelector(
  [
    state => state.simScenario.selectedScenarioId,
    state => state.simGroup.groupDefsByScenario
  ],
  (scenarioId, groupDefsByScenario) => groupDefsByScenario[scenarioId] || []
);

const selectQualiDefs = createSelector(
  [
    state => state.simScenario.selectedScenarioId,
    state => state.simQualification.qualificationDefsByScenario
  ],
  (scenarioId, qualificationDefsByScenario) => qualificationDefsByScenario[scenarioId] || []
);

function ChartFilterForm({ showStichtag = false, scenarioId }) {
  const dispatch = useDispatch();

  // Ensure scenario chart state exists
  React.useEffect(() => {
    if (scenarioId) dispatch(ensureScenario(scenarioId));
  }, [dispatch, scenarioId]);

  // All filter states from chartSlice (per scenario)
  const chartState = useSelector(state => state.chart[scenarioId] || {});
  const stichtag = chartState.referenceDate || '';
  const timedimension = chartState.timedimension || 'month';
  const chartToggles = chartState.chartToggles || ['weekly', 'midterm'];
  const selectedGroups = chartState.filter?.Groups || [];
  const selectedQualifications = chartState.filter?.Qualifications || [];

  // Group and qualification options from their slices
  const groupDefs = useSelector(selectGroupDefs);
  const qualiDefs = useSelector(selectQualiDefs);

  // Build group options: { id: name }
  const availableGroups = React.useMemo(() => {
    const lookup = {};
    groupDefs.forEach(g => {
      lookup[g.id] = g.name;
    });
    return lookup;
  }, [groupDefs]);

  // Build qualification options: { key: name }
  const availableQualifications = React.useMemo(() => {
    const lookup = {};
    qualiDefs.forEach(q => {
      lookup[q.key] = q.name;
    });
    return lookup;
  }, [qualiDefs]);

  // Ensure all options are selected by default when available options change
  React.useEffect(() => {
    const allGroupIds = Object.keys(availableGroups);
    if (allGroupIds.length > 0 && selectedGroups.length === 0) {
      dispatch(setFilterGroups({ scenarioId, groups: allGroupIds }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableGroups, scenarioId]);

  React.useEffect(() => {
    const allQualiKeys = Object.keys(availableQualifications);
    if (allQualiKeys.length > 0 && selectedQualifications.length === 0) {
      dispatch(setFilterQualifications({ scenarioId, qualifications: allQualiKeys }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableQualifications, scenarioId]);

  // Handlers: update chartSlice state and update chart data
  const handleGroupChange = (event) => {
    const value = typeof event.target.value === 'string'
      ? event.target.value.split(',')
      : event.target.value;
    dispatch(setFilterGroups({ scenarioId, groups: value }));
    dispatch(updateWeeklyChartData(scenarioId));
  };

  const handleQualificationChange = (event) => {
    const value = typeof event.target.value === 'string'
      ? event.target.value.split(',')
      : event.target.value;
    dispatch(setFilterQualifications({ scenarioId, qualifications: value }));
    dispatch(updateWeeklyChartData(scenarioId));
  };

  const handleToggle = (event, newToggles) => {
    dispatch(setChartToggles({ scenarioId, toggles: newToggles }));
  };

  const handleDateChange = (e) => {
    dispatch(setReferenceDate({ scenarioId, date: e.target.value }));
  };

  const handleTimedimensionChange = (e) => {
    dispatch(setTimedimension({ scenarioId, timedimension: e.target.value }));
  };

  // UI
  const showWeekly = chartToggles.includes('weekly');
  const showMidterm = chartToggles.includes('midterm');
  const validTimeDimensions = ['week', 'month', 'quarter', 'year'];
  const safeTimedimension = validTimeDimensions.includes(timedimension)
    ? timedimension
    : 'month';

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          alignItems: 'center',
          justifyContent: 'flex-start'
        }}
      >
        <Typography variant="h6" sx={{ mr: 2, minWidth: 70 }}>
          Filter
        </Typography>
        {/* Chart toggles */}
        <ToggleButtonGroup
          value={chartToggles}
          onChange={handleToggle}
          aria-label="Chart selection"
          size="small"
          sx={{ minWidth: 180 }}
        >
          <ToggleButton value="weekly" aria-label="Weekly Chart">
            <BarChartIcon sx={{ mr: 1 }} /> Woche
          </ToggleButton>
          <ToggleButton value="midterm" aria-label="Midterm Chart">
            <TimelineIcon sx={{ mr: 1 }} /> Zeitverlauf
          </ToggleButton>
        </ToggleButtonGroup>

        {/* Gruppen */}
        <FormControl sx={{ minWidth: 180 }} size="small">
          <InputLabel>Gruppen</InputLabel>
          <Select
            multiple
            value={selectedGroups}
            onChange={handleGroupChange}
            input={<OutlinedInput label="Gruppen" />}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected
                  .filter((value) => Object.prototype.hasOwnProperty.call(availableGroups, value))
                  .map((value) => (
                    <Chip key={value} label={availableGroups[value]} size="small" />
                  ))}
              </Box>
            )}
            MenuProps={MenuProps}
          >
            {Object.entries(availableGroups).map(([id, name]) => (
              <MenuItem key={id} value={id}>
                {name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Qualifikationen */}
        <FormControl sx={{ minWidth: 180 }} size="small">
          <InputLabel>Qualifikationen</InputLabel>
          <Select
            multiple
            value={selectedQualifications}
            onChange={handleQualificationChange}
            input={<OutlinedInput label="Qualifikationen" />}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected
                  .filter((value) => Object.prototype.hasOwnProperty.call(availableQualifications, value))
                  .map((value) => (
                    <Chip key={value} label={availableQualifications[value]} size="small" />
                  ))}
              </Box>
            )}
            MenuProps={MenuProps}
          >
            {Object.entries(availableQualifications).map(([key, name]) => (
              <MenuItem key={key} value={key}>
                {name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Stichtag (nur wenn showWeekly && showStichtag) */}
        {showWeekly && showStichtag && (
          <FormControl sx={{ minWidth: 160 }} size="small">
            <TextField
              label="Stichtag"
              type="date"
              value={stichtag}
              onChange={handleDateChange}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
          </FormControl>
        )}

        {/* Zeitdimension (nur wenn showMidterm) */}
        {showMidterm && (
          <FormControl sx={{ minWidth: 140 }} size="small">
            <InputLabel>Zeitdimension</InputLabel>
            <Select
              value={safeTimedimension}
              onChange={handleTimedimensionChange}
              label="Zeitdimension"
            >
              <MenuItem value="week">Woche</MenuItem>
              <MenuItem value="month">Monat</MenuItem>
              <MenuItem value="quarter">Quartal</MenuItem>
              <MenuItem value="year">Jahr</MenuItem>
            </Select>
          </FormControl>
        )}
      </Box>
    </Paper>
  );
}

export default ChartFilterForm;
