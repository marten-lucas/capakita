import { loadZip } from './zipUtils';
import { isFutureOrEmptyDate } from './dateUtils';
import { decodeXml, findFileBySuffix, extractObjectListFromXml, detectXmlRecordTag, parseXml } from './xmlUtils';

// Extracts and filters the kids, employees, groups, group assignments, and bookings from an Adebis ZIP file
export async function extractAdebisData(file, isAnonymized, options = {}) {
    const mode = options?.mode === 'historical' ? 'historical' : 'snapshot';
    const isSnapshotMode = mode === 'snapshot';
    const warnings = [];

    const zip = await loadZip(file);

    // Find relevant XML files in the ZIP
    const kindXml = findFileBySuffix(zip, 'kind.xml');
    const anstellXml = findFileBySuffix(zip, 'anstell.xml');
    const gruppeXml = findFileBySuffix(zip, 'gruppe.xml');
    const grukiXml = findFileBySuffix(zip, 'gruki.xml');
    const belegungXml = findFileBySuffix(zip, 'belegung.xml');
    // Optional: Familien-/Geschwisterlogik (adebis-Datenmodell: erzber = Stern über Adressen)
    const erzberXml = findFileBySuffix(zip, 'erzber.xml');
    const adressenXml = findFileBySuffix(zip, 'adressen.xml');


    // Kids
    let kidsRaw = [];
    if (kindXml) {
        const kindXmlString = await decodeXml(zip, kindXml);
        kidsRaw = extractObjectListFromXml(
            kindXmlString,
            'KIND',
            [
                'KINDNR', 'AUFNDAT', 'AUSTRDAT', 'GRUNR', 'GEBDATUM', 'FNAME', 'STATUS',
                'SUBSTATUS', 'SCHULART', 'SPRACHE', 'GESCHLECHT',
                // Familien-/Geschwisterbasis: Familienname + Haushaltsadresse + adebis-Geschwisterfelder
                'NAME', 'VORNAME', 'STRASSE', 'LKZ', 'PLZ', 'WOHNORT', 'ORTSTEIL',
                'ANZGESCHW', 'GESCHW1VN', 'GESCHW1GD', 'GESCHW2VN', 'GESCHW2GD',
                'GESCHW3VN', 'GESCHW3GD'
            ],
            k => {
                if (!isSnapshotMode) return true;
                return isFutureOrEmptyDate(k.AUSTRDAT) && k.STATUS === '+';
            },
            {
                anonymizeFields: [
                    'FNAME', 'NAME', 'VORNAME', 'STRASSE', 'PLZ', 'WOHNORT', 'ORTSTEIL',
                    'GESCHW1VN', 'GESCHW2VN', 'GESCHW3VN'
                ],
                anonymize: isAnonymized
            }
        );
    } else {
        warnings.push({ code: 'MISSING_KIND_XML', message: 'kind.xml nicht gefunden.' });
    }


    // Employees
    let employeesRaw = [];
    if (anstellXml) {
        const anstellXmlString = await decodeXml(zip, anstellXml);
        employeesRaw = extractObjectListFromXml(
            anstellXmlString,
            'ANSTELLUNG',
            [
                'IDNR',
                'BEGINNDAT',
                'ENDDAT',
                'ARBZEIT',
                'ARBZEITB',
                'URLAUB',
                'QUALIFIK',
                'VERTRAGART',
                'ERSATZKR',
                'PERSBONUS',
                'STATUS',
                'ZEITEN'
            ],
            a => (isSnapshotMode ? isFutureOrEmptyDate(a.ENDDAT) : true)
        );
    } else {
        warnings.push({ code: 'MISSING_ANSTELL_XML', message: 'anstell.xml nicht gefunden.' });
    }

    // Groups
    let groupsRaw = [];
    if (gruppeXml) {
        const gruppeXmlString = await decodeXml(zip, gruppeXml);
        groupsRaw = extractObjectListFromXml(
            gruppeXmlString,
            'GRUPPE',
            ['GRUNR', 'BEZ'],
            () => true
        );
    } else {
        warnings.push({ code: 'MISSING_GRUPPE_XML', message: 'gruppe.xml nicht gefunden.' });
    }

    // Group assignments (GRUKI)
    let grukiRaw = [];
    if (grukiXml) {
        const grukiXmlString = await decodeXml(zip, grukiXml);
        grukiRaw = extractObjectListFromXml(
            grukiXmlString,
            'GRUPPENZUORDNUNG',
            ['KINDNR', 'GRUNR', 'GKVON', 'GKBIS', 'TYP'],
            g => (isSnapshotMode ? isFutureOrEmptyDate(g.GKBIS) : true)
        );
    } else {
        warnings.push({ code: 'MISSING_GRUKI_XML', message: 'gruki.xml nicht gefunden.' });
    }

    // Bookings (BELEGUNG)
    let belegungRaw = [];
    if (belegungXml) {
        const belegungXmlString = await decodeXml(zip, belegungXml);
        belegungRaw = extractObjectListFromXml(
            belegungXmlString,
            'BELEGUNGSBUCHUNG',
            [
                'IDNR', 'KINDNR', 'BELVON', 'BELBIS', 'ZEITEN',
                'ART', 'ZEITKAT', 'BUZEITKAT', 'GEWKAT', 'PANTEIL',
                'BETRSTD', 'BETRTAGE', 'FERIEN', 'SCHULKIND', 'KRIPPENK',
                'VORKURS', 'BEHINDERT', 'MIGRATION'
            ],
            b => (isSnapshotMode ? isFutureOrEmptyDate(b.BELBIS) : true)
        );
    } else {
        warnings.push({ code: 'MISSING_BELEGUNG_XML', message: 'belegung.xml nicht gefunden.' });
    }

    // Erziehungsberechtigte-Verknüpfungen (erzber: adrnr ↔ kindnr, EB-/Abholer-/Beitragszahler-Flags)
    let erzberRaw = [];
    if (erzberXml) {
        const erzberXmlString = await decodeXml(zip, erzberXml);
        erzberRaw = extractObjectListFromXml(
            erzberXmlString,
            detectXmlRecordTag(parseXml(erzberXmlString)) || 'ERZBER',
            [
                'IDNR', 'LFDNR', 'ADRNR', 'KINDNR', 'ERZBER', 'ALLEINERZ', 'ALLEINSORG',
                'BEITRZAHL', 'BEZZUKIND', 'ABHOLER', 'POST'
            ],
            () => true
        );
    }

    // Adressstamm (Personen/Institutionen) für Familien-Labels
    let adressenRaw = [];
    if (adressenXml) {
        const adressenXmlString = await decodeXml(zip, adressenXml);
        adressenRaw = extractObjectListFromXml(
            adressenXmlString,
            detectXmlRecordTag(parseXml(adressenXmlString)) || 'ADRESSE',
            [
                'ADRNR', 'ANREDE', 'TITEL', 'NAME', 'VORNAME', 'STRASSE', 'LKZ', 'PLZ',
                'WOHNORT', 'FAMSTAND', 'ERZBER', 'MITARB'
            ],
            () => true,
            {
                anonymizeFields: ['ANREDE', 'TITEL', 'NAME', 'VORNAME', 'STRASSE', 'PLZ', 'WOHNORT'],
                anonymize: isAnonymized
            }
        );
    }

    return {
        importMeta: {
            mode,
            generatedAt: new Date().toISOString(),
            warnings,
            conflicts: []
        },
        rawdata: {
            kidsRaw,
            employeesRaw,
            groupsRaw,
            grukiRaw,
            belegungRaw,
            erzberRaw,
            adressenRaw
        }
    };
}

// Note: Ensure all downstream parser functions return string IDs for compatibility with slices.