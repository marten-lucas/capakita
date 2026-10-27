import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_URL = 'https://www.stmas.bayern.de/imperia/md/content/stmas/stmas_inet/kinderbetreuung/3.7.2.2_kfa-131118.xls';
const TARGET_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/reference/baykibig-foerdertabellen.xls');

const response = await fetch(SOURCE_URL, { signal: AbortSignal.timeout(30_000) });
if (!response.ok) throw new Error(`STMAS lieferte HTTP ${response.status}`);

const bytes = new Uint8Array(await response.arrayBuffer());
const isXls = bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
const isXlsx = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
if ((!isXls && !isXlsx) || bytes.length < 1024) {
  throw new Error('STMAS-Antwort ist keine gültige XLS/XLSX-Datei; vorhandene Tabellenkopie bleibt unverändert.');
}

await mkdir(path.dirname(TARGET_PATH), { recursive: true });
await writeFile(TARGET_PATH, bytes);
console.log(`STMAS-Tabelle aktualisiert: ${TARGET_PATH} (${bytes.length} Bytes)`);
