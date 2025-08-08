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
import PaidIcon from '@mui/icons-material/Paid';
import HistogramIcon from '@mui/icons-material/BarChart'; // Use BarChart icon for histogram
import { useSelector, useDispatch } from 'react-redux';
import {
  setTimedimension,
  setChartToggles,
  setFilterGroups,
  setFilterQualifications,
  ensureScenario,
  updateWeeklyChartData,
  updateMidTermChartData,
  updateHistogramChartData
} from '../../store/chartSlice';
import { useOverlayData } from '../../hooks/useOverlayData';
import EventPicker from '../EventCalendar/EventPicker';

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

// Use frozen empty arrays for stable reference
const EMPTY_GROUP_DEFS = Object.freeze([]);
const EMPTY_QUALI_DEFS = Object.freeze([]);

function ChartFilterForm({ showStichtag = false, scenarioId, onTimedimensionChange }) {
  const dispatch = useDispatch();

  // Ensure scenario chart state exists
  React.useEffect(() => {
    if (scenarioId) dispatch(ensureScenario(scenarioId));
  }, [dispatch, scenarioId]);

  // Use memoized selector to avoid rerender warnings
  const chartState = useSelector(
    state => state.chart[scenarioId] || {},
    (left, right) => {
      // Custom equality check to prevent unnecessary rerenders
      return (
        left.referenceDate === right.referenceDate &&
        left.timedimension === right.timedimension &&
        JSON.stringify(left.chartToggles) === JSON.stringify(right.chartToggles) &&
        JSON.stringify(left.filter) === JSON.stringify(right.filter)
      );
    }
  );

  const timedimension = chartState.timedimension || 'month';
  const chartToggles = chartState.chartToggles || ['weekly', 'midterm'];
  const selectedGroups = chartState.filter?.Groups || [];
  const selectedQualifications = chartState.filter?.Qualifications || [];

  // Use overlay hook for groupDefs and qualiDefs
  const { getEffectiveGroupDefs, getEffectiveQualificationDefs } = useOverlayData();
  const groupDefs = getEffectiveGroupDefs();
  const qualiDefs = getEffectiveQualificationDefs();

  // Memoize derived values
  const availableGroups = React.useMemo(() => {
    const lookup = {};
    groupDefs.forEach(g => {
      lookup[g.id] = g.name;
    });
    lookup['__NO_GROUP__'] = 'Keine Gruppenzuweisung';
    return lookup;
  }, [groupDefs]);

  const availableQualifications = React.useMemo(() => {
    const lookup = {};
    qualiDefs.forEach(q => {
      lookup[q.key] = q.name;
    });
    lookup['__NO_QUALI__'] = 'Keine Qualifikation';
    return lookup;
  }, [qualiDefs]);

  // Fix: Only auto-select on first mount, not on every update
  const didInitGroups = React.useRef(false);
  const didInitQualis = React.useRef(false);

  React.useEffect(() => {
    if (!didInitGroups.current) {
      const realGroupIds = groupDefs.map(g => g.id);
      const allGroupIds = realGroupIds.length > 0
        ? [...realGroupIds, '__NO_GROUP__']
        : ['__NO_GROUP__'];
      if (
        allGroupIds.length > 0 &&
        (selectedGroups.length === 0 ||
          selectedGroups.length !== allGroupIds.length ||
          !allGroupIds.every(id => selectedGroups.includes(id)))
      ) {
        dispatch(setFilterGroups({ scenarioId, groups: allGroupIds }));
      }
      didInitGroups.current = true;
    }
    // eslint-disable-next-line
  }, [groupDefs, scenarioId, dispatch]);

  React.useEffect(() => {
    if (!didInitQualis.current) {
      const realQualiKeys = qualiDefs.map(q => q.key);
      const allQualiKeys = realQualiKeys.length > 0
        ? [...realQualiKeys, '__NO_QUALI__']
        : ['__NO_QUALI__'];
      if (
        allQualiKeys.length > 0 &&
        (selectedQualifications.length === 0 ||
          selectedQualifications.length !== allQualiKeys.length ||
          !allQualiKeys.every(key => selectedQualifications.includes(key)))
      ) {
        dispatch(setFilterQualifications({ scenarioId, qualifications: allQualiKeys }));
      }
      didInitQualis.current = true;
    }
    // eslint-disable-next-line
  }, [qualiDefs, scenarioId, dispatch]);

  // Handlers: update chartSlice state and update chart data
  const handleGroupChange = (event) => {
    const value = typeof event.target.value === 'string'
      ? event.target.value.split(',')
      : event.target.value;
    dispatch(setFilterGroups({ scenarioId, groups: value }));
    // Use setTimeout to ensure state update is processed first
    setTimeout(() => {
      dispatch(updateWeeklyChartData(scenarioId));
      dispatch(updateHistogramChartData(scenarioId));
    }, 0);
  };

  const handleQualificationChange = (event) => {
    const value = typeof event.target.value === 'string'
      ? event.target.value.split(',')
      : event.target.value;
    dispatch(setFilterQualifications({ scenarioId, qualifications: value }));
    // Use setTimeout to ensure state update is processed first
    setTimeout(() => {
      dispatch(updateWeeklyChartData(scenarioId));
      dispatch(updateHistogramChartData(scenarioId));
    }, 0);
  };

  const handleToggle = (event, newToggles) => {
    dispatch(setChartToggles({ scenarioId, toggles: newToggles }));
  };


  const handleTimedimensionChange = (e) => {
    dispatch(setTimedimension({ scenarioId, timedimension: e.target.value }));
    if (onTimedimensionChange) onTimedimensionChange(e.target.value);
    // Use setTimeout to ensure state update is processed first
    setTimeout(() => {
      dispatch(updateMidTermChartData(scenarioId));
    }, 0);
  };

  // UI
  const showWeekly = chartToggles.includes('weekly');
  const showMidterm = chartToggles.includes('midterm');
  const showFinancial = chartToggles.includes('financial');
  const showHistogram = chartToggles.includes('histogram');
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
          sx={{ minWidth: 240 }}
        >
          <ToggleButton value="weekly" aria-label="Weekly Chart">
            <BarChartIcon sx={{ mr: 1 }} /> Woche
          </ToggleButton>
          <ToggleButton value="midterm" aria-label="Midterm Chart">
            <TimelineIcon sx={{ mr: 1 }} /> Zeitverlauf
          </ToggleButton>
          <ToggleButton value="financial" aria-label="Financial Chart">
            <PaidIcon sx={{ mr: 1 }} /> Finanzen
          </ToggleButton>
          <ToggleButton value="histogram" aria-label="Histogram Chart">
            <HistogramIcon sx={{ mr: 1 }} /> Histogram
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
        {/* Zeitdimension (wenn showMidterm oder showFinancial) */}
        {(showMidterm || showFinancial) && (
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

        {/* Stichtag (nur wenn showWeekly oder showHistogram && showStichtag) - EventPicker bleibt in der Reihe */}
        {(showWeekly || showHistogram) && showStichtag && (
          <EventPicker scenarioId={scenarioId} />
        )}
      </Box>
    </Paper>
  );
}

export default ChartFilterForm;

