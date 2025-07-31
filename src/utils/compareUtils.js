// Compare two objects or collections for equality (imported vs current)
export function isSameAsImported(current, original) {
  if (!current || !original) {
    console.log('[isSameAsImported] One of current/original is falsy', { current, original });
    return false;
  }

  // Helper: compare only keys present in original, recursively for objects/arrays
  const compareKeys = (cur, orig) => {
    if (Array.isArray(orig)) {
      if (!Array.isArray(cur) || cur.length !== orig.length) return false;
      for (let i = 0; i < orig.length; i++) {
        if (!compareKeys(cur[i], orig[i])) return false;
      }
      return true;
    }
    if (typeof orig === 'object' && orig !== null) {
      for (const key of Object.keys(orig)) {
        if (!compareKeys(cur[key], orig[key])) return false;
      }
      return true;
    }
    return cur === orig;
  };

  const result = compareKeys(current, original);
  console.log('[isSameAsImported] compareKeys result', { current, original, result });
  return result;
}
