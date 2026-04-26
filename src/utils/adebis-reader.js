import { loadZip } from './zipUtils';
import { isFutureOrEmptyDate } from './dateUtils';
import { decodeXml, findFileBySuffix, extractObjectListFromXml } from './xmlUtils';

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


    // Kids
    let kidsRaw = [];
    if (kindXml) {
        const kindXmlString = await decodeXml(zip, kindXml);
        kidsRaw = extractObjectListFromXml(
            kindXmlString,
            'KIND',
            ['KINDNR', 'AUFNDAT', 'AUSTRDAT', 'GRUNR', 'GEBDATUM', 'FNAME', 'STATUS'],
            k => {
                if (!isSnapshotMode) return true;
                return isFutureOrEmptyDate(k.AUSTRDAT) && k.STATUS === '+';
            },
            { anonymizeFields: ['FNAME'], anonymize: isAnonymized }
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
                'URLAUB',
                'QUALIFIK',
                'VERTRAGART',
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
            ['KINDNR', 'GRUNR', 'GKVON', 'GKBIS'],
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
            ['IDNR', 'KINDNR', 'BELVON', 'BELBIS', 'ZEITEN'],
            b => (isSnapshotMode ? isFutureOrEmptyDate(b.BELBIS) : true)
        );
    } else {
        warnings.push({ code: 'MISSING_BELEGUNG_XML', message: 'belegung.xml nicht gefunden.' });
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
            belegungRaw
        }
    };
}

// Note: Ensure all downstream parser functions return string IDs for compatibility with slices.