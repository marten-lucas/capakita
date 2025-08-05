import { FINANCIAL_TYPE_REGISTRY } from '../../../config/financialTypeRegistry';

function FinancialsDetail({ financial, onChange, onDelete, item }) {
  // Find registry entry for this financial type
  const typeEntry = FINANCIAL_TYPE_REGISTRY.find(t => t.value === financial.type);
  if (!typeEntry) return null;
  const DetailComponent = typeEntry.component;
  return (
    <DetailComponent
      financial={financial}
      onChange={onChange}
      onDelete={onDelete}
      item={item}
    />
  );
}

export default FinancialsDetail;