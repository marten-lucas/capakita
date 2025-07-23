import { loadZip } from './zipUtils';
import { isFutureOrEmptyDate } from './dateUtils';
import { decodeXml, findFileBySuffix, extractObjectListFromXml } from './xmlUtils';

// Extracts and filters the kids, employees, groups, group assignments, and bookings from an Adebis ZIP file
export async function extractAdebisData(file, isAnonymized) {
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
            ['KINDNR', 'AUFNDAT', 'AUSTRDAT', 'GRUNR', 'GEBDATUM', 'FNAME'],
            k => isFutureOrEmptyDate(k.AUSTRDAT),
            { anonymizeFields: ['FNAME'], anonymize: isAnonymized }
        );
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
            a => isFutureOrEmptyDate(a.ENDDAT)
        );
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
    }

    // Group assignments (GRUKI)
    let grukiRaw = [];
    if (grukiXml) {
        const grukiXmlString = await decodeXml(zip, grukiXml);
        grukiRaw = extractObjectListFromXml(
            grukiXmlString,
            'GRUPPENZUORDNUNG',
            ['KINDNR', 'GRUNR', 'GKVON', 'GKBIS'],
            g => isFutureOrEmptyDate(g.GKBIS)
        );
    }

    // Bookings (BELEGUNG)
    let belegungRaw = [];
    if (belegungXml) {
        const belegungXmlString = await decodeXml(zip, belegungXml);
        belegungRaw = extractObjectListFromXml(
            belegungXmlString,
            'BELEGUNGSBUCHUNG',
            ['IDNR', 'KINDNR', 'BELVON', 'BELBIS', 'ZEITEN'],
            b => isFutureOrEmptyDate(b.BELBIS)
        );
    }

    return {
        rawdata: {
            kidsRaw,
            employeesRaw,
            groupsRaw,
            grukiRaw,
            belegungRaw
        }
    };
}