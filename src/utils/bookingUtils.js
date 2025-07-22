import { segmentsEqual } from "./timeUtils";


// Erstellt eine zusammenfassende Textdarstellung der Buchungszeiten
export function consolidateBookingSummary(times) {
  if (!times || times.length === 0) return 'Keine Zeiten definiert';

  const dayOrder = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
  const relevantTimes = times
    .filter(t => t.segments && t.segments.length > 0)
    .sort((a, b) => dayOrder.indexOf(a.day_name) - dayOrder.indexOf(b.day_name));

  if (relevantTimes.length === 0) return 'Keine Zeiten definiert';

  const grouped = [];
  let currentGroup = null;

  for (const dayTime of relevantTimes) {
    // Vergleiche Segmente als Array, nicht als String!
    if (currentGroup &&
      segmentsEqual(currentGroup.segments, dayTime.segments)) {
      currentGroup.endDay = dayTime.day_name;
    } else {
      if (currentGroup) grouped.push(currentGroup);
      currentGroup = {
        startDay: dayTime.day_name,
        endDay: dayTime.day_name,
        segments: dayTime.segments
      };
    }
  }
  if (currentGroup) grouped.push(currentGroup);

  return grouped.map(g => {
    const dayPart = g.startDay === g.endDay ? g.startDay : `${g.startDay}-${g.endDay}`;
    const timeStr = g.segments.map(s => `${s.booking_start}-${s.booking_end}`).join(', ');
    return `${dayPart} ${timeStr}`;
  }).join(', ');
}

/**
 * Calculate total weekly hours from booking data
 * @param {Array} bookings - Array of booking objects with times/segments
 * @returns {number} - Total hours per week
 */
export function calculateWorktimeFromBookings(bookings) {
  if (!Array.isArray(bookings)) return 0;
  
  let totalMinutesPerWeek = 0;
  
  bookings.forEach(booking => {
    if (Array.isArray(booking.times)) {
      booking.times.forEach(dayTime => {
        if (Array.isArray(dayTime.segments)) {
          dayTime.segments.forEach(segment => {
            if (segment.booking_start && segment.booking_end) {
              const [sh, sm] = segment.booking_start.split(':').map(Number);
              const [eh, em] = segment.booking_end.split(':').map(Number);
              const minutes = (eh * 60 + em) - (sh * 60 + sm);
              if (minutes > 0) totalMinutesPerWeek += minutes;
            }
          });
        }
      });
    }
  });
  
  return totalMinutesPerWeek / 60; // Convert to hours
}
