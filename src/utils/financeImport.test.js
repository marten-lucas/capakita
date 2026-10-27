import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('xlsx', () => ({
  read: vi.fn(() => ({
    SheetNames: ['Foerdertabellen', 'Fördertabellen'],
    Sheets: {
      Fördertabellen: {
        B2: { v: 929.26 },
        C5: { v: 1.0 },
        E5: { v: 1.2 },
        G5: { v: 1.3 },
        I5: { v: 2.0 },
        K5: { v: 4.5 },
      },
    },
  })),
}));

import { buildDownloadCandidates, importBayKiBiGTableFromUrl } from './financeImport';

const STMAS_URL = 'https://www.stmas.bayern.de/imperia/md/content/stmas/stmas_inet/kinderbetreuung/3.7.2.2_kfa-131118.xls';

// XLS-Magic-Bytes (BIFF8): ohne sie gilt ein Kandidat als "keine Excel-Datei"
const XLS_BUFFER = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).buffer;

function okResponse(buffer = XLS_BUFFER) {
  return { ok: true, status: 200, arrayBuffer: async () => buffer };
}

describe('financeImport URL import (Fallback-Kette)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('nutzt den same-origin STMAS-Proxy als ersten Kandidaten', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    const result = await importBayKiBiGTableFromUrl(STMAS_URL, {
      applicationBaseUrl: new URL('http://localhost:4173/'),
      serverProxyAvailable: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4173/stmas-proxy/imperia/md/content/stmas/stmas_inet/kinderbetreuung/3.7.2.2_kfa-131118.xls'
    );
    expect(result.baseValue).toBe(929.26);
    expect(result.weightFactors).toEqual({
      regelkind_3to6: 1,
      schulkind: 1.2,
      migration: 1.3,
      under3: 2,
      disabled: 4.5,
    });
  });

  it('nutzt auf GitHub Pages die lokale Tabellenkopie vor Cross-Origin-Fallbacks', async () => {
    const pagesBase = new URL('https://marten-lucas.github.io/capakita/');
    const pagesOptions = { applicationBaseUrl: pagesBase, serverProxyAvailable: false };
    const candidates = buildDownloadCandidates(STMAS_URL, pagesOptions);
    expect(candidates[0]).toBe(`${pagesBase.href}reference/baykibig-foerdertabellen.xls`);
    expect(candidates[1]).toBe(STMAS_URL);

    const fetchMock = vi.fn().mockResolvedValueOnce(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    const result = await importBayKiBiGTableFromUrl(STMAS_URL, pagesOptions);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(`${pagesBase.href}reference/baykibig-foerdertabellen.xls`);
    expect(result.baseValue).toBe(929.26);
  });

  it('überspringt Kandidaten, die keine Excel-Datei liefern (z. B. HTML-Fehlerseite)', async () => {
    const htmlBuffer = new TextEncoder().encode('<html><body>404</body></html>').buffer;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: true, status: 200, arrayBuffer: async () => htmlBuffer })
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    const result = await importBayKiBiGTableFromUrl(STMAS_URL, {
      applicationBaseUrl: new URL('http://localhost:4173/'),
      serverProxyAvailable: true,
    });
    expect(result.baseValue).toBe(929.26);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('aggregiert alle Fehlversuche in der Fehlermeldung, wenn alles scheitert', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(importBayKiBiGTableFromUrl(STMAS_URL)).rejects.toThrow(/Download fehlgeschlagen/);
    await expect(importBayKiBiGTableFromUrl(STMAS_URL)).rejects.toThrow(/lokale Tabellenkopie/);
    await expect(importBayKiBiGTableFromUrl(STMAS_URL)).rejects.toThrow(/CORS-Proxy allorigins/);
    await expect(importBayKiBiGTableFromUrl(STMAS_URL)).rejects.toThrow(/Datei-Import/);
  });

  it('nutzt keinen Dev-Proxy für fremde URLs (direkt zuerst)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    await importBayKiBiGTableFromUrl('https://example.org/table.xls');

    expect(fetchMock.mock.calls[0][0]).toBe('https://example.org/table.xls');
  });
});
