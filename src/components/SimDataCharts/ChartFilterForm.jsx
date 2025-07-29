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
  setStichtag,
  setSelectedGroups,
  setSelectedQualifications,
  setMidtermTimeDimension,
  setMidtermSelectedGroups,
  setMidtermSelectedQualifications,
  setChartToggles
} from '../../store/chartSlice';

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

function ChartFilterForm({ showStichtag = false, simulationData }) {
  const dispatch = useDispatch();

  // Weekly filters
  const stichtag = useSelector(state => state.chart.stichtag);
  const selectedGroups = useSelector(state => state.chart.selectedGroups);
  const selectedQualifications = useSelector(state => state.chart.selectedQualifications);

  // Midterm filters
  const midtermTimeDimension = useSelector(state => state.chart.midtermTimeDimension);
  const midtermSelectedGroups = useSelector(state => state.chart.midtermSelectedGroups);
  const midtermSelectedQualifications = useSelector(state => state.chart.midtermSelectedQualifications);

  // Chart toggles
  const chartToggles = useSelector(state => state.chart.chartToggles);

  // Get available groups/qualifications from scenario
  const groupDefs = useSelector(state => {
    const scenarioId = state.simScenario.selectedScenarioId;
    return state.simGroup.groupDefsByScenario[scenarioId] || [];
  });
  const qualiDefs = useSelector(state => {
    const scenarioId = state.simScenario.selectedScenarioId;
    return state.simQualification.qualificationDefsByScenario[scenarioId] || [];
  });
  // Build availableGroups lookup { id: name }
  const availableGroups = React.useMemo(() => {
    const lookup = {};
    groupDefs.forEach(g => {
      lookup[g.id] = g.name;
    });
    // Add "keine Gruppe" with ID "0" if needed
    if (
      simulationData &&
      simulationData.some(item =>
        (item.type === 'demand' || item.type === 'capacity') &&
        (!item.parseddata?.group || item.parseddata.group.length === 0)
      )
    ) {
      lookup['0'] = 'keine Gruppe';
    }
    return lookup;
  }, [groupDefs, simulationData]);
  // Build availableQualifications lookup { key: name }
  const availableQualifications = React.useMemo(() => {
    const lookup = {};
    qualiDefs.forEach(q => {
      lookup[q.key] = q.name;
    });
    return lookup;
  }, [qualiDefs]);

  // Use correct filters based on chartToggles
  const showWeekly = chartToggles.includes('weekly');
  const showMidterm = chartToggles.includes('midterm');

  // Always use chartStore state for filter values (IDs only)
  const currentGroups = showMidterm && !showWeekly ? midtermSelectedGroups : selectedGroups;
  const currentQualifications = showMidterm && !showWeekly ? midtermSelectedQualifications : selectedQualifications;

  const handleGroupChange = (event) => {
    const value = typeof event.target.value === 'string'
      ? event.target.value.split(',')
      : event.target.value;
    if (showMidterm && !showWeekly) {
      dispatch(setMidtermSelectedGroups(value));
    } else {
      dispatch(setSelectedGroups(value));
    }
    // Sync both if both charts are visible
    if (showWeekly && showMidterm) {
      dispatch(setMidtermSelectedGroups(value));
      dispatch(setSelectedGroups(value));
    }
  };

  const handleQualificationChange = (event) => {
    const value = typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value;
    if (showMidterm && !showWeekly) {
      dispatch(setMidtermSelectedQualifications(value));
    } else {
      dispatch(setSelectedQualifications(value));
    }
    // Sync both if both charts are visible
    if (showWeekly && showMidterm) {
      dispatch(setMidtermSelectedQualifications(value));
      dispatch(setSelectedQualifications(value));
    }
  };

  // Chart toggle logic (allow toggling both on/off independently)
  const handleToggle = (event, newToggles) => {
    dispatch(setChartToggles(newToggles));
  };

  // Determine if second row is needed
  const showSecondRow =
    (showWeekly && showStichtag) ||
    showMidterm;

  return (
    <Paper sx={{ p: 3, mb: 2 }}>
      <Typography variant="h6" gutterBottom>
        Filter
      </Typography>
      {/* First row: Toggles, Groups, Qualifications (always visible) */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: showSecondRow ? 2 : 0 }}>
        {/* Chart toggles (always visible) */}
        <Box sx={{ minWidth: 220 }}>
          <ToggleButtonGroup
            value={chartToggles}
            onChange={handleToggle}
            aria-label="Chart selection"
            size="small"
          >
            <ToggleButton value="weekly" aria-label="Weekly Chart">
              <BarChartIcon sx={{ mr: 1 }} /> Woche
            </ToggleButton>
            <ToggleButton value="midterm" aria-label="Midterm Chart">
              <TimelineIcon sx={{ mr: 1 }} /> Zeitverlauf
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
        {/* Groups */}
        <FormControl sx={{ minWidth: 200 }} size="small">
          <InputLabel>Gruppen</InputLabel>
          <Select
            multiple
            value={currentGroups}
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
        {/* Qualifications */}
        <FormControl sx={{ minWidth: 200 }} size="small">
          <InputLabel>Qualifikationen</InputLabel>
          <Select
            multiple
            value={currentQualifications}
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
      </Box>
      {/* Second row: Stichtag, Zeitdimension */}
      {showSecondRow && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          {/* Stichtag - only for Weekly and if selected */}
          {showWeekly && showStichtag && (
            <FormControl sx={{ minWidth: 200 }}>
              <TextField
                label="Stichtag"
                type="date"
                value={stichtag}
                onChange={(e) => dispatch(setStichtag(e.target.value))}
                InputLabelProps={{
                  shrink: true,
                }}
                size="small"
              />
            </FormControl>
          )}
          {/* Zeitdimension - only for Midterm */}
          {showMidterm && (
            <FormControl sx={{ minWidth: 150 }} size="small">
              <InputLabel>Zeitdimension</InputLabel>
              <Select
                value={midtermTimeDimension}
                onChange={(e) => dispatch(setMidtermTimeDimension(e.target.value))}
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
      )}
    </Paper>
  );
}

export default ChartFilterForm;
        