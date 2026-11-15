// Fails the build when the installed @anticipate/contracts differs from packages/contracts.
// npm can install a `file:` dependency as a copy; a stale copy makes the UI reject valid backend replies
// ("INVALID_RESPONSE ... does not match CORE"). Run `npm ci` in static/hello-world to refresh it.
import { readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL("..", import.meta.url));
const source = realpathSync(join(here, "../../packages/contracts/src"));
const installed = realpathSync(
  join(here, "node_modules/@anticipate/contracts/src"),
);

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

if (source !== installed) {
  const stale = [];
  const want = files(source)
    .map((p) => relative(source, p))
    .sort();
  const have = new Set(files(installed).map((p) => relative(installed, p)));
  for (const f of want) {
    if (
      !have.has(f) ||
      readFileSync(join(source, f), "utf8") !==
        readFileSync(join(installed, f), "utf8")
    )
      stale.push(f);
  }
  if (stale.length) {
    console.error(
      `@anticipate/contracts in node_modules is out of date (${stale.join(", ")}).\n` +
        "Run `npm ci` in static/hello-world, then build again.",
    );
    process.exit(1);
  }
}
console.log("contracts in sync");
