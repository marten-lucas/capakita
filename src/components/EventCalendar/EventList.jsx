import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import { useScenarioEvents } from '../../hooks/useScenarioEvents';
import { formatEventInfo } from '../../utils/eventUtils.jsx'; // Updated import

function EventList({ scenarioId, selectedDate, onDateChange }) {
  const { consolidatedEvents } = useScenarioEvents(scenarioId);

  // Helper to format date in German locale
  const formatDateGerman = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (!consolidatedEvents || consolidatedEvents.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Keine Events vorhanden.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: 280, minWidth: 200 }}>
      <SimpleTreeView>
        {consolidatedEvents.map(({ date, events }) => (
          <TreeItem
            key={date}
            itemId={date}
            label={formatDateGerman(date)}
            selected={date === selectedDate}
            onClick={() => onDateChange(date)}
          >
            {events.map((ev, idx) => (
              <TreeItem
                key={idx}
                itemId={`${date}-${idx}`}
                label={formatEventInfo(ev)} // Use central function for event info
                onClick={(e) => {
                  e.stopPropagation(); // Prevent parent click
                  onDateChange(date); // Select the parent date
                }}
              />
            ))}
          </TreeItem>
        ))}
      </SimpleTreeView>
    </Box>
  );
}

export default EventList;

