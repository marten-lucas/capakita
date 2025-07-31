// Compare two objects or collections for equality (imported vs current)
export function isSameAsImported(current, original) {
  if (!current || !original) return false;

  // If both are arrays or both are objects with numeric keys (collections)
  const isCollection = obj =>
    Array.isArray(obj) ||
    (typeof obj === 'object' && obj !== null && Object.keys(obj).every(k => !isNaN(Number(k))));

  if (isCollection(current) && isCollection(original)) {
    const currentArr = Array.isArray(current) ? current : Object.values(current);
    const originalArr = Array.isArray(original) ? original : Object.values(original);
    if (currentArr.length !== originalArr.length) return false;
    for (let i = 0; i < currentArr.length; i++) {
      if (!isSameAsImported(currentArr[i], originalArr[i])) return false;
    }
    return true;
  }

  // Compare objects: only keys present in original
  const filteredCurrent = {};
  Object.keys(original).forEach(key => {
    if (key in current) filteredCurrent[key] = current[key];
  });
  return JSON.stringify(filteredCurrent) === JSON.stringify(original);
}
