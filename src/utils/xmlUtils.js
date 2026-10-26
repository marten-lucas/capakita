// Decode XML file from JSZip archive.
// adebisKITA exportiert standardmäßig in Windows-1252, kann aber auch UTF-8
// schreiben (frmxmlbackup-Option „in UTF-8", lutf8backup). Daher: BOM/XML-
// Deklaration sniffen und den passenden Decoder wählen; Latin-1 dient als
// verlustfreie Vorstufe zum Sniffen.
export async function decodeXml(zip, fname) {
  if (!fname) return null;
  const ab = await zip.files[fname].async('arraybuffer');
  const bytes = new Uint8Array(ab);

  // UTF-8-BOM?
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3));
  }

  const latin1 = new TextDecoder('latin1').decode(bytes);
  const declaration = latin1.slice(0, 200).match(/encoding\s*=\s*["']([^"']+)["']/i);
  if (declaration) {
    const encoding = declaration[1].trim().toLowerCase();
    if (encoding === 'utf-8' || encoding === 'utf8') {
      return new TextDecoder('utf-8').decode(bytes);
    }
  }

  return new TextDecoder('windows-1252').decode(bytes);
}

// Parse XML string to Document
export function parseXml(str) {
  return new window.DOMParser().parseFromString(str, 'text/xml');
}

// Get value from XML element by tag name
export function getXmlValue(el, tag) {
  return el.getElementsByTagName(tag)[0]?.textContent.trim() || '';
}

// Find the first file in the zip whose name ends with the given suffix (case-insensitive)
export function findFileBySuffix(zip, suffix) {
  suffix = suffix.toLowerCase();
  for (const fname in zip.files) {
    if (zip.files[fname].dir) continue;
    if (fname.toLowerCase().endsWith(suffix)) {
      return fname;
    }
  }
  return null;
}

// Ermittelt das Record-Tag eines adebis-Export-XMLs (erstes Kindelement des Root-Elements).
// Nötig, da die Export-Namen je Tabelle variieren (KINDER/KIND, BELEGUNGEN/BELEGUNGSBUCHUNG …).
export function detectXmlRecordTag(xml) {
  const xmlDoc = typeof xml === 'string' ? parseXml(xml) : xml;
  const firstChild = xmlDoc?.documentElement?.children?.[0];
  return firstChild?.tagName || null;
}

// Extracts a list of objects from an XML string or Document, given the parent tag, fields, filter, and options
// Records sind direkte Kinder des Root-Elements. Wichtig: getElementsByTagName allein
// würde auch gleichnamige FELDER innerhalb der Records treffen (z. B. erzber: Record-Tag
// ERZBER enthält das Logikfeld ERZBER) und Phantom-Datensätze erzeugen.
export function extractObjectListFromXml(xml, parentTag, fields, filterFn, options = {}) {
  const xmlDoc = typeof xml === 'string' ? parseXml(xml) : xml;
  const { anonymizeFields = [], anonymize = false } = options;
  const root = xmlDoc?.documentElement;
  if (!root || !parentTag) return [];

  const candidates = Array.from(root.getElementsByTagName(parentTag));
  const directChildren = candidates.filter((el) => el.parentElement === root);
  const records = directChildren.length > 0 ? directChildren : candidates;

  return records
    .map(el => {
      const obj = {};
      for (const field of fields) {
        if (anonymize && anonymizeFields.includes(field)) {
          obj[field] = '';
        } else {
          obj[field] = getXmlValue(el, field);
        }
      }
      return obj;
    })
    .filter(filterFn);
}
