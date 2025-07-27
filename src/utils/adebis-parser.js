import { convertDDMMYYYYtoYYYYMMDD } from './dateUtils';
import { createId } from './idUtils';

// Helper to assign unique IDs to all segments in all bookings
function assignSegmentIdsToBookings(bookings) {
  bookings.forEach(booking => {
    if (Array.isArray(booking.times)) {
      booking.times.forEach(day => {
        if (Array.isArray(day.segments)) {
          day.segments.forEach(segment => {
            // Harmonized segment id format: {dataItemId}-{bookingId}-{dayAbbr}-{timestamp}
            if (!segment.id) {
              segment.id = `${booking.id}-${day.day_name}-${Date.now()}`;
            }
          });
        }
      });
    }
  });
  return bookings;
}

// Converts Adebis raw kids and employees data to a normalized simDataList
export function adebis2simData(kidsRaw, employeesRaw) {
  let simDataList = [];

  // Kids (demand)
  for (const kind of kidsRaw || []) {
    const newId = createId('simdata');
    simDataList.push({
      id: newId,
      type: 'demand',
      source: "adebis export",
      name: kind.FNAME || `Kind ${kind.KINDNR}`,
      remark: "",
      startdate: convertDDMMYYYYtoYYYYMMDD(kind.AUFNDAT),
      enddate: convertDDMMYYYYtoYYYYMMDD(kind.AUSTRDAT),
      dateofbirth: convertDDMMYYYYtoYYYYMMDD(kind.GEBDATUM),
      groupId: kind.GRUNR ? String(kind.GRUNR) : "",
      rawdata: { ...kind },
      absences: [],
      overlays: {},
      adebisId: { id: String(kind.KINDNR), source: "kind" }
    });
  }

  // Employees (capacity)
  for (const emp of employeesRaw || []) {
    const newId = createId('simdata');
    simDataList.push({
      id: newId,
      type: 'capacity',
      source: "adebis export",
      name: `Mitarbeiter ${emp.IDNR}`,
      remark: "",
      startdate: convertDDMMYYYYtoYYYYMMDD(emp.BEGINNDAT),
      enddate: convertDDMMYYYYtoYYYYMMDD(emp.ENDDAT),
      dateofbirth: "",
      groupId: "",
      rawdata: { ...emp },
      absences: [],
      overlays: {},
      adebisId: { id: String(emp.IDNR), source: "anstell" }
    });
  }

  return { simDataList };
}

/**
 * Converts Adebis raw booking data to a normalized bookings list.
 * Each booking will have id,  startdate, enddate, times, rawdata.
 */
export function adebis2bookings(belegungRaw, employeesRaw) {
  const belegungResult = belegung2Booking(belegungRaw);
  const anstellResult = anstell2Booking(employeesRaw);

  // Combine bookings and references
  return {
    bookings: [...belegungResult.bookings, ...anstellResult.bookings],
    bookingReference: [...belegungResult.bookingReference, ...anstellResult.bookingReference]
  };
}

function belegung2Booking(belegungRaw) {
  const bookings = [];
  const bookingReference = [];
  (belegungRaw || []).forEach((b) => {
    const bookingId = createId('booking');
    bookings.push({
      id: bookingId,
      startdate: convertDDMMYYYYtoYYYYMMDD(b.BELVON),
      enddate: convertDDMMYYYYtoYYYYMMDD(b.BELBIS),
      times: Zeiten2Booking(b.ZEITEN, bookingId),
      rawdata: { ...b },
      overlays: {},
      adebisId: { id: String(b.IDNR), source: "belegung" }
    });
    bookingReference.push({
      bookingKey: bookingId,
      adebisId: { id: String(b.KINDNR), source: "kind" }
    });
  });
  assignSegmentIdsToBookings(bookings);
  return { bookings, bookingReference };
}

function anstell2Booking(employeesRaw) {
  const bookings = [];
  const bookingReference = [];
  (employeesRaw || []).forEach((e) => {
    if (!e.ZEITEN) return;
    const bookingId = createId('booking');
    bookings.push({
      id: bookingId,
      startdate: convertDDMMYYYYtoYYYYMMDD(e.BEGINNDAT),
      enddate: convertDDMMYYYYtoYYYYMMDD(e.ENDDAT),
      times: Zeiten2Booking(e.ZEITEN, bookingId),
      rawdata: { ...e },
      overlays: {},
      adebisId: { id: String(e.IDNR), source: "anstell" }
    });
    bookingReference.push({
      bookingKey: bookingId,
      adebisId: { id: String(e.IDNR), source: "anstell" }
    });
  });
  assignSegmentIdsToBookings(bookings);
  return { bookings, bookingReference };
}

/**
 * Parses an Adebis ZEITEN string into an array of booking day/segment objects.
 * Each day contains segments with booking_start, booking_end, and groupId.
 * Prevents empty days/segments.
 */
export function Zeiten2Booking(zeitenString, bookingId) {
  if (!zeitenString) return [];
  const daysRaw = zeitenString.split('#').filter(s => s.trim() !== '');
  const parsedDays = [];
  const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  daysRaw.forEach((dayStr, dayIndex) => {
    if (dayIndex >= 5) return; // Only Mo-Fr
    const parts = dayStr.split('|').map(p => p.trim());
    const segments = [];
    for (let i = 0; i < parts.length; i += 2) {
      const start = parts[i];
      const end = parts[i + 1];
      // Prevent empty segments
      if (start && end && start !== '' && end !== '') {
        segments.push({
          booking_start: start,
          booking_end: end,
          groupId: '',
          id: `${bookingId}-${dayNames[dayIndex]}-${Date.now()}`
        });
      }
    }
    // Only add day if it has at least one valid segment
    if (segments.length > 0) {
      parsedDays.push({
        day: dayIndex + 1,
        day_name: dayNames[dayIndex],
        segments
      });
    }
  });
  return parsedDays;
}

/**
 * Converts Adebis groupsRaw to groupdefs with icons and rawdata.
 * @param {Array} groupsRaw - Array of group objects with at least GRUNR and BEZ.
 * @returns {Array} groupdefs - Array of { id, name, icon, rawdata }
 */
export function adebis2GroupDefs(groupsRaw) {
  return (groupsRaw || []).map(group => {
    const name = group.BEZ || '';
    const lowerName = name.toLowerCase();
    let icon = '👥';
    if (lowerName.includes('schul')) icon = '🏫';
    else if (lowerName.includes('fuchs')) icon = '🦊';
    else if (lowerName.includes('bär') || lowerName.includes('baer')) icon = '🐻';
    else if (lowerName.includes('hase') || lowerName.includes('kaninchen')) icon = '🐰';
    else if (lowerName.includes('frosch')) icon = '🐸';
    else if (lowerName.includes('schmetterling')) icon = '🦋';
    else if (lowerName.includes('marienkäfer') || lowerName.includes('käfer')) icon = '🐞';
    else if (lowerName.includes('biene')) icon = '🐝';
    else if (lowerName.includes('schule') || lowerName.includes('schulkind')) icon = '🎒';
    else if (lowerName.includes('stern')) icon = '⭐';
    else if (lowerName.includes('sonne')) icon = '☀️';
    else if (lowerName.includes('mond')) icon = '🌙';
    else if (lowerName.includes('regenbogen')) icon = '🌈';
    else if (lowerName.includes('blume')) icon = '🌸';
    else if (lowerName.includes('baum')) icon = '🌳';

    return {
      id: String(group.GRUNR),
      name,
      icon,
      rawdata: { ...group }
    };
  });
}

/**
 * Converts Adebis employeesRaw to qualification definitions, with rawdata.
 * @param {Array} employeesRaw - Array of employee objects with at least QUALIFIK.
 * @returns {Array} qualidefs - Array of { key, name, rawdata }
 */
export function adebis2QualiDefs(employeesRaw) {
  const unique = Array.from(
    new Set((employeesRaw || []).map(e => e.QUALIFIK).filter(Boolean))
  );
  return unique.map(key => {
    let name = key;
    if (key === 'E') name = 'Erzieher';
    else if (key === 'K') name = 'Kinderpfleger';
    return { key, name, rawdata: { key, name } };
  });
}

/**
 * Converts Adebis grukiRaw to group assignments, with rawdata.
 * Returns both assignments and assignmentReference for mapping.
 * @param {Array} grukiRaw - Array of group assignment objects with at least KINDNR, GRUNR, GKVON, GKBIS.
 * @returns {Object} { groupAssignments, groupAssignmentReference }
 */
export function adebis2GroupAssignments(grukiRaw) {
  const groupAssignments = [];
  const groupAssignmentReference = [];
  (grukiRaw || []).forEach(g => {
    const assignmentKey = `${g.KINDNR}-${g.GRUNR}-${g.GKVON}-${g.GKBIS}`;
    groupAssignments.push({
      groupId: String(g.GRUNR),
      start: convertDDMMYYYYtoYYYYMMDD(g.GKVON),
      end: convertDDMMYYYYtoYYYYMMDD(g.GKBIS),
      rawdata: { ...g }
    });
    groupAssignmentReference.push({
      assignmentKey,
      adebisId: { id: String(g.KINDNR), source: "kind" }
    });
  });
  return { groupAssignments, groupAssignmentReference };
}

/**
 * Converts Adebis employeesRaw to qualification assignments, with rawdata and reference.
 * Returns both assignments and assignmentReference for mapping.
 * @param {Array} employeesRaw - Array of employee objects with at least QUALIFIK and IDNR.
 * @returns {Object} { qualiAssignments, qualiAssignmentReference }
 */
export function adebis2QualiAssignments(employeesRaw, employeeIdMap = {}) {
  const qualiAssignments = [];
  const qualiAssignmentReference = [];
  (employeesRaw || [])
    .filter(e => e.QUALIFIK && e.IDNR)
    .forEach(e => {
      const assignmentKey = `${e.IDNR}-${e.QUALIFIK}`;
      const assignment = {
        qualification: e.QUALIFIK,
        dataItemId: employeeIdMap[String(e.IDNR)] || String(e.IDNR),
        rawdata: { QUALIFIK: e.QUALIFIK }
      };
      assignment.originalData = { ...assignment };
      qualiAssignments.push(assignment);
      qualiAssignmentReference.push({
        assignmentKey,
        adebisId: { id: String(e.IDNR), source: "anstell" }
      });
    });
  return { qualiAssignments, qualiAssignmentReference };
}
