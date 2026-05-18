import { isRecordActiveOnDate } from './financeUtils';

export function shouldShowDataItemInEditor(item, referenceDate) {
  if (!item) return false;
  if (item.source !== 'adebis export') return true;
  return isRecordActiveOnDate(item, referenceDate);
}