let _idCounter = 1;
export function createId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${_idCounter++}`;
}
