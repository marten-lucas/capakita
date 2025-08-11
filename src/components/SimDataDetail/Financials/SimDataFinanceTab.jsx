import React from 'react';
import { Box, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useOverlayData } from '../../../hooks/useOverlayData';
import { FINANCIAL_TYPE_REGISTRY } from '../../../config/financialTypeRegistry';
import { useFinancialsActions } from '../../../hooks/useFinancialsActions';
import AccordionListDetail from '../../common/AccordionListDetail';
import FinancialsCards from './FinancialsCards';
import FinancialsDetail from './FinancialsDetail';

function SimDataFinanceTab({ item }) {
  const { addFinancial, updateFinancial, deleteFinancial } = useFinancialsActions();
  const { getEffectiveFinancials } = useOverlayData();
  const financialsObj = getEffectiveFinancials(item?.id);
  const financials = Object.values(financialsObj || {});

  const allowedTypes = FINANCIAL_TYPE_REGISTRY.filter(opt => opt.allowed.includes(item.type));

  const handleAddFinancial = (type) => {
    const typeEntry = FINANCIAL_TYPE_REGISTRY.find(t => t.value === type);
    const newId = `${Date.now()}-${Math.random()}`;
    // Use typeDetailsDefinition from registry if available
    const defaultTypeDetails = typeEntry?.typeDetailsDefinition ? { ...typeEntry.typeDetailsDefinition } : {};
    const newObj = {
      id: newId,
      type: type,
      label: typeEntry?.label || '',
      amount: '',
      from: '',
      to: '',
      note: '',
      type_details: defaultTypeDetails,
    };
    addFinancial(item.id, newObj);
  };

  const handleUpdateFinancial = (idx, updated) => {
    const financialId = financials[idx]?.id;
    if (!financialId) return;
    updateFinancial(item.id, financialId, updated);
  };

  const handleDeleteFinancial = (idx, financial) => {
    if (!financial) return;
    deleteFinancial(item.id, financial.id);
  };

  // Build menu options for add button
  const addButtonMenuOptions = allowedTypes.map(opt => ({
    label: opt.label,
    value: opt.value,
    onClick: () => handleAddFinancial(opt.value)
  }));

  return (
    <Box>
      <AccordionListDetail
        items={financials}
        SummaryComponent={FinancialsCards}
        DetailComponent={({ item, index }) => (
          <FinancialsDetail
            financial={item}
            onChange={updated => handleUpdateFinancial(index, updated)}
            onDelete={() => handleDeleteFinancial(index, item)}
            item={item}
          />
        )}
        AddButtonLabel="Finanzobjekt hinzufügen"
        onAdd={() => {}} // required, but handled by menu
        AddButtonProps={{ startIcon: <AddIcon /> }}
        AddButtonMenuOptions={addButtonMenuOptions}
        onDelete={handleDeleteFinancial}
        emptyText="Keine Finanzobjekte vorhanden."
      />

    </Box>
  );
}

export default SimDataFinanceTab;
   