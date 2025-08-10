import React, { useState } from 'react';
import {
  Box,
  Paper,
  Tabs,
  Tab,
  Button,
  IconButton,
  Typography
} from '@mui/material';

// Utility wrapper to avoid passing unwanted props to DOM
const RemoveDomProps = ({ style, children }) => (
  <div style={style}>{children}</div>
);

function TabbedListDetail({
  items = [],
  ItemTitle = item => item?.name || '',
  ItemSubTitle = () => '',
  ItemChips = () => null,
  ItemAvatar = () => null,
  ItemHoverIcons = () => [],
  ItemAddButton = { label: 'Hinzufügen', onClick: () => {} },
  Detail = () => null,
  emptyText = 'Keine Einträge vorhanden.',
  getLevel // <-- now truly optional
}) {
  // Use id-based selection for stability
  const [selectedId, setSelectedId] = useState(items[0]?.id || null);
  const [hoveredTabId, setHoveredTabId] = useState(null);

  // Update selectedId if items change and selectedId is no longer present
  React.useEffect(() => {
    if (!items.some(item => item.id === selectedId)) {
      setSelectedId(items[0]?.id || null);
    }
  }, [items, selectedId]);

  const selectedIndex = items.findIndex(item => item.id === selectedId);
  const selectedItem = selectedIndex !== -1 ? items[selectedIndex] : null;

  return (
    <Box sx={{ display: 'flex', gap: 2 }}>
      {/* Tabs List */}
      <Paper sx={{ minWidth: 320, p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Optional title */}
        {ItemAddButton.title && (
          <Typography variant="h6" sx={{ flex: 1, mb: 1 }}>
            {ItemAddButton.title}
          </Typography>
        )}
        {items.length === 0 ? (
          <>
            <Typography color="text.secondary" sx={{ p: 2 }}>{emptyText}</Typography>
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="contained"
                onClick={ItemAddButton.onClick}
                startIcon={ItemAddButton.icon}
                size="small"
              >
                {ItemAddButton.label}
              </Button>
            </Box>
          </>
        ) : (
          <>
            <Tabs
              orientation="vertical"
              variant="fullWidth"
              value={selectedIndex}
              onChange={(_, idx) => {
                setSelectedId(items[idx]?.id);
              }}
              sx={{ minHeight: 48 }}
            >
              {items.map((item, idx) => {
                const level = typeof getLevel === 'function' ? getLevel(item) || 0 : 0;
                return (
                  <RemoveDomProps
                    key={item.id || idx}
                    style={{ position: 'relative', minWidth: 220, maxWidth: 320 }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        pr: 4,
                        minHeight: 48,
                        pl: `${level * 24}px`,
                        '&:hover .hover-icons': { opacity: 1 }
                      }}
                      onMouseEnter={() => setHoveredTabId(item.id || idx)}
                      onMouseLeave={() => setHoveredTabId(null)}
                      onClick={() => setSelectedId(item.id)} // <-- Fix: clicking the tab area selects the item
                    >
                      <Tab
                        label={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                            {ItemAvatar(item)}
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="body2" sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {ItemTitle(item)}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {ItemSubTitle(item)}
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 0.5, mt: 0.2, flexWrap: 'wrap' }}>
                                {ItemChips(item)}
                              </Box>
                            </Box>
                          </Box>
                        }
                        value={idx}
                        sx={{ minHeight: 48, alignItems: 'flex-start', textAlign: 'left', maxWidth: 320 }}
                      />
                      <Box
                        className="hover-icons"
                        sx={{
                          position: 'absolute',
                          right: 8,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          display: 'flex',
                          gap: 0.5,
                          opacity: hoveredTabId === (item.id || idx) ? 1 : 0,
                          transition: 'opacity 0.2s'
                        }}
                      >
                        {ItemHoverIcons(item).map(({ icon, onClick, title }, i) => (
                          <IconButton
                            key={i}
                            size="small"
                            onClick={e => {
                              e.stopPropagation();
                              onClick?.(item);
                            }}
                            title={title}
                            sx={{ p: 0.5 }}
                          >
                            {icon}
                          </IconButton>
                        ))}
                      </Box>
                    </Box>
                  </RemoveDomProps>
                );
              })}
            </Tabs>
            {/* Add button below tabs */}
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="contained"
                onClick={ItemAddButton.onClick}
                startIcon={ItemAddButton.icon}
                size="small"
              >
                {ItemAddButton.label}
              </Button>
            </Box>
          </>
        )}
      </Paper>
      {/* Detail Area */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {selectedItem ? <Detail item={selectedItem} /> : null}
      </Box>
    </Box>
  );
}

export default TabbedListDetail;
