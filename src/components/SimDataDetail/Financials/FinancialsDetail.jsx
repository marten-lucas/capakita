import React, { useState, useEffect } from 'react';
import { FINANCIAL_TYPE_REGISTRY } from '../../../config/financialTypeRegistry';

function FinancialsDetail({ financial, onChange, onDelete, item }) {
  const [DetailComponent, setDetailComponent] = useState(null);

  useEffect(() => {
    const typeEntry = FINANCIAL_TYPE_REGISTRY.find(t => t.value === financial.type);
    if (typeEntry?.component) {
      typeEntry.component().then(module => {
        setDetailComponent(() => module.default);
      });
    }
  }, [financial.type]);

  if (!DetailComponent) return null;

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