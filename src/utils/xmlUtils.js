// Decode XML file from JSZip archive
export async function decodeXml(zip, fname) {
  if (!fname) return null;
  const ab = await zip.files[fname].async('arraybuffer');
  const dec = new TextDecoder('windows-1252');
  return dec.decode(ab);
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

// Extracts a list of objects from an XML string or Document, given the parent tag, fields, filter, and options
export function extractObjectListFromXml(xml, parentTag, fields, filterFn, options = {}) {
  const xmlDoc = typeof xml === 'string' ? parseXml(xml) : xml;
  const { anonymizeFields = [], anonymize = false } = options;
  return Array.from(xmlDoc.getElementsByTagName(parentTag))
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
