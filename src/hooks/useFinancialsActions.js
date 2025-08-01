import { useDispatch, useSelector } from 'react-redux';
import { addFinancialThunk, updateFinancialThunk, deleteFinancialThunk } from '../store/simFinancialsSlice';

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

  return { addFinancial, updateFinancial, deleteFinancial };
}
