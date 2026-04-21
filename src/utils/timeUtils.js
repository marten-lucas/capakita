export function timeToMinutes(time) {
  if (typeof time !== 'string') return null;

  const trimmed = time.trim();
  const match = trimmed.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = match[2] !== undefined ? Number(match[2]) : 0;

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23) return null;
  if (minutes < 0 || minutes > 59) return null;

  return hours * 60 + minutes;
}

export function minutesToTime(minutes) {
  if (!Number.isFinite(minutes)) return '00:00';

  const normalized = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)));
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;

  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

// Convert time (HH:MM) to slider value (0-47 for half-hour intervals)
export function timeToValue(time) {
  const minutes = timeToMinutes(time);
  if (minutes === null) return 0;
  return minutes / 30;
}

// Convert slider value back to time (HH:MM)
export function valueToTime(value) {
  return minutesToTime(value * 30);
}

export function formatDurationHours(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0 h';

  const hours = minutes / 60;
  const rounded = Math.round(hours * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded.toFixed(0)) : String(rounded.toFixed(1));
  return `${text} h`;
}

export function calculateSegmentMinutes(segment) {
  const start = timeToMinutes(segment?.booking_start);
  const end = timeToMinutes(segment?.booking_end);

  if (start === null || end === null) return null;
  return end - start;
}

export function getSegmentOverlapIssues(segments) {
  const issues = [];
  const normalized = (segments || [])
    .map((segment, index) => ({
      index,
      start: timeToMinutes(segment?.booking_start),
      end: timeToMinutes(segment?.booking_end),
    }))
    .filter((segment) => segment.start !== null && segment.end !== null)
    .sort((a, b) => a.start - b.start);

  normalized.forEach((segment, index) => {
    const next = normalized[index + 1];
    if (next && segment.end > next.start) {
      issues.push({
        index: segment.index,
        type: 'overlap',
        message: 'Segmente überlappen sich.',
      });
    }
  });

  return issues;
}

export function getBookingOverlapIssues(times) {
  if (!Array.isArray(times)) return [];

  return times.flatMap((dayTime) => {
    if (!dayTime?.day_name || !Array.isArray(dayTime.segments)) return [];

    return getSegmentOverlapIssues(dayTime.segments).map((issue) => ({
      ...issue,
      day_name: dayTime.day_name,
    }));
  });
}

export function hasBookingOverlapIssues(times) {
  return getBookingOverlapIssues(times).length > 0;
}

export function normalizeTimeInput(time) {
  const minutes = timeToMinutes(time);
  return minutes === null ? null : minutesToTime(minutes);
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
