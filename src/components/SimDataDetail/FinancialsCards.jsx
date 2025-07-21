import { Accordion, AccordionSummary, AccordionDetails, Typography, Box, Button } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FinancialsDetail from './FinancialsDetail';

function FinancialsCards({ financials, expandedItems, onToggleExpanded, onUpdate, onDelete, item }) {
  const handleAccordionChange = (financial) => () => {
    onToggleExpanded(financial.id);
  };

  return (
    <Box>
      {financials.map((fin, idx) => (
        <Accordion
          key={fin.id || idx}
          expanded={expandedItems.has(fin.id)}
          onChange={handleAccordionChange(fin)}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">
              {fin.label || fin.type} {fin.amount ? `: ${fin.amount} €` : ''}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <FinancialsDetail
              financial={fin}
              onChange={updated => onUpdate(idx, updated)}
              onDelete={() => onDelete(idx)}
              item={item} // <-- pass item here
            />
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}

export default FinancialsCards;

