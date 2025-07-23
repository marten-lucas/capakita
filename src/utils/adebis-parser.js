import { convertDDMMYYYYtoYYYYMMDD } from './dateUtils';

// Helper to assign unique IDs to all segments in all bookings
function assignSegmentIdsToBookings(bookings) {
  let counter = 0;
  bookings.forEach(booking => {
    if (Array.isArray(booking.times)) {
      booking.times.forEach(day => {
        if (Array.isArray(day.segments)) {
          day.segments.forEach(segment => {
            if (!segment.id) {
              segment.id = `${booking.id}-${day.day_name}-${counter++}`;
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
    simDataList.push(copyToOriginalData({
      id: String(kind.KINDNR), // Use KINDNR as id!
      type: 'demand',
      source: "adebis export",
      name: kind.FNAME || `Kind ${kind.KINDNR}`,
      remark: "",
      startdate: convertDDMMYYYYtoYYYYMMDD(kind.AUFNDAT),
      enddate: convertDDMMYYYYtoYYYYMMDD(kind.AUSTRDAT),
      dateofbirth: convertDDMMYYYYtoYYYYMMDD(kind.GEBDATUM),
      groupId: kind.GRUNR,
      rawdata: { ...kind }
    }));
  }

  // Employees (capacity)
  let idCounter = 1;
  for (const emp of employeesRaw || []) {
    simDataList.push(copyToOriginalData({
      id: String(100000 + idCounter++), // Ensure unique id for employees, not overlapping with KINDNRs
      type: 'capacity',
      source: "adebis export",
      name: `Mitarbeiter ${emp.IDNR}`,
      remark: "",
      startdate: convertDDMMYYYYtoYYYYMMDD(emp.BEGINNDAT),
      enddate: convertDDMMYYYYtoYYYYMMDD(emp.ENDDAT),
      qualification: emp.QUALIFIK,
      vacation: emp.URLAUB,
      worktime: emp.ARBZEIT,
      rawdata: { ...emp }
    }));
  }

  return simDataList;
}

/**
 * Converts Adebis raw booking data to a normalized bookings list.
 * Each booking will have id, kindId, startdate, enddate, times, rawdata, and originalData.
 */
export function adebis2bookings(belegungRaw) {
  const bookings = (belegungRaw || []).map((b, idx) => {
    const booking = {
      id: b.IDNR || String(idx + 1),
      kindId: b.KINDNR,
      startdate: convertDDMMYYYYtoYYYYMMDD(b.BELVON),
      enddate: convertDDMMYYYYtoYYYYMMDD(b.BELBIS),
      times: Zeiten2Booking(b.ZEITEN),
      rawdata: { ...b }
    };
    booking.originalData = { ...booking };
    return booking;
  });
  return assignSegmentIdsToBookings(bookings);
}

/**
 * Copies all scalar (non-object, non-array) root attributes of obj to obj.originalData.
 * Excludes 'rawdata' and 'originalData' fields.
 * Returns a new object with the originalData property set.
 */
export function copyToOriginalData(obj) {
  const originalData = {};
  for (const [key, value] of Object.entries(obj)) {
    if (
      key !== 'rawdata' &&
      key !== 'originalData' &&
      key !== 'overlays' &&
      key !== 'id' &&
      key !== 'type' &&
      key !== 'source' 
    ) {
      originalData[key] = value;
    }
  }
  return { ...obj, originalData, rawdata: obj.rawdata ? { ...obj.rawdata } : undefined };
}

/**
 * Parses an Adebis ZEITEN string into an array of booking day/segment objects.
 * Each day contains segments with booking_start, booking_end, and groupId.
 */
export function Zeiten2Booking(zeitenString) {
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
      if (start && end) {
        segments.push({ booking_start: start, booking_end: end, groupId: '' });
      }
    }
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
 * Converts Adebis groupsRaw to groupdefs with icons, rawdata, and originalData.
 * @param {Array} groupsRaw - Array of group objects with at least GRUNR and BEZ.
 * @returns {Array} groupdefs - Array of { id, name, icon, rawdata, originalData }
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

    const def = {
      id: String(group.GRUNR),
      name,
      icon,
      rawdata: { ...group }
    };
    def.originalData = { ...def };
    return def;
  });
}

/**
 * Converts Adebis employeesRaw to qualification definitions, with rawdata and originalData.
 * @param {Array} employeesRaw - Array of employee objects with at least QUALIFIK.
 * @returns {Array} qualidefs - Array of { key, name, rawdata, originalData }
 */
export function adebis2QualiDefs(employeesRaw) {
  const unique = Array.from(
    new Set((employeesRaw || []).map(e => e.QUALIFIK).filter(Boolean))
  );
  return unique.map(key => {
    let name = key;
    if (key === 'E') name = 'Erzieher';
    else if (key === 'K') name = 'Kinderpfleger';
    const def = { key, name, rawdata: { key, name } };
    def.originalData = { ...def };
    return def;
  });
}

/**
 * Converts Adebis grukiRaw to group assignments, with rawdata and originalData.
 * @param {Array} grukiRaw - Array of group assignment objects with at least KINDNR, GRUNR, GKVON, GKBIS.
 * @returns {Array} groupAssignments - Array of { kindId, groupId, start, end, rawdata, originalData }
 */
export function adebis2GroupAssignments(grukiRaw) {
  return (grukiRaw || []).map(g => {
    const assignment = {
      kindId: g.KINDNR,
      groupId: g.GRUNR,
      start: convertDDMMYYYYtoYYYYMMDD(g.GKVON),
      end: convertDDMMYYYYtoYYYYMMDD(g.GKBIS),
      rawdata: { ...g }
    };
    assignment.originalData = { ...assignment };
    return assignment;
  });
}

/**
 * Converts Adebis employeesRaw to qualification assignments, with rawdata and originalData.
 * @param {Array} employeesRaw - Array of employee objects with at least QUALIFIK and IDNR.
 * @returns {Array} qualiAssignments - Array of { qualification, dataItemId, rawdata, originalData }
 */
export function adebis2QualiAssignments(employeesRaw) {
  return (employeesRaw || [])
    .filter(e => e.QUALIFIK && e.IDNR)
    .map(e => {
      const assignment = {
        qualification: e.QUALIFIK,
        dataItemId: String(e.IDNR),
        rawdata: { QUALIFIK: e.QUALIFIK }
      };
      assignment.originalData = { ...assignment };
      return assignment;
    });
}
