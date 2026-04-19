import React from 'react';
import { Group, Box, Text, Switch, RangeSlider, ActionIcon, Stack, Select, Badge } from '@mantine/core';
import { IconMinus, IconPlus } from '@tabler/icons-react';
import { timeToValue, valueToTime } from '../../../utils/timeUtils';

function DayControl({ dayLabel, dayData, onToggle, onTimeChange, onAddSegment, onRemoveSegment, isCapacity = false, onCategoryChange }) {
  const isActive = !!dayData;
  const segments = React.useMemo(
    () => (isActive ? dayData.segments : []),
    [isActive, dayData?.segments]
  );

  const [sliderValues, setSliderValues] = React.useState(
    segments.map(seg => [
      timeToValue(seg.booking_start),
      timeToValue(seg.booking_end)
    ])
  );

  React.useEffect(() => {
    setSliderValues(
      segments.map(seg => [
        timeToValue(seg.booking_start),
        timeToValue(seg.booking_end)
      ])
    );
  }, [segments]);

  return (
    <Group wrap="nowrap" align="flex-start" gap="md" py="xs" style={{ borderBottom: '1px solid #f0f0f0' }}>
      <Text w={80} size="sm" fw={500}>{dayLabel}</Text>
      <Switch 
        checked={isActive} 
        onChange={(e) => onToggle(e.currentTarget.checked)} 
        size="sm"
        aria-label={dayLabel}
      />
      
      <Box style={{ flex: 1 }}>
        {isActive && (
          <Stack gap="xl" mt="sm">
            {segments.map((seg, idx) => (
              <Group key={seg.id || idx} wrap="nowrap" gap="xl" align="flex-start">
                <Box style={{ flex: 1 }}>
                  <RangeSlider
                    min={0}
                    max={47}
                    step={1}
                    label={valueToTime}
                    value={sliderValues[idx] || [0, 47]}
                    onChange={(vals) => {
                      const next = [...sliderValues];
                      next[idx] = vals;
                      setSliderValues(next);
                    }}
                    onChangeEnd={(vals) => onTimeChange(idx, vals)}
                    marks={[
                      { value: 14, label: '07:00' },
                      { value: 24, label: '12:00' },
                      { value: 34, label: '17:00' },
                    ]}
                  />

                  {isCapacity && (
                    <Stack gap={4} mt="sm">
                      <Select
                        label="Blocktyp"
                        size="xs"
                        data={[
                          { value: 'pedagogical', label: 'Pädagogisch' },
                          { value: 'administrative', label: 'Administrativ' },
                        ]}
                        value={seg.category || 'pedagogical'}
                        onChange={(value) => value && onCategoryChange?.(idx, value)}
                        allowDeselect={false}
                        w={200}
                      />
                      {seg.category === 'administrative' && (
                        <Badge size="xs" color="grape" variant="light">
                          zählt nicht in Kapazität
                        </Badge>
                      )}
                    </Stack>
                  )}
                </Box>
                
                <Group gap={4}>
                  {segments.length > 1 && (
                    <ActionIcon 
                      variant="light" 
                      color="red" 
                      onClick={() => onRemoveSegment(idx)}
                      size="sm"
                    >
                      <IconMinus size={14} />
                    </ActionIcon>
                  )}
                  <ActionIcon 
                    variant="light" 
                    color="blue" 
                    onClick={onAddSegment}
                    size="sm"
                  >
                    <IconPlus size={14} />
                  </ActionIcon>
                </Group>
              </Group>
            ))}
          </Stack>
        )}
      </Box>
    </Group>
  );
}

export default DayControl;
