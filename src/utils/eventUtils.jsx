import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

// Helper to format dates in German locale
function formatDateGerman(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('de-DE', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Format event tooltip content
export function formatEventTooltip(events) {
  if (!events || events.length === 0) return '';
  return (
    <div>
      {events.map((ev, idx) => (
        <div key={idx} style={{ marginBottom: 4 }}>
          <div>
            <strong>{ev.description || ev.type}</strong>
          </div>
          <div style={{ fontSize: 11, color: '#666' }}>
            {ev.entityName} • {ev.category}
          </div>
          {ev.sourceDate !== ev.effectiveDate && (
            <div style={{ fontSize: 10, color: '#888' }}>
              Urspr.: {formatDateGerman(ev.sourceDate)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Format event information for the event list
export function formatEventInfo(event) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {event.description || event.type}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {event.entityName}
      </Typography>
    </Box>
  );
}
