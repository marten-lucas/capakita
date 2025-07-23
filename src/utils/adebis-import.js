import JSZip from 'jszip';

// Extrahiert und parsed Adebis ZIP, gibt Daten für Szenario-Anlage zurück
export async function extractAdebisZipAndData(
  file,
  isAnonymized,
  importGroupsFromAdebis,
  importQualificationsFromEmployees
) {
  const JSZipLib = JSZip;
  const zip = await JSZipLib.loadAsync(file);

  let kindXml, gruppeXml, grukiXml, belegungXml, anstellXml, beitrartXml, bartbetrXml;
  for (const fname in zip.files) {
    if (zip.files[fname].dir) continue;
    const l = fname.toLowerCase();
    if (l.endsWith('kind.xml')) kindXml = fname;
    else if (l.endsWith('gruppe.xml')) gruppeXml = fname;
    else if (l.endsWith('gruki.xml')) grukiXml = fname;
    else if (l.endsWith('belegung.xml')) belegungXml = fname;
    else if (l.endsWith('anstell.xml')) anstellXml = fname;
    else if (l.endsWith('beitrart.xml')) beitrartXml = fname;
    else if (l.endsWith('bartbetr.xml')) bartbetrXml = fname;
  }
  const decodeXml = async (fname) => {
    if (!fname) return null;
    const ab = await zip.files[fname].async('arraybuffer');
    const dec = new TextDecoder('windows-1252');
    return dec.decode(ab);
  };
  const parseXml = (str) => new window.DOMParser().parseFromString(str, 'text/xml');
  const getXmlValue = (el, tag) => el.getElementsByTagName(tag)[0]?.textContent.trim() || '';

  // Parse helpers
  const parseDate = (dateString) => {
    if (!dateString) return null;
    const parts = dateString.split('.');
    if (parts.length === 3) {
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    return null;
  };
  const isFutureOrEmptyDate = (dateString) => {
    if (!dateString || dateString.trim() === '') return true;
    const date = parseDate(dateString);
    if (!date) return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return date >= now;
  };
  function parseZeiten(zeitenString) {
    if (!zeitenString) return [];
    const daysRaw = zeitenString.split('#').filter(s => s.trim() !== '');
    const parsedDays = [];
    const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    daysRaw.forEach((dayStr, dayIndex) => {
      if (dayIndex >= 5) return;
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

  // --- Gruppen-Lookup aufbauen ---
  const newGroupsLookup = {};
  if (gruppeXml) {
    const xml = parseXml(await decodeXml(gruppeXml));
    Array.from(xml.getElementsByTagName('GRUPPE')).forEach((g) => {
      const id = getXmlValue(g, 'GRUNR');
      const name = getXmlValue(g, 'BEZ');
      if (id) newGroupsLookup[id] = name;
    });
  }
  if (importGroupsFromAdebis) importGroupsFromAdebis(newGroupsLookup);

  // --- GRUKI (Gruppenzuordnung) filtern ---
  let grukiList = [];
  if (grukiXml) {
    const grukiDoc = parseXml(await decodeXml(grukiXml));
    grukiList = Array.from(grukiDoc.getElementsByTagName('GRUPPENZUORDNUNG'))
      .map(grukiEl => ({
        KINDNR: getXmlValue(grukiEl, 'KINDNR'),
        GRUNR: getXmlValue(grukiEl, 'GRUNR'),
        GKVON: getXmlValue(grukiEl, 'GKVON'),
        GKBIS: getXmlValue(grukiEl, 'GKBIS')
      }))
      .filter(g => isFutureOrEmptyDate(g.GKBIS));
  }

  // --- BELEGUNG filtern ---
  let belegungList = [];
  if (belegungXml) {
    const belegungDoc = parseXml(await decodeXml(belegungXml));
    belegungList = Array.from(belegungDoc.getElementsByTagName('BELEGUNGSBUCHUNG'))
      .map(belegungEl => ({
        IDNR: getXmlValue(belegungEl, 'IDNR'),
        KINDNR: getXmlValue(belegungEl, 'KINDNR'),
        BELVON: getXmlValue(belegungEl, 'BELVON'),
        BELBIS: getXmlValue(belegungEl, 'BELBIS'),
        ZEITEN: getXmlValue(belegungEl, 'ZEITEN')
      }))
      .filter(b => isFutureOrEmptyDate(b.BELBIS));
  }

  // --- KIND filtern ---
  let kindList = [];
  if (kindXml) {
    const kindDoc = parseXml(await decodeXml(kindXml));
    kindList = Array.from(kindDoc.getElementsByTagName('KIND'))
      .map(kindEl => ({
        KINDNR: getXmlValue(kindEl, 'KINDNR'),
        AUFNDAT: getXmlValue(kindEl, 'AUFNDAT'),
        AUSTRDAT: getXmlValue(kindEl, 'AUSTRDAT'),
        GRUNR: getXmlValue(kindEl, 'GRUNR'),
        GEBDATUM: getXmlValue(kindEl, 'GEBDATUM'),
        FNAME: getXmlValue(kindEl, 'FNAME')
      }))
      .filter(k => isFutureOrEmptyDate(k.AUSTRDAT));
  }

  // --- ANSTELLUNG filtern ---
  let anstellList = [];
  if (anstellXml) {
    const anstellDoc = parseXml(await decodeXml(anstellXml));
    anstellList = Array.from(anstellDoc.getElementsByTagName('ANSTELLUNG'))
      .map(anstellEl => ({
        IDNR: getXmlValue(anstellEl, 'IDNR'),
        BEGINNDAT: getXmlValue(anstellEl, 'BEGINNDAT'),
        ENDDAT: getXmlValue(anstellEl, 'ENDDAT'),
        ARBZEIT: getXmlValue(anstellEl, 'ARBZEIT'),
        URLAUB: getXmlValue(anstellEl, 'URLAUB'),
        QUALIFIK: getXmlValue(anstellEl, 'QUALIFIK'),
        VERTRAGART: getXmlValue(anstellEl, 'VERTRAGART'),
        ZEITEN: getXmlValue(anstellEl, 'ZEITEN')
      }))
      .filter(a => isFutureOrEmptyDate(a.ENDDAT));
  }

  // --- Beitragarten (rates) ---
  let rates = [];
  if (beitrartXml) {
    const beitrartXmlContent = await decodeXml(beitrartXml);
    console.log('adebis-import: beitrart.xml read:', !!beitrartXmlContent);
    const xml = parseXml(beitrartXmlContent);
    rates = Array.from(xml.getElementsByTagName('BEITRAGSART')).map(el => ({
      id: getXmlValue(el, 'BARTNR'),
      name: getXmlValue(el, 'BEZ'),
      text: getXmlValue(el, 'TEXT'),
      kostenst: getXmlValue(el, 'KOSTENST'),
      multiple: getXmlValue(el, 'MULTIPLE'),
      status: getXmlValue(el, 'STATUS'),
      variabel: getXmlValue(el, 'VARIABEL')
    }));
  } else {
    console.log('adebis-import: beitrart.xml not found');
  }

  // --- Bartbetr (rate amounts) ---
  let rateAmounts = [];
  if (bartbetrXml) {
    const bartbetrXmlContent = await decodeXml(bartbetrXml);
    console.log('adebis-import: bartbetr.xml read:', !!bartbetrXmlContent);
    const xml = parseXml(bartbetrXmlContent);
    // Try BEITRAGSSATZ instead of BARTBETR
    const allAmounts = Array.from(xml.getElementsByTagName('BEITRAGSSATZ')).map(el => ({
      id: getXmlValue(el, 'BARTNR'),
      amount: getXmlValue(el, 'BETRAG'),
      validFrom: getXmlValue(el, 'GUELTIGVON'),
      validTo: getXmlValue(el, 'GUELTIGBIS'),
      text: getXmlValue(el, 'TEXT')
    }));
    // Only keep amounts valid today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    rateAmounts = allAmounts.filter(a => {
      const from = a.validFrom ? parseDate(a.validFrom) : null;
      const to = a.validTo ? parseDate(a.validTo) : null;
      return (!from || from <= today) && (!to || to >= today);
    });
    if (rateAmounts.length === 0) {
      console.log('adebis-import: bartbetr.xml structure:', xml.documentElement.outerHTML);
    }
  } else {
    console.log('adebis-import: bartbetr.xml not found');
  }

  // --- Build simulationData ---
  let idCounter = 1;
  const processedData = [];

  // Kids (demand)
  for (const kind of kindList) {
    const groups = grukiList.filter(g => g.KINDNR === kind.KINDNR).map(g => ({
      id: parseInt(g.GRUNR),
      name: newGroupsLookup[g.GRUNR] || `Gruppe ${g.GRUNR}`,
      start: g.GKVON,
      end: g.GKBIS
    }));
    // --- Build bookings with rawdata and originalData ---
    const bookings = belegungList.filter(b => b.KINDNR === kind.KINDNR).map(b => {
      const times = parseZeiten(b.ZEITEN);
      const rawdata = {
        BELVON: b.BELVON,
        BELBIS: b.BELBIS,
        ZEITEN: b.ZEITEN
      };
      const bookingObj = {
        startdate: b.BELVON,
        enddate: b.BELBIS,
        times,
        rawdata,
      };
      bookingObj.originalData = JSON.parse(JSON.stringify({
        startdate: bookingObj.startdate,
        enddate: bookingObj.enddate,
        times: bookingObj.times,
        rawdata: bookingObj.rawdata
      }));
      return bookingObj;
    });

    processedData.push({
      id: idCounter++,
      type: "demand",
      name: isAnonymized ? `Kind ${kind.KINDNR}` : kind.FNAME,
      rawdata: {
        source: "adebis export",
        data: {
          KIND: {
            KINDNR: kind.KINDNR,
            AUFNDAT: kind.AUFNDAT,
            AUSTRDAT: kind.AUSTRDAT,
            GRUNR: kind.GRUNR,
            GEBDATUM: kind.GEBDATUM,
            FNAME: isAnonymized ? '' : kind.FNAME
          }
        }
      },
      parseddata: {
        startdate: kind.AUFNDAT,
        enddate: kind.AUSTRDAT,
        geburtsdatum: kind.GEBDATUM,
        group: groups,
        booking: bookings
      },
      originalParsedData: JSON.parse(JSON.stringify({
        startdate: kind.AUFNDAT,
        enddate: kind.AUSTRDAT,
        geburtsdatum: kind.GEBDATUM,
        group: groups,
        booking: bookings
      }))
    });
  }

  // Employees (capacity)
  const employeeItems = [];
  for (const a of anstellList) {
    // --- Build booking with rawdata and originalData ---
    const initialBookingTimes = parseZeiten(a.ZEITEN).map(dayTime => ({
      ...dayTime,
      segments: dayTime.segments.map(segment => ({ ...segment, groupId: '' }))
    }));
    const bookingRawdata = {
      BEGINNDAT: a.BEGINNDAT,
      ENDDAT: a.ENDDAT,
      ARBZEIT: a.ARBZEIT,
      ZEITEN: a.ZEITEN
    };
    const bookingObj = {
      startdate: a.BEGINNDAT,
      enddate: a.ENDDAT,
      times: initialBookingTimes,
      rawdata: bookingRawdata
    };
    bookingObj.originalData = JSON.parse(JSON.stringify({
      startdate: bookingObj.startdate,
      enddate: bookingObj.enddate,
      times: bookingObj.times,
      rawdata: bookingObj.rawdata
    }));

    const employeeItem = {
      id: idCounter++,
      type: "capacity",
      name: `Mitarbeiter ${a.IDNR}`,
      rawdata: {
        source: "adebis export",
        data: {
          ANSTELLUNG: {
            IDNR: a.IDNR,
            BEGINNDAT: a.BEGINNDAT,
            ENDDAT: a.ENDDAT,
            ARBZEIT: a.ARBZEIT,
            URLAUB: a.URLAUB,
            QUALIFIK: a.QUALIFIK,
            VERTRAGART: a.VERTRAGART,
            ZEITEN: a.ZEITEN
          }
        }
      },
      parseddata: {
        startdate: a.BEGINNDAT,
        enddate: a.ENDDAT,
        qualification: a.QUALIFIK,
        vacation: a.URLAUB,
        worktime: a.ARBZEIT,
        booking: [bookingObj],
        group: []
      },
      originalParsedData: JSON.parse(JSON.stringify({
        startdate: a.BEGINNDAT,
        enddate: a.ENDDAT,
        qualification: a.QUALIFIK,
        vacation: a.URLAUB,
        worktime: a.ARBZEIT,
        booking: [bookingObj],
        group: []
      }))
    };
    processedData.push(employeeItem);
    employeeItems.push(employeeItem);
  }

  // NOTE: All group and qualification import logic is centralized here.
  // Groups are imported via importGroupsFromAdebis(newGroupsLookup)
  // Qualifications are imported via importQualificationsFromEmployees(employeeItems)

  if (importQualificationsFromEmployees) importQualificationsFromEmployees(employeeItems);

  const uniqueGroupNames = Object.values(newGroupsLookup);
  const uniqueQualifications = Array.from(new Set(employeeItems.map(e => e.parseddata.qualification).filter(Boolean)));

  return {
    processedData,
    employeeItems,
    newGroupsLookup,
    uniqueGroupNames,
    uniqueQualifications,
    rates,
    rateAmounts
  };
}
