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

/**
 * Calculate total hours for a single booking object
 * @param {Object} booking - Booking object with times/segments
 * @returns {number} - Total hours
 */
export function sumBookingHours(booking) {
  if (!booking?.times || booking.times.length === 0) return 0;
  let total = 0;
  booking.times.forEach(day => {
    day.segments.forEach(seg => {
      if (seg.booking_start && seg.booking_end) {
        // Parse times as HH:mm
        const [sh, sm] = seg.booking_start.split(':').map(Number);
        const [eh, em] = seg.booking_end.split(':').map(Number);
        let diff = (eh * 60 + em) - (sh * 60 + sm);
        if (diff > 0) total += diff / 60;
      }
    });
  });
  return total;
}

/**
 * Calculate the sum of booking hours for all bookings overlapping a period.
 * @param {Object|Array} bookings - booking objects (array or object)
 * @param {string} from - Period start (inclusive, ISO string)
 * @param {string} to - Period end (inclusive, ISO string)
 * @returns {number}
 */
export function sumBookingHoursForPeriod(bookings, from, to) {
  let total = 0;
  const overlaps = (start, end, from, to) => {
    const s = start ? new Date(start) : null;
    const e = end ? new Date(end) : null;
    const fromD = from ? new Date(from) : null;
    const toD = to ? new Date(to) : null;
    // Overlap: booking period intersects [from, to]
    return (!toD || !e || e >= fromD) && (!fromD || !s || s <= toD);
  };
  if (Array.isArray(bookings)) {
    bookings.forEach(b => {
      if (b.startdate && overlaps(b.startdate, b.enddate, from, to)) {
        total += sumBookingHours(b);
      }
    });
  } else if (typeof bookings === "object" && bookings !== null) {
    Object.values(bookings).forEach(b => {
      if (b.startdate && overlaps(b.startdate, b.enddate, from, to)) {
        total += sumBookingHours(b);
      }
    });
  }
  return total;
}
