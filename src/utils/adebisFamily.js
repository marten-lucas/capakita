/**
 * Familien- und Geschwisterlogik für adebisKITA-Importe.
 *
 * Reverse-Engineering-Quelle (adebisKITA 7.5, adebis-re/docs/fachdomaene.md §4):
 * - Familie = Stern über der Link-Tabelle `erzber`: ein Kind hat n Bezugspersonen,
 *   jeweils als ADRESSEN-Datensatz (adrnr). Es gibt KEINE feste Vater-/Mutter-Rolle
 *   am Kind-Satz – Rollen (Erziehungsberechtigt/Beitragszahler/Abholer) leben in
 *   erzber-Logikflags.
 * - Geschwister = Kinder, die mindestens eine Erziehungsberechtigten-Adresse
 *   (adrnr) teilen. Bei getrennter Betreuung (Vater + Mutter als zwei Adressen)
 *   entsteht über die Union-Find-Verschmelzung eine gemeinsame Familie.
 *
 * Fallback (ohne erzber.xml im Export): Kinder desselben Haushalts über die
 * Adressfelder von kind.xml (NAME + STRASSE + PLZ + WOHNORT) gruppieren.
 * Bei anonymisiertem Import bleiben die Adressfelder leer → bewusst keine
 * Familienzuordnung (Datenschutz vor Heuristik).
 */

import { isAdebisTrue } from './adebisConstants';

/** Text für Adress-/Namensabgleich normalisieren (Case, Whitespace). */
export function normalizeAddressText(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Haushalts-Schlüssel eines kind.xml-Datensatzes.
 * null, wenn Name oder Adresse unvollständig sind (kein falsches Matching erzwingen).
 */
export function getHouseholdKey(kindRaw) {
  const name = normalizeAddressText(kindRaw?.NAME);
  const street = normalizeAddressText(kindRaw?.STRASSE);
  const plz = normalizeAddressText(kindRaw?.PLZ);
  const ort = normalizeAddressText(kindRaw?.WOHNORT);
  if (!name || !street || !plz) return null;
  return [name, street, plz, ort].join('|');
}

/** Stabiler, deterministischer Kurz-Hash (djb2) für Familien-IDs. */
function stableHash(text) {
  let hash = 5381;
  const value = String(text || '');
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash * 33) ^ value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

/** Union-Find über Kindnummern, die mindestens eine Adresse teilen. */
function createUnionFind() {
  const parent = new Map();
  const find = (key) => {
    if (!parent.has(key)) parent.set(key, key);
    let root = key;
    while (parent.get(root) !== root) root = parent.get(root);
    // Pfadkompression
    let node = key;
    while (parent.get(node) !== node) {
      const next = parent.get(node);
      parent.set(node, root);
      node = next;
    }
    return root;
  };
  const union = (a, b) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootB, rootA);
  };
  return { find, union };
}

function buildErzberRelations({ kidsRaw, erzberRaw, adressenRaw }) {
  // adrnr → kindnrs; nur Erziehungsberechtigte-Flags zählen. Legacy-Bestände,
  // in denen das ERZBER-Flag nie gesetzt wurde, werten alle Links als EB-Beziehung.
  const linksByAdrnr = new Map();
  (erzberRaw || []).forEach((record) => {
    const adrnr = String(record?.ADRNR || '').trim();
    const kindnr = String(record?.KINDNR || '').trim();
    if (!adrnr || !kindnr) return;
    if (!linksByAdrnr.has(adrnr)) linksByAdrnr.set(adrnr, []);
    linksByAdrnr.get(adrnr).push({ kindnr, erzberFlag: record?.ERZBER });
  });

  const anyErzberFlag = (erzberRaw || []).some((record) => isAdebisTrue(record?.ERZBER));
  if (anyErzberFlag) {
    linksByAdrnr.forEach((links, adrnr) => {
      linksByAdrnr.set(adrnr, links.filter((link) => isAdebisTrue(link.erzberFlag)));
    });
  }

  // Kinder verschmelzen, die eine Adresse teilen (Union-Find)
  const unionFind = createUnionFind();
  linksByAdrnr.forEach((links) => {
    const linked = links.map((link) => link.kindnr);
    if (linked.length < 2) {
      // Einzel-Link: Kind bekommt seine Adresse als Familie (auch ohne Geschwister)
      if (linked.length === 1) unionFind.find(linked[0]);
      return;
    }
    for (let i = 1; i < linked.length; i += 1) unionFind.union(linked[0], linked[i]);
  });

  // Komponenten sammeln
  const components = new Map(); // root → { kindnrs: Set, adrnr: Set }
  linksByAdrnr.forEach((links, adrnr) => {
    links.forEach((link) => {
      const root = unionFind.find(link.kindnr);
      if (!components.has(root)) components.set(root, { kindnrs: new Set(), adrnr: new Set() });
      const component = components.get(root);
      component.kindnrs.add(link.kindnr);
      component.adrnr.add(adrnr);
    });
  });

  const nameByAdrnr = new Map();
  (adressenRaw || []).forEach((record) => {
    const adrnr = String(record?.ADRNR || '').trim();
    const name = String(record?.NAME || '').trim();
    if (adrnr && name && !nameByAdrnr.has(adrnr)) nameByAdrnr.set(adrnr, name);
  });

  const kindNameByKindnr = new Map();
  (kidsRaw || []).forEach((k) => {
    const kindnr = String(k?.KINDNR || '').trim();
    const name = String(k?.NAME || '').trim();
    if (kindnr && name && !kindNameByKindnr.has(kindnr)) kindNameByKindnr.set(kindnr, name);
  });

  const families = [];
  const kindnrToFamilyId = {};
  Array.from(components.values())
    .sort((a, b) => Math.min(...a.adrnr) - Math.min(...b.adrnr))
    .forEach((component) => {
      const adrnrList = Array.from(component.adrnr).sort((a, b) => Number(a) - Number(b));
      const id = `fam-erzber-${stableHash(adrnrList.join(','))}`;
      // Familienname: bevorzugt aus adressen.xml, sonst Familienname der Kinder
      const addressName = adrnrList.map((adrnr) => nameByAdrnr.get(adrnr)).find(Boolean) || '';
      const kindName = Array.from(component.kindnrs)
        .map((kindnr) => kindNameByKindnr.get(kindnr))
        .find(Boolean) || '';
      const label = addressName
        ? `Familie ${addressName}`
        : kindName
          ? `Familie ${kindName}`
          : 'Familie (erzber)';
      const family = {
        id,
        label,
        source: 'erzber',
        adrnr: adrnrList,
        kindnrs: Array.from(component.kindnrs).sort((a, b) => Number(a) - Number(b)),
      };
      families.push(family);
      family.kindnrs.forEach((kindnr) => {
        kindnrToFamilyId[kindnr] = id;
      });
    });

  return { source: 'erzber', families, kindnrToFamilyId };
}

function buildHouseholdRelations({ kidsRaw }) {
  const byKey = new Map();
  (kidsRaw || []).forEach((kind) => {
    const key = getHouseholdKey(kind);
    if (!key) return;
    if (!byKey.has(key)) byKey.set(key, { kindnrs: [], label: String(kind?.NAME || '').trim() });
    byKey.get(key).kindnrs.push(String(kind?.KINDNR || '').trim());
  });

  const families = [];
  const kindnrToFamilyId = {};
  Array.from(byKey.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .forEach(([key, group]) => {
      const id = `fam-hh-${stableHash(key)}`;
      const family = {
        id,
        label: group.label ? `Familie ${group.label}` : 'Familie (Haushalt)',
        source: 'haushalt',
        adrnr: [],
        kindnrs: group.kindnrs,
      };
      families.push(family);
      family.kindnrs.forEach((kindnr) => {
        if (kindnr) kindnrToFamilyId[kindnr] = id;
      });
    });

  return { source: 'haushalt', families, kindnrToFamilyId };
}

/**
 * Baut Familien-/Geschwisterbeziehungen auf.
 *
 * @param {Object} params
 * @param {Array} [params.kidsRaw] - kind.xml-Datensätze
 * @param {Array} [params.erzberRaw] - erzber.xml-Datensätze (falls im Export)
 * @param {Array} [params.adressenRaw] - adressen.xml-Datensätze (falls im Export)
 * @returns {{ source: 'erzber'|'haushalt'|'none', families: Array, kindnrToFamilyId: Object }}
 */
export function buildFamilyRelations({ kidsRaw = [], erzberRaw = [], adressenRaw = [] } = {}) {
  if (Array.isArray(erzberRaw) && erzberRaw.length > 0) {
    return buildErzberRelations({ kidsRaw, erzberRaw, adressenRaw });
  }
  if (Array.isArray(kidsRaw) && kidsRaw.length > 0) {
    return buildHouseholdRelations({ kidsRaw });
  }
  return { source: 'none', families: [], kindnrToFamilyId: {} };
}

/**
 * Hängt die Familienzuordnung an die simData-Items an (nur demand = Kinder).
 * familyId/familyLabel/familySource überleben Save/Load, da sie Teil des Items sind.
 */
export function attachFamilyInfo(simDataList, relations) {
  if (!Array.isArray(simDataList) || !relations) return simDataList;
  const labelById = new Map(relations.families.map((family) => [family.id, family.label]));
  simDataList.forEach((item) => {
    if (!item) return;
    if (item.type !== 'demand') {
      item.familyId = '';
      item.familyLabel = '';
      item.familySource = '';
      return;
    }
    const kindnr = String(item?.rawdata?.KINDNR || '').trim();
    const familyId = relations.kindnrToFamilyId[kindnr] || '';
    item.familyId = familyId;
    item.familyLabel = familyId ? (labelById.get(familyId) || '') : '';
    item.familySource = familyId ? relations.source : '';
  });
  return simDataList;
}

/**
 * Alle Geschwister eines Kind-Items (dasselbe familyId, ohne das Item selbst),
 * sortiert nach Geburtsdatum (älteste zuerst).
 *
 * @param {Object} dataItems - { [itemId]: item } (overlay-aufgelöst)
 * @param {string} itemId - Store-Key des selektierten Items
 * @returns {Array} Geschwister-Items ({ id, ... })
 */
export function findFamilyMembers(dataItems, itemId) {
  if (!itemId) return [];
  const item = dataItems?.[itemId];
  if (!item || item.type !== 'demand' || !item.familyId) return [];
  return Object.entries(dataItems || {})
    .filter(([key, candidate]) => (
      candidate
      && candidate.type === 'demand'
      && candidate.familyId === item.familyId
      && key !== itemId
    ))
    .map(([key, candidate]) => ({ ...candidate, id: candidate.id || key }))
    .sort((a, b) => String(a.dateofbirth || '').localeCompare(String(b.dateofbirth || '')));
}
