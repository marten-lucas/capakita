import React from 'react';
import { Box, TextField, Typography } from '@mui/material';

function BonusInstructorDetail({ financial, onChange }) {
  const typeDetails = financial.type_details || {};

  const updateTypeDetails = (updates) => {
    onChange({
      ...financial,
      type_details: { ...typeDetails, ...updates }
    });
  };

  return (
    <>
      <Box display="flex" gap={2} mt={1}>
        <TextField
          label="Startdatum"
          type="date"
          value={typeDetails.Startdate || ''}
          onChange={e => updateTypeDetails({ Startdate: e.target.value })}
          InputLabelProps={{ shrink: true }}
          size="small"
          sx={{ maxWidth: 180 }}
        />
        <TextField
          label="Enddatum"
          type="date"
          value={typeDetails.Enddate || ''}
          onChange={e => updateTypeDetails({ Enddate: e.target.value })}
          InputLabelProps={{ shrink: true }}
          size="small"
          sx={{ maxWidth: 180 }}
        />
      </Box>
    </>
  );
}

export default BonusInstructorDetail;
