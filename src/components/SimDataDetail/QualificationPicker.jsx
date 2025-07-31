// filepath: /home/marten/Development/kiga-simulator/src/components/SimDataDetail/QualificationPicker.jsx
import React from 'react';
import { RadioGroup, FormControlLabel, Radio, Box } from '@mui/material';

function QualificationPicker({ qualificationDefs, value, onChange }) {
  return (
    <Box>
      <RadioGroup
        row
        value={value || ''}
        onChange={e => onChange(e.target.value)}
      >
        {qualificationDefs.map((q, idx) => (
          <FormControlLabel
            key={`${q.key}-${idx}`}
            value={q.key}
            control={<Radio />}
            label={q.name}
          />
        ))}
      </RadioGroup>
    </Box>
  );
}

export default QualificationPicker;
