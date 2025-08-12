import React from 'react';
import { Box, Accordion, AccordionSummary, AccordionDetails, Typography, Button, IconButton, Menu, MenuItem, Alert } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';

function AccordionListDetail({
  items = [],
  SummaryComponent = () => null,
  DetailComponent = () => null,
  AddButtonLabel = 'Hinzufügen',
  onAdd,
  onDelete,
  getItemKey = (item, idx) => item.id || idx,
  AddButtonProps = {},
  DeleteButtonComponent, // optional custom delete button
  emptyText = 'Keine Einträge vorhanden.',
  AddButtonMenuOptions = [],
  emptyAlertSeverity = 'info', // 'info' or 'warning'
}) {
  // Track expanded accordion index
  const [expandedIdx, setExpandedIdx] = React.useState(items && items.length > 0 ? 0 : null);

  // Expand last item when items length increases
  const prevLengthRef = React.useRef(items ? items.length : 0);
  React.useEffect(() => {
    if (items && items.length > prevLengthRef.current) {
      setExpandedIdx(items.length - 1);
    }
    prevLengthRef.current = items ? items.length : 0;
  }, [items]);

  const handleAccordionChange = (idx) => (event, expanded) => {
    setExpandedIdx(expanded ? idx : null);
  };

  // Satisfy linter for unused vars
  const _satisfyLinter = [SummaryComponent, DetailComponent];

  // Add button menu state
  const [anchorEl, setAnchorEl] = React.useState(null);
  const handleAddButtonClick = (e) => {
    if (AddButtonMenuOptions && AddButtonMenuOptions.length > 0) {
      setAnchorEl(e.currentTarget);
    } else {
      onAdd?.(e);
    }
  };
  const handleMenuClose = () => setAnchorEl(null);

  // Track which accordion is hovered for delete button visibility
  const [hoveredIdx, setHoveredIdx] = React.useState(null);

  return (
    <Box>
      {/* Accordions */}
      {(!items || items.length === 0) ? (
        <Alert severity={emptyAlertSeverity} sx={{ mb: 2 }}>
          {emptyText}
        </Alert>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p:1 }}>
          {items.map((item, idx) => (
            <Accordion
              key={getItemKey(item, idx)}
              expanded={expandedIdx === idx}
              onChange={handleAccordionChange(idx)}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', position: 'relative' }}>
                  <Box sx={{ flex: 1 }}>
                    <SummaryComponent item={item} index={idx} />
                  </Box>
                  {onDelete && (
                    <Box
                      className="hover-icons"
                      sx={{
                        opacity: hoveredIdx === idx ? 1 : 0,
                        transition: 'opacity 0.2s',
                        ml: 1,
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      {DeleteButtonComponent
                        ? <DeleteButtonComponent item={item} index={idx} onDelete={() => onDelete(idx, item)} />
                        : <IconButton
                            size="small"
                            onClick={e => { e.stopPropagation(); onDelete(idx, item); }}
                            title="Löschen"
                          >
                            <DeleteIcon />
                          </IconButton>
                      }
                    </Box>
                  )}
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <DetailComponent item={item} index={idx} />
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}
      {/* Add button below accordions, left-aligned, with optional menu */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-start', ml: 1, mt:2 }}>
        <Button
          variant="outlined"
          size="small"
          onClick={handleAddButtonClick}
          {...AddButtonProps}
        >
          {AddButtonLabel}
        </Button>
        {AddButtonMenuOptions && AddButtonMenuOptions.length > 0 && (
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            {AddButtonMenuOptions.map(opt => (
              <MenuItem
                key={opt.value ?? opt.label}
                onClick={e => {
                  handleMenuClose();
                  opt.onClick?.(opt.value, e);
                }}
              >
                {opt.label}
              </MenuItem>
            ))}
          </Menu>
        )}
      </Box>
    </Box>
  );
}

export default AccordionListDetail;
