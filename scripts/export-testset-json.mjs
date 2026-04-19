#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';

const [, , inputArg, outputArg] = process.argv;

if (!inputArg) {
  console.error('Usage: node scripts/export-testset-json.mjs <input.zip> [output.json]');
  process.exit(1);
}

const inputPath = path.resolve(process.cwd(), inputArg);
const inputBaseName = path.basename(inputPath, path.extname(inputPath));
const outputPath = path.resolve(
  process.cwd(),
  outputArg || path.join('tmp', `${inputBaseName}.inspect.json`)
);

function convertDDMMYYYYtoYYYYMMDD(dateString) {
  if (!dateString) return '';
  const parts = String(dateString).split('.');
  if (parts.length !== 3) return '';
  return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
}

function parseGermanDateString(dateString) {
  if (!dateString) return null;
  const parts = String(dateString).split('.');
  if (parts.length !== 3) return null;
  return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
}

function isFutureOrEmptyDate(dateString) {
  if (!dateString || String(dateString).trim() === '') return true;
  const date = parseGermanDateString(dateString);
  if (!date || Number.isNaN(date.getTime())) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return date >= now;
}

function hasRealTimes(value) {
  return /\b\d{1,2}:\d{2}\b/.test(String(value || ''));
}

function normalizeNode(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(normalizeNode);
  if (typeof value === 'object') {
    const entries = Object.entries(value).map(([key, child]) => [key, normalizeNode(child)]);
    return Object.fromEntries(entries);
  }
  return String(value).trim();
}

function findAllByTag(node, tagName, results = []) {
  if (Array.isArray(node)) {
    node.forEach((entry) => findAllByTag(entry, tagName, results));
    return results;
  }

  if (!node || typeof node !== 'object') {
    return results;
  }

  Object.entries(node).forEach(([key, value]) => {
    if (key === tagName) {
      if (Array.isArray(value)) results.push(...value.map(normalizeNode));
      else results.push(normalizeNode(value));
    }
    findAllByTag(value, tagName, results);
  });

  return results;
}

function parseZeiten(zeitenString) {
  if (!hasRealTimes(zeitenString)) return [];

  const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  return String(zeitenString)
    .split('#')
    .map((dayStr, dayIndex) => {
      const parts = String(dayStr).split('|').map((part) => part.trim());
      const segments = [];

      for (let i = 0; i < parts.length; i += 2) {
        const start = parts[i];
        const end = parts[i + 1];
        if (start && end && hasRealTimes(`${start}-${end}`)) {
          segments.push({ booking_start: start, booking_end: end });
        }
      }

      if (segments.length === 0) return null;

      return {
        day: dayIndex + 1,
        day_name: dayNames[dayIndex] || `Tag ${dayIndex + 1}`,
        segments,
      };
    })
    .filter(Boolean);
}

function qualificationName(key) {
  if (key === 'E') return 'Erzieher';
  if (key === 'K') return 'Kinderpfleger';
  if (key === 'W') return 'Weiterbildung';
  return key || '';
}

function uniqueByJson(items) {
  const seen = new Set();
  return items.filter((item) => {
    const token = JSON.stringify(item);
    if (seen.has(token)) return false;
    seen.add(token);
    return true;
  });
}

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: true,
});

const zipBuffer = await readFile(inputPath);
const zip = await JSZip.loadAsync(zipBuffer);

function findEntryBySuffix(suffix) {
  return Object.keys(zip.files).find((name) => name.toLowerCase().endsWith(suffix));
}

async function readXmlRecords(suffix, tagName, predicate = () => true) {
  const entryName = findEntryBySuffix(suffix);
  if (!entryName) return { fileName: null, records: [] };
  const xmlText = await zip.file(entryName).async('string');
  const parsed = parser.parse(xmlText);
  const records = findAllByTag(parsed, tagName).filter(predicate);
  return { fileName: entryName, records };
}

const kindData = await readXmlRecords(
  'kind.xml',
  'KIND',
  (item) => isFutureOrEmptyDate(item.AUSTRDAT) && item.STATUS === '+'
);
const employeeData = await readXmlRecords(
  'anstell.xml',
  'ANSTELLUNG',
  (item) => isFutureOrEmptyDate(item.ENDDAT)
);
const groupData = await readXmlRecords('gruppe.xml', 'GRUPPE');
const grukiData = await readXmlRecords(
  'gruki.xml',
  'GRUPPENZUORDNUNG',
  (item) => isFutureOrEmptyDate(item.GKBIS)
);
const bookingData = await readXmlRecords(
  'belegung.xml',
  'BELEGUNGSBUCHUNG',
  (item) => isFutureOrEmptyDate(item.BELBIS)
);

const groupsById = new Map(groupData.records.map((group) => [String(group.GRUNR), group]));

const people = [];

for (const child of kindData.records) {
  const childId = String(child.KINDNR);
  const bookingLinks = bookingData.records
    .filter((booking) => String(booking.KINDNR) === childId)
    .map((booking) => ({
      sourceFile: bookingData.fileName,
      linkType: 'booking',
      relationKeys: {
        KINDNR: childId,
        IDNR: String(booking.IDNR || ''),
      },
      hasTimes: hasRealTimes(booking.ZEITEN),
      parsedTimes: parseZeiten(booking.ZEITEN),
      raw: booking,
    }));

  const assignmentLinks = grukiData.records
    .filter((assignment) => String(assignment.KINDNR) === childId)
    .map((assignment) => ({
      sourceFile: grukiData.fileName,
      linkType: 'group-assignment',
      relationKeys: {
        KINDNR: childId,
        GRUNR: String(assignment.GRUNR || ''),
      },
      raw: assignment,
      group: groupsById.has(String(assignment.GRUNR))
        ? {
            sourceFile: groupData.fileName,
            raw: groupsById.get(String(assignment.GRUNR)),
          }
        : null,
    }));

  const directGroups = uniqueByJson(
    [child.GRUNR, ...assignmentLinks.map((entry) => entry.relationKeys.GRUNR)]
      .filter(Boolean)
      .map((groupId) => ({
        sourceFile: groupData.fileName,
        relationKeys: { GRUNR: String(groupId) },
        raw: groupsById.get(String(groupId)) || null,
      }))
  );

  people.push({
    entityType: 'child',
    id: childId,
    displayName: child.FNAME || `Kind ${childId}`,
    sourceFile: kindData.fileName,
    expectedImport: {
      type: 'demand',
      name: child.FNAME || `Kind ${childId}`,
      startdate: convertDDMMYYYYtoYYYYMMDD(child.AUFNDAT),
      enddate: convertDDMMYYYYtoYYYYMMDD(child.AUSTRDAT),
      dateofbirth: convertDDMMYYYYtoYYYYMMDD(child.GEBDATUM),
      groupId: child.GRUNR ? String(child.GRUNR) : '',
      hasBookingTimes: bookingLinks.some((entry) => entry.hasTimes),
    },
    links: {
      bookings: bookingLinks,
      groupAssignments: assignmentLinks,
      groups: directGroups,
    },
    raw: child,
  });
}

for (const employee of employeeData.records) {
  const employeeId = String(employee.IDNR);
  const qualificationKey = String(employee.QUALIFIK || '');

  people.push({
    entityType: 'employee',
    id: employeeId,
    displayName: `Mitarbeiter ${employeeId}`,
    sourceFile: employeeData.fileName,
    expectedImport: {
      type: 'capacity',
      name: `Mitarbeiter ${employeeId}`,
      startdate: convertDDMMYYYYtoYYYYMMDD(employee.BEGINNDAT),
      enddate: convertDDMMYYYYtoYYYYMMDD(employee.ENDDAT),
      qualification: qualificationKey,
      qualificationName: qualificationName(qualificationKey),
      hasBookingTimes: hasRealTimes(employee.ZEITEN),
    },
    links: {
      bookings: [
        {
          sourceFile: employeeData.fileName,
          linkType: 'employee-times',
          relationKeys: { IDNR: employeeId },
          hasTimes: hasRealTimes(employee.ZEITEN),
          parsedTimes: parseZeiten(employee.ZEITEN),
          raw: {
            IDNR: employee.IDNR,
            BEGINNDAT: employee.BEGINNDAT,
            ENDDAT: employee.ENDDAT,
            ARBZEIT: employee.ARBZEIT,
            URLAUB: employee.URLAUB,
            QUALIFIK: employee.QUALIFIK,
            VERTRAGART: employee.VERTRAGART,
            ZEITEN: employee.ZEITEN,
          },
        },
      ],
      qualification: qualificationKey
        ? {
            sourceFile: employeeData.fileName,
            linkType: 'qualification',
            relationKeys: { IDNR: employeeId, QUALIFIK: qualificationKey },
            raw: {
              key: qualificationKey,
              name: qualificationName(qualificationKey),
            },
          }
        : null,
      groups: [],
    },
    raw: employee,
  });
}

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(people, null, 2), 'utf8');

const childCount = people.filter((entry) => entry.entityType === 'child').length;
const employeeCount = people.filter((entry) => entry.entityType === 'employee').length;

console.log(`Created ${outputPath}`);
console.log(`Children: ${childCount}`);
console.log(`Employees: ${employeeCount}`);
console.log(`Total records: ${people.length}`);
