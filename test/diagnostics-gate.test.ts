/// <reference types="vite/client" />

import mainSrc from '../src/main.ts?raw';
import indexSrc from '../src/index.js?raw';
import manifestSrc from '../manifest.yml?raw';
import diagnosticsSrc from '../src/diagnostics.ts?raw';

vi.mock('@forge/api', () => ({ default: {}, route: () => '' }));
vi.mock('@forge/kvs', () => ({ kvs: {} }));

import * as main from '../src/main';

describe('diagnostics gate (TOP1 security)', () => {
  it('does not export diagnostics/seedDemo from the Forge entry (runtime)', () => {
    const exports = main as unknown as Record<string, unknown>;
    expect('diagnostics' in exports).toBe(false);
    expect('seedDemo' in exports).toBe(false);
  });

  it('keeps the public Forge surface intact', () => {
    const exports = main as unknown as Record<string, unknown>;
    for (const k of ['handler', 'rovoGetGraph', 'rovoSimulateRetirement', 'rovoSimulateUpgrade',
      'rovoGetPassport', 'rovoCheckFreshness', 'rovoSimulateSlip', 'validateTransition']) {
      expect(k in exports, `missing export ${k}`).toBe(true);
    }
  });

  it('has no diagnostics/seedDemo/getText wiring in entry sources', () => {
    // Static gate justification: resolver.getDefinitions() returns an opaque
    // DefinitionsHandler function (private resolver keys), so the legacy getText
    // resolver key cannot be enumerated at runtime; index.js re-exports are plain
    // text. Static source inspection is the reliable gate for both.
    expect(mainSrc).not.toMatch(/diagnostics|seedDemo/);
    expect(mainSrc).not.toMatch(/getText/);
    expect(indexSrc).not.toMatch(/diagnostics|seedDemo/);
  });

  it('manifest.yml references no diagnostics/seedDemo/getText', () => {
    expect(manifestSrc).not.toMatch(/diagnostics|seedDemo/);
    expect(manifestSrc).not.toMatch(/getText/);
  });

  it('diagnostics.ts stays dev-only with a production guard (non-exported)', async () => {
    expect(diagnosticsSrc).toMatch(/dev-only/i);
    vi.stubEnv('NODE_ENV', 'production');
    try {
      const diag = await import('../src/diagnostics');
      await expect(diag.diagnostics()).rejects.toThrow(/dev-only|production/i);
      await expect(diag.seedDemo()).rejects.toThrow(/dev-only|production/i);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
