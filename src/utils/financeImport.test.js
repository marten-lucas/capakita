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

import { importBayKiBiGTableFromUrl } from './financeImport';

describe('financeImport URL import', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('uses stmas proxy path for official STMAS URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await importBayKiBiGTableFromUrl(
      'https://www.stmas.bayern.de/imperia/md/content/stmas/stmas_inet/kinderbetreuung/3.7.2.2_kfa-131118.xls'
    );

    expect(fetchMock).toHaveBeenCalledWith(
      '/stmas-proxy/imperia/md/content/stmas/stmas_inet/kinderbetreuung/3.7.2.2_kfa-131118.xls'
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

  it('returns a clear error message for network/cors failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('NetworkError when attempting to fetch resource.')));

    await expect(
      importBayKiBiGTableFromUrl(
        'https://www.stmas.bayern.de/imperia/md/content/stmas/stmas_inet/kinderbetreuung/3.7.2.2_kfa-131118.xls'
      )
    ).rejects.toThrow('Download fehlgeschlagen (Network/CORS). Bitte pruefe die URL oder nutze den Datei-Import.');
  });
});
