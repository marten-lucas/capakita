import { isRecordActiveOnDate } from './financeUtils';

export function isArchivedDataItem(item) {
  return Boolean(item?.archived);
}

export function hasAllowedChildStatus(item) {
  if (!item || item.type !== 'demand') return true;

  // Manual/non-Adebis records may not provide STATUS and should remain usable.
  const status = item?.rawdata?.STATUS;
  if (status === undefined || status === null || status === '') return true;

  return String(status) === '+';
}

export function shouldIncludeDataItemInAnalysis(item) {
  if (!item) return false;
  if (isArchivedDataItem(item)) return false;
  return hasAllowedChildStatus(item);
}

export function shouldShowDataItemInEditor(item, referenceDate) {
  if (!item) return false;
  if (!hasAllowedChildStatus(item)) return false;
  if (item.source !== 'adebis export') return true;
  return isRecordActiveOnDate(item, referenceDate);
}