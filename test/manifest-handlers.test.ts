/** Every manifest handler `index.<name>` must be exported by src/index.js (a missing export only fails at runtime on Forge). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('manifest handlers', () => {
  it('every index.<name> handler is exported by src/index.js', () => {
    const manifest = readFileSync(resolve(__dirname, '../manifest.yml'), 'utf8');
    const index = readFileSync(resolve(__dirname, '../src/index.js'), 'utf8');
    const handlers = [...manifest.matchAll(/handler:\s*index\.([A-Za-z0-9_]+)/g)].map((m) => m[1]!);
    expect(handlers.length).toBeGreaterThan(0);
    const exported = new Set([...index.matchAll(/export\s*\{([^}]*)\}/g)].flatMap((m) => m[1]!.split(',').map((x) => x.trim().split(/\s+as\s+/).pop()!)));
    expect(handlers.filter((h) => !exported.has(h))).toEqual([]);
  });
});
