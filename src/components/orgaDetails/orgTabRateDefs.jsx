import React from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Alert
} from '@mui/material';
import { useSelector } from 'react-redux';

function OrgaTabRateDefs() {
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);
  const scenario = useSelector(state =>
    state.simScenario.scenarios.find(s => s.id === selectedScenarioId)
  );
  const rates = scenario?.organisation?.rates || [];

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>Beiträge</Typography>
      {rates.length === 0 ? (
        <Alert severity="info">
          Keine Beitragsarten importiert.
        </Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Text</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Betrag</TableCell>
                <TableCell>Gültig von</TableCell>
                <TableCell>Gültig bis</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rates.map(rate => (
                <TableRow key={rate.id}>
                  <TableCell>{rate.id}</TableCell>
                  <TableCell>{rate.name}</TableCell>
                  <TableCell>{rate.text}</TableCell>
                  <TableCell>{rate.status}</TableCell>
                  <TableCell>{rate.amount}</TableCell>
                  <TableCell>{rate.validFrom}</TableCell>
                  <TableCell>{rate.validTo}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

export default OrgaTabRateDefs;
