import React from 'react';
import { Box, Accordion, AccordionSummary, AccordionDetails, Typography, Button, IconButton } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

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
  emptyText = 'Keine Einträge vorhanden.'
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

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button
          variant="outlined"
          size="small"
          onClick={onAdd}
          {...AddButtonProps}
        >
          {AddButtonLabel}
        </Button>
      </Box>
      {(!items || items.length === 0) ? (
        <Typography variant="body2" color="text.secondary">{emptyText}</Typography>
      ) : (
        items.map((item, idx) => (
          <Accordion
            key={getItemKey(item, idx)}
            expanded={expandedIdx === idx}
            onChange={handleAccordionChange(idx)}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <Box sx={{ flex: 1 }}>
                  <SummaryComponent item={item} index={idx} />
                </Box>
                {onDelete && (
                  DeleteButtonComponent
                    ? <DeleteButtonComponent item={item} index={idx} onDelete={() => onDelete(idx, item)} />
                    : <IconButton size="small" onClick={e => { e.stopPropagation(); onDelete(idx, item); }}>
                        {/* Default delete icon */}
                        <span role="img" aria-label="delete">🗑️</span>
                      </IconButton>
                )}
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <DetailComponent item={item} index={idx} />
            </AccordionDetails>
          </Accordion>
        ))
      )}
    </Box>
  );
}

export default AccordionListDetail;
