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
    let item = {
      id: newId,
      type: 'demand',
      source: "adebis export",
      name: kind.FNAME || `Kind ${kind.KINDNR}`,
      remark: "",
      startdate: convertDDMMYYYYtoYYYYMMDD(kind.AUFNDAT) || '',
      enddate: convertDDMMYYYYtoYYYYMMDD(kind.AUSTRDAT) || '',
      dateofbirth: convertDDMMYYYYtoYYYYMMDD(kind.GEBDATUM) || '',
      groupId: kind.GRUNR ? String(kind.GRUNR) : "",
      rawdata: { ...kind },
      absences: [],
      adebisId: { id: String(kind.KINDNR), source: "kind" }
    };
    simDataList.push(addOriginalData(item));
  }

  // Employees (capacity)
  for (const emp of employeesRaw || []) {
    const newId = createId('simdata');
    let item = {
      id: newId,
      type: 'capacity',
      source: "adebis export",
      name: `Mitarbeiter ${emp.IDNR}`,
      remark: "",
      startdate: convertDDMMYYYYtoYYYYMMDD(emp.BEGINNDAT) || '',
      enddate: convertDDMMYYYYtoYYYYMMDD(emp.ENDDAT) || '',
      dateofbirth: "",
      groupId: "",
      rawdata: { ...emp },
      absences: [],
      adebisId: { id: String(emp.IDNR), source: "anstell" }
    };
    simDataList.push(addOriginalData(item));
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
    let booking = {
      id: bookingId,
      startdate: convertDDMMYYYYtoYYYYMMDD(b.BELVON) || '',
      enddate: convertDDMMYYYYtoYYYYMMDD(b.BELBIS) || '',
      times: Zeiten2Booking(b.ZEITEN, bookingId),
      rawdata: { ...b },
      adebisId: { id: String(b.IDNR), source: "belegung" }
    };
    bookings.push(addOriginalData(booking));
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
      startdate: convertDDMMYYYYtoYYYYMMDD(e.BEGINNDAT) || '',
      enddate: convertDDMMYYYYtoYYYYMMDD(e.ENDDAT) || '',
      times: Zeiten2Booking(e.ZEITEN, bookingId),
      rawdata: { ...e },
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
    let IsSchool = false;
    if (lowerName.includes('schul')) {
      icon = '🏫';
      IsSchool = true;
    }
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

    let groupDef = {
      id: String(group.GRUNR),
      name,
      icon,
      IsSchool, 
      rawdata: { ...group }
    };
    return addOriginalData(groupDef);
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
    else if (key === 'W') name = 'Weiterbildung';
    let qualiDef = { key, name, rawdata: { key, name } };
    return addOriginalData(qualiDef);
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
    let assignment = {
      groupId: String(g.GRUNR),
      start: convertDDMMYYYYtoYYYYMMDD(g.GKVON) || '',
      end: convertDDMMYYYYtoYYYYMMDD(g.GKBIS) || '',
      rawdata: { ...g }
    };
    groupAssignments.push(addOriginalData(assignment));
    groupAssignmentReference.push({
      assignmentKey,
      adebisId: { id: String(g.KINDNR), source: "kind" }
    });
  });
  return { groupAssignments, groupAssignmentReference };
}



/**
 * Generates qualification assignments for all capacity items in dataByScenario.
 * @param {Object} dataByScenario - The scenario data keyed by storeKey.
 * @returns {Object} qualiAssignmentsFinal - { [dataItemId]: { [assignmentId]: assignmentObj } }
 */
export function adebis2QualiAssignments(dataByScenario) {
  const qualiAssignmentsFinal = {};
  Object.entries(dataByScenario).forEach(([storeKey, item]) => {
    if (item.type === 'capacity' && item.rawdata && item.rawdata.QUALIFIK) {
      const id = `${item.rawdata.QUALIFIK}-${Date.now()}-${Math.random()}`;
      const qualiAssignment = {
        dataItemId: storeKey,
        qualification: item.rawdata.QUALIFIK,
        id
      };
      if (!qualiAssignmentsFinal[storeKey]) qualiAssignmentsFinal[storeKey] = {};
      qualiAssignmentsFinal[storeKey][id] = addOriginalData(qualiAssignment);
    }
  });
  return qualiAssignmentsFinal;
}

/**
 * Adds originalData to an object by excluding rawdata, adebisId, and id.
 * @param {Object} item - The object to process.
 * @returns {Object} The object with originalData added.
 */
function addOriginalData(item) {
  const { rawdata: _, adebisId: __, id: ___, ...rest } = item; // Exclude rawdata, adebisId, and id without assigning
  return { ...item, originalData: rest };
}
