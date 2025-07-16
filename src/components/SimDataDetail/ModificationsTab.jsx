import React, { useEffect } from 'react';
import { Typography, Box, Chip, Table, TableHead, TableBody, TableRow, TableCell, Checkbox } from '@mui/material';
import useModMonitorStore from '../../store/modMonitorStore';

function ModificationsTab({ item }) {
  const modifications = item?.modifications || [];
  const itemId = item?.id;

  // Selector: hole alle Modifikationen für das aktuelle Item
  const modState = useModMonitorStore(state => state.modifications[itemId] || {});
  const setFieldModification = useModMonitorStore(state => state.setFieldModification);

  // Setze beim ersten Rendern jede Modifikation als aktiv, falls sie noch nicht im Store ist
  useEffect(() => {
    if (!itemId) return;
    modifications.forEach(mod => {
      if (!modState[mod.field]) {
        setFieldModification(itemId, mod.field, true);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, modifications]);

  const formatValue = (value) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return value;
      }
    }
    return String(value);
  };

  const getFieldDisplayName = (field) => {
    const fieldNames = {
      'startdate': 'Startdatum',
      'enddate': 'Enddatum',
      'bookings': 'Buchungen',
      'groups': 'Gruppen',
      'paused': 'Pausiert'
    };
    return fieldNames[field] || field;
  };

  return (
    <Box flex={1} display="flex" flexDirection="column">
      <Typography variant="h6" color="text.primary" sx={{ mb: 2 }}>
        Modifikationen:
      </Typography>
      {modifications.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Keine Modifikationen vorhanden.
        </Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Feld</TableCell>
              <TableCell>Zeitpunkt</TableCell>
              <TableCell>Vorher</TableCell>
              <TableCell>Nachher</TableCell>
              <TableCell>Aktiv für Simulation</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {modifications.map((mod, index) => {
              const checked = !!modState[mod.field];
              return (
                <TableRow key={index}>
                  <TableCell>
                    <Chip 
                      label={getFieldDisplayName(mod.field)} 
                      size="small" 
                      color="primary" 
                    />
                  </TableCell>
                  <TableCell>
                    {mod.timestamp ? (
                      <Typography variant="caption" color="text.secondary">
                        {new Date(mod.timestamp).toLocaleString()}
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ bgcolor: '#ffebee', p: 1, borderRadius: 1 }}>
                      <pre style={{ fontSize: '12px', margin: 0, whiteSpace: 'pre-wrap' }}>
                        {formatValue(mod.previousValue)}
                      </pre>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ bgcolor: '#e8f5e8', p: 1, borderRadius: 1 }}>
                      <pre style={{ fontSize: '12px', margin: 0, whiteSpace: 'pre-wrap' }}>
                        {formatValue(mod.newValue)}
                      </pre>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Checkbox
                      checked={checked}
                      onChange={e => {
                        setFieldModification(itemId, mod.field, e.target.checked);
                      }}
                      color="primary"
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Box>
  );
}

export default React.memo(ModificationsTab);

