import { describe, it, expect } from 'vitest';

// Guards jury-facing copy against manifest drift: the number of MCP tools named in the UI and the
// submission documents must match the tools declared under rovo:mcp in manifest.yml.
// Root typecheck runs without Node typings: reach fs through process.getBuiltinModule (Node >= 22.3).
declare const process: { cwd(): string; getBuiltinModule(id: 'fs'): { readFileSync(p: string, enc: 'utf8'): string } };
const { readFileSync } = process.getBuiltinModule('fs');
const root = process.cwd();
const read = (p: string) => readFileSync(`${root}/${p}`, 'utf8');
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

function declaredTools(): string[] {
  const m = read('manifest.yml').replace(/\r\n/g, '\n'); // CRLF checkouts (Windows) must parse like CI's LF ones
  const block = m.split(/\n  rovo:mcp:\n/)[1]?.split(/\n  [a-z]/)[0] ?? '';
  const tools = block.split(/\n\s+tools:\n/)[1] ?? '';
  return [...tools.matchAll(/^\s+- (anticipate-[a-z-]+)\s*$/gm)].map((x) => x[1] ?? "");
}

describe('MCP tool count in jury-facing copy', () => {
  const n = declaredTools().length;
  it('manifest declares at least one MCP tool', () => { expect(n).toBeGreaterThan(0); });
  for (const file of ['static/hello-world/src/features/Settings.tsx', 'docs/submission/TECHNICAL_SECTION.md', 'docs/submission/EXPERIENCE_SECTION.md', 'docs/submission/DEVPOST_DRAFT.md', 'docs/submission/VIDEO_SCRIPT.md']) {
    it(`${file} states ${n} read-only tools`, () => {
      const text = read(file);
      const stated = [...text.matchAll(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten) read-only (?:MCP )?tools\b/gi)].map((x) => WORDS.indexOf((x[1] ?? "").toLowerCase()));
      expect(stated.length).toBeGreaterThan(0);
      for (const s of stated) expect(s).toBe(n);
    });
  }
  // Free-form copy ("Six tools that never write", "seven MCP tools"): every count stated near
  // MCP/rovo:mcp in current-facing docs must equal the manifest. Gallery captions describe
  // already-rendered images and the checklist is a change log, so they are excluded.
  for (const file of ['README.md', 'docs/submission/DEVPOST_FINAL.md']) {
    it(`${file} free-form MCP tool counts equal ${n}`, () => {
      const lines = read(file).split('\n').filter((l) => /mcp/i.test(l));
      const stated = lines.flatMap((l) => [...l.matchAll(/\b(one|two|three|four|five|six|seven|eight|nine|ten) (?:MCP |read-only )?tools\b/gi)])
        .map((x) => WORDS.indexOf((x[1] ?? '').toLowerCase()));
      expect(stated.length).toBeGreaterThan(0);
      for (const s of stated) expect(s).toBe(n);
    });
  }
});
