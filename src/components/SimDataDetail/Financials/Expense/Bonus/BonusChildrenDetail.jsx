import React from 'react';
import { Typography, Box } from '@mui/material';

function BonusChildrenDetail({ financial, parentFinancial }) {
  const noOfChildren =
    (financial.type_details && financial.type_details.noOfChildren) ||
    (parentFinancial?.type_details?.NoOfChildren) ||
    0;

  return (
    <Box>
      <Typography variant="body2" color="text.secondary">
        Anzahl Kinder: {noOfChildren}
      </Typography>
    </Box>
  );
}

export default BonusChildrenDetail;
