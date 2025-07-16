import React from 'react';
import { Typography, Box, List, ListItem, ListItemText, Chip } from '@mui/material';

function ModificationsTab({ item }) {
  const modifications = item?.modifications || [];
  console.log('ModificationsTab - item:', item);
  console.log('ModificationsTab - modifications:', modifications);

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
        <List>
          {modifications.map((mod, index) => (
            <ListItem key={index} sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Chip 
                  label={getFieldDisplayName(mod.field)} 
                  size="small" 
                  color="primary" 
                />
                {mod.timestamp && (
                  <Typography variant="caption" color="text.secondary">
                    {new Date(mod.timestamp).toLocaleString()}
                  </Typography>
                )}
              </Box>
              <Box sx={{ width: '100%' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  <strong>Vorher:</strong>
                </Typography>
                <Box sx={{ bgcolor: '#ffebee', p: 1, borderRadius: 1, mb: 1 }}>
                  <pre style={{ fontSize: '12px', margin: 0, whiteSpace: 'pre-wrap' }}>
                    {formatValue(mod.previousValue)}
                  </pre>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  <strong>Nachher:</strong>
                </Typography>
                <Box sx={{ bgcolor: '#e8f5e8', p: 1, borderRadius: 1 }}>
                  <pre style={{ fontSize: '12px', margin: 0, whiteSpace: 'pre-wrap' }}>
                    {formatValue(mod.newValue)}
                  </pre>
                </Box>
              </Box>
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}

export default React.memo(ModificationsTab);
