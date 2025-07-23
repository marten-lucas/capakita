import React from 'react';
import { Typography, Box, Button, Switch, Slider } from '@mui/material';
import { timeToValue, valueToTime } from '../../../utils/timeUtils';

function DayControl({ dayLabel, dayAbbr, dayData, onToggle, onTimeChange, onAddSegment, onRemoveSegment, type }) {
  const isActive = !!dayData;
  const segments = React.useMemo(
    () => (isActive ? dayData.segments : []),
    [isActive, dayData?.segments]
  );

  // Local state for slider values per segment
  const [sliderValues, setSliderValues] = React.useState(
    segments.map(seg => [
      timeToValue(seg.booking_start),
      timeToValue(seg.booking_end)
    ])
  );

  // Sync local slider state if segments change (e.g. add/remove)
  React.useEffect(() => {
    setSliderValues(
      segments.map(seg => [
        timeToValue(seg.booking_start),
        timeToValue(seg.booking_end)
      ])
    );
  }, [segments, segments.length]);

  return (
    <Box display="flex" alignItems="flex-start" gap={2} sx={{ mb: 1 }}>
      <Typography sx={{ width: 80, mt: 1 }}>{dayLabel}</Typography>
      <Switch checked={isActive} onChange={(e) => onToggle(dayAbbr, e.target.checked)} />
      <Box sx={{ flex: 1, px: 2 }}>
        {isActive && (
          <Box>
            {segments.map((seg, idx) => (
              <Box key={idx} display="flex" alignItems="center" gap={1} sx={{ mb: 1 }}>
                <Box sx={{ flex: 1, minWidth: 220, maxWidth: 400 }}>
                  <Slider
                    value={sliderValues[idx] || [
                      timeToValue(seg.booking_start),
                      timeToValue(seg.booking_end)
                    ]}
                    onChange={(_, newValue) => {
                      setSliderValues(vals => {
                        const next = [...vals];
                        next[idx] = newValue;
                        return next;
                      });
                    }}
                    onChangeCommitted={(_, newValue) => {
                      onTimeChange(dayAbbr, idx, newValue);
                    }}
                    min={0}
                    max={47}
                    step={1}
                    valueLabelFormat={valueToTime}
                    valueLabelDisplay="auto"
                    marks={[
                      { value: 14, label: '07:00' },
                      { value: 24, label: '12:00' },
                      { value: 33, label: '16:30' },
                    ]}
                  />
                </Box>
                {segments.length > 1 && (
                  <Button
                    size="small"
                    color="error"
                    variant="outlined"
                    sx={{ minWidth: 32, px: 1, ml: 0.5 }}
                    onClick={() => onRemoveSegment(dayAbbr, idx)}
                    title="Segment entfernen"
                  >−</Button>
                )}
                {type === 'capacity' && (
                  <Button
                    size="small"
                    variant="outlined"
                    sx={{ minWidth: 32, px: 1, ml: 0.5 }}
                    onClick={() => onAddSegment(dayAbbr)}
                    title="Zeitbereich hinzufügen"
                  >+</Button>
                )}
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default DayControl;
