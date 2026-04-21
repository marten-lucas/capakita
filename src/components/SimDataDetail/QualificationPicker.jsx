import React from 'react';
import { Radio, Group, Box } from '@mantine/core';
import { useSelector } from 'react-redux';

const EMPTY_QUALIFICATION_DEFS = [];

function QualificationPicker({ value, onChange }) {
  const scenarioId = useSelector((state) => state.simScenario.selectedScenarioId);
  const qualificationDefs = useSelector((state) => {
    const defs = state.simQualification.qualificationDefsByScenario[scenarioId];
    return Array.isArray(defs) ? defs : EMPTY_QUALIFICATION_DEFS;
  });

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
