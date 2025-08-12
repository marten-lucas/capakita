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
  ItemAddButton, // allow undefined/null for no add button
  Detail: DetailComponent = () => null,
  emptyText = 'Keine Einträge vorhanden.',
  getLevel,
  selectedId: controlledSelectedId,
  onSelect
}) {
  // Use id-based selection for stability
  const [uncontrolledSelectedId, setUncontrolledSelectedId] = useState(items[0]?.id || null);
  const selectedId = controlledSelectedId ?? uncontrolledSelectedId;

  const [hoveredTabId, setHoveredTabId] = useState(null);

  // Update selectedId if items change and selectedId is no longer present
  React.useEffect(() => {
    if (!items.some(item => item.id === selectedId)) {
      const nextId = items[0]?.id || null;
      if (controlledSelectedId === undefined) {
        setUncontrolledSelectedId(nextId);
      } else {
        onSelect?.(nextId);
      }
    }
  }, [items, selectedId, controlledSelectedId, onSelect]);

  const selectedIndex = items.findIndex(item => item.id === selectedId);
  const selectedItem = selectedIndex !== -1 ? items[selectedIndex] : null;

  // Fix: Ensure Tabs value is always a valid index
  const tabsValue = items.length === 0 ? false : (selectedIndex === -1 ? 0 : selectedIndex);

  // Use the variable so the linter does not warn
  const _satisfyLinter = DetailComponent;

  const handleSelect = (id) => {
    if (controlledSelectedId === undefined) {
      setUncontrolledSelectedId(id);
    }
    onSelect?.(id);
  };

  return (
    <Box sx={{ display: 'flex', gap: 2, height: '100%' }}>
      {/* Tabs List */}
      <Paper
        elevation={4}
        sx={{
          minWidth: 320,
          maxWidth: 320,
          p: 2,
          m: 1.5, // Add margin for shadow visibility
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100% - 24px)', // Adjust height to account for margin (2 * 12px)
          boxSizing: 'border-box',
          filter: 'none',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
          bgcolor: 'background.paper'
        }}
      >
        {/* Optional title */}
        {ItemAddButton?.title && (
          <Typography variant="h6" sx={{ mb: 1, flex: '0 0 auto' }}>
            {ItemAddButton.title}
          </Typography>
        )}
        {/* Tabs at the top, always */}
        {items.length === 0 ? (
          <>
            <Typography color="text.secondary" sx={{ p: 2 }}>{emptyText}</Typography>
            {ItemAddButton && (
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
            )}
          </>
        ) : (
          <>
            <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              <Tabs
                orientation="vertical"
                variant="fullWidth"
                value={tabsValue}
                onChange={(_, idx) => {
                  const id = items[idx]?.id;
                  if (id) handleSelect(id);
                }}
                sx={{ minHeight: 48, '& .MuiTabs-indicator': { display: 'none' } }}
              >
                {items.map((item, idx) => {
                  const level = typeof getLevel === 'function' ? getLevel(item) || 0 : 0;
                  const isSelected = selectedId === item.id;
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
                          '&:hover .hover-icons': { opacity: 1 },
                          bgcolor: isSelected ? 'action.selected' : undefined,
                          borderRadius: 1,
                          transition: 'background 0.2s',
                          cursor: 'pointer',
                          '&:hover': {
                            bgcolor: isSelected ? 'action.selected' : 'action.hover'
                          },
                          mb: 1 // Add margin-bottom for spacing between tabs
                        }}
                        onMouseEnter={() => setHoveredTabId(item.id || idx)}
                        onMouseLeave={() => setHoveredTabId(null)}
                        onClick={() => handleSelect(item.id)}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1 }}>
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
                        <Tab
                          value={idx}
                          sx={{ 
                            display: 'none' // Hide the actual Tab but keep it for MUI Tabs functionality
                          }}
                        />
                        <Box
                          className="hover-icons"
                          sx={{
                            position: 'absolute',
                            right: 8,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            display: 'flex',
                            flexDirection: 'column', // vertical stack for icons
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
            </Box>
            {/* Add button always at the bottom */}
            {ItemAddButton && (
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', flex: '0 0 auto' }}>
                <Button
                  variant="contained"
                  onClick={ItemAddButton.onClick}
                  startIcon={ItemAddButton.icon}
                  size="small"
                >
                  {ItemAddButton.label}
                </Button>
              </Box>
            )}
          </>
        )}
      </Paper>
      {/* Detail Area */}
      <Paper
        elevation={4}
        sx={{
          flex: 1,
          minWidth: 0,
          height: 'calc(100% - 24px)', // Match height and margin to tabs list
          m: 1.5,
          p: 3,
          overflow: 'auto',
          filter: 'none',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
          bgcolor: 'background.paper',
          boxSizing: 'border-box'
        }}
      >
        {selectedItem ? (
          <DetailComponent item={selectedItem} />
        ) : null}
      </Paper>
    </Box>
  );
}

export default TabbedListDetail;
