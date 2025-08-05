import { Accordion, AccordionSummary, AccordionDetails, Typography, Box } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FinancialsDetail from './FinancialsDetail';

// Recursive rendering for stacked financials
function FinancialsCards({ financials, expandedItems, onToggleExpanded, onUpdate, onDelete, item }) {
  const handleAccordionChange = (financial) => () => {
    onToggleExpanded(financial.id);
  };

  // Helper to render stacked financials recursively
  const renderStackedFinancials = (fin, idx) => {
    if (!Array.isArray(fin.financial) || fin.financial.length === 0) return null;
    return (
      <Box sx={{ ml: 2 }}>
        <FinancialsCards
          financials={fin.financial}
          expandedItems={expandedItems}
          onToggleExpanded={onToggleExpanded}
          onUpdate={(subIdx, updated) => {
            const updatedStack = [...fin.financial];
            updatedStack[subIdx] = updated;
            onUpdate(idx, { ...fin, financial: updatedStack });
          }}
          onDelete={(subIdx) => {
            const updatedStack = [...fin.financial];
            updatedStack.splice(subIdx, 1);
            onUpdate(idx, { ...fin, financial: updatedStack });
          }}
          item={item}
        />
      </Box>
    );
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
              item={item}
            />
            {renderStackedFinancials(fin, idx)}
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}

export default FinancialsCards;

