// Convert time (HH:MM) to slider value (0-47 for half-hour intervals)
export function timeToValue(time) {
  if (!time) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 2 + minutes / 30;
}

// Convert slider value back to time (HH:MM)
export function valueToTime(value) {
  const hours = Math.floor(value / 2);
  const minutes = (value % 2) * 30;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// Compare two segment arrays (order & values)
export function segmentsEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; ++i) {
    if (a[i].booking_start !== b[i].booking_start || a[i].booking_end !== b[i].booking_end) {
      return false;
    }
  }
  return true;
}
