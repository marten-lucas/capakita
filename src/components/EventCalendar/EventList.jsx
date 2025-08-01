import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import { useScenarioEvents } from '../../hooks/useScenarioEvents';

function EventList({ scenarioId }) {
  const { consolidatedEvents } = useScenarioEvents(scenarioId);

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
    <Box sx={{ minHeight: 320, minWidth: 250, bgcolor: 'background.paper', p: 1 }}>
      <SimpleTreeView>
        {consolidatedEvents.map(({ date, events }) => (
          <TreeItem key={date} itemId={date} label={date}>
            {events.map((ev, idx) => (
              <TreeItem
                key={idx}
                itemId={`${date}-${idx}`}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2">
                      {ev.label || ev.type}
                    </Typography>
                    <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                      {ev.type}
                    </Typography>
                  </Box>
                }
              />
            ))}
          </TreeItem>
        ))}
      </SimpleTreeView>
    </Box>
  );
}

export default EventList;
