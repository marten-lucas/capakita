import { useDispatch, useSelector } from 'react-redux';
import { 
  addFinancialThunk, 
  updateFinancialThunk, 
  deleteFinancialThunk,
  updateFinancialPaymentsThunk 
} from '../store/simFinancialsSlice';

export function useFinancialsActions() {
  const dispatch = useDispatch();
  const selectedScenarioId = useSelector(state => state.simScenario.selectedScenarioId);

  const addFinancial = (dataItemId, financial) => {
    dispatch(addFinancialThunk({
      scenarioId: selectedScenarioId,
      dataItemId,
      financial
    }));
  };

  const updateFinancial = (dataItemId, financialId, updates) => {
    dispatch(updateFinancialThunk({
      scenarioId: selectedScenarioId,
      dataItemId,
      financialId,
      updates
    }));
  };

  const deleteFinancial = (dataItemId, financialId) => {
    dispatch(deleteFinancialThunk({
      scenarioId: selectedScenarioId,
      dataItemId,
      financialId
    }));
  };

  const updateFinancialPayments = (dataItemId, financialId, payments) => {
    // Validate required parameters
    if (!selectedScenarioId || !dataItemId || !financialId) {
      console.error('updateFinancialPayments: Missing required parameters', {
        selectedScenarioId,
        dataItemId,
        financialId
      });
      return;
    }

    dispatch(updateFinancialPaymentsThunk({
      scenarioId: selectedScenarioId,
      dataItemId,
      financialId,
      payments: payments || []
    }));
  };

  return { 
    addFinancial, 
    updateFinancial, 
    deleteFinancial,
    updateFinancialPayments 
  };
}
