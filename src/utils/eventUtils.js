// This file should be deleted - content moved to eventUtils.jsx
export function formatEventTooltip(events) {
  if (!events || events.length === 0) return '';
  return (
    <div>
      {events.map((ev, idx) => (
        <div key={idx}>
          <strong>{ev.label || ev.type}</strong>
          <span style={{ marginLeft: 8, color: '#888', fontSize: 11 }}>
            [{ev.type}]
          </span>
        </div>
      ))}
    </div>
  );
}

// Format event information for the event list
export function formatEventInfo(event) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography variant="body2">
        {event.label || event.type}
      </Typography>
      <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
        {event.type}
      </Typography>
    </Box>
  );
}
