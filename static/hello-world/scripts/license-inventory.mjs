import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
const root = process.cwd();
const packageFile = JSON.parse(
  await readFile(join(root, "package.json"), "utf8"),
);
const lockText = await readFile(join(root, "package-lock.json"), "utf8");
const lock = JSON.parse(lockText);
const directNames = new Set([
  ...Object.keys(packageFile.dependencies),
  ...Object.keys(packageFile.devDependencies),
]);
const direct = [];
const runtime = [];
for (const [relative, entry] of Object.entries(lock.packages ?? {})) {
  if (!relative || !relative.includes("node_modules/")) continue;
  try {
    const folder = join(root, relative);
    const manifest = JSON.parse(
      await readFile(join(folder, "package.json"), "utf8"),
    );
    const names = (await readdir(folder)).filter((name) =>
      /^(licen[cs]e|copying|notice)(\.|$)/i.test(name),
    );
    const item = {
      name: manifest.name,
      version: manifest.version,
      license: manifest.license ?? "NOT_DECLARED",
      path: relative,
      licenseFiles: names,
      runtime: !entry.dev,
    };
    if (
      directNames.has(manifest.name) &&
      relative === `node_modules/${manifest.name}`
    )
      direct.push(item);
    if (!entry.dev) {
      const texts = [];
      for (const name of names) {
        try {
          texts.push(
            `FILE: ${name}\n${await readFile(join(folder, name), "utf8")}`,
          );
        } catch {}
      }
      runtime.push({
        item,
        text:
          texts.join("\n\n") ||
          "No root license text located. Review package and upstream terms before release.",
      });
    }
  } catch (error) {
    if (!entry.optional) throw error;
  }
}
const folder = resolve(root, "../../evidence/experience/v2-research");
await mkdir(folder, { recursive: true });
await mkdir(join(root, "public"), { recursive: true });
await writeFile(
  join(folder, "license-inventory-LOCAL.json"),
  JSON.stringify(
    {
      timestampUTC: new Date().toISOString(),
      lockSha256: createHash("sha256").update(lockText).digest("hex"),
      scope:
        "Installed direct dependencies and available non-dev package license files. Inventory only; not a legal/compliance certification. Custom Forge terms require owner review.",
      direct: direct.sort((a, b) => a.name.localeCompare(b.name)),
      runtimePackageCount: runtime.length,
      missingRuntimeLicenseText: runtime
        .filter((record) => record.item.licenseFiles.length === 0)
        .map((record) => record.item.name),
    },
    null,
    2,
  ),
);
await writeFile(
  join(root, "public/THIRD_PARTY_NOTICES.txt"),
  [
    "ANTICIPATE - third-party package notices",
    "Generated from installed runtime dependency license files. No legal acceptance or certification is implied.",
    "See package source/upstream terms for complete obligations.",
    ...runtime
      .sort((a, b) => a.item.name.localeCompare(b.item.name))
      .map(
        (record) =>
          `\n===== ${record.item.name}@${record.item.version} | ${typeof record.item.license === "string" ? record.item.license : JSON.stringify(record.item.license)} =====\n${record.text}`,
      ),
  ].join("\n\n"),
);
console.log(
  JSON.stringify({
    direct: direct.length,
    runtime: runtime.length,
    missingRuntimeLicenseText: runtime.filter(
      (record) => record.item.licenseFiles.length === 0,
    ).length,
  }),
);
