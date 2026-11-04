/** Every manifest handler `index.<name>` must be exported by src/index.js (a missing export only fails at runtime on Forge). */

describe('manifest handlers', () => {
  it('every index.<name> handler is exported by src/index.js', async () => {
    // node:fs via a non-literal specifier: the root tsconfig has no Node typings.
    const fsModule = 'node:' + 'fs';
    const { readFileSync } = (await import(fsModule)) as { readFileSync: (p: URL, enc: 'utf8') => string };
    const manifest = readFileSync(new URL('../manifest.yml', import.meta.url), 'utf8');
    const index = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
    const handlers = [...manifest.matchAll(/handler:\s*index\.([A-Za-z0-9_]+)/g)].map((m) => m[1]!);
    expect(handlers.length).toBeGreaterThan(0);
    const exported = new Set([...index.matchAll(/export\s*\{([^}]*)\}/g)].flatMap((m) => m[1]!.split(',').map((x: string) => x.trim().split(/\s+as\s+/).pop()!)));
    expect(handlers.filter((h) => !exported.has(h))).toEqual([]);
  });
});
