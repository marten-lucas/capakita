import React from 'react';
import { Radio, Group, Box } from '@mantine/core';
import { useSelector } from 'react-redux';

function QualificationPicker({ value, onChange }) {
  const scenarioId = useSelector((state) => state.simScenario.selectedScenarioId);
  const qualificationDefs = useSelector(
    (state) => state.simQualification.qualificationDefsByScenario[scenarioId] || []
  );

  return (
    <Box>
      <Radio.Group value={value || ''} onChange={onChange}>
        <Group mt="xs">
          {qualificationDefs.map((q, idx) => (
            <Radio
              key={`${q.key}-${idx}`}
              value={q.key}
              label={q.initial || q.name}
            />
          ))}
        </Group>
      </Radio.Group>
    </Box>
  );
}

export default QualificationPicker;
