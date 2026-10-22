// Builds the zip parents download: the contents of extension/ with manifest.json at the top level.
//   npm run package   ->   dist/parentvue-better-assignment-view-<version>.zip
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { zipSync } from "fflate";

const root = fileURLToPath(new URL("..", import.meta.url));

/** Every file under `dir` as a zip entry name (forward slashes), without dotfiles. */
function listFiles(dir, prefix = "") {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listFiles(full, `${prefix}${name}/`));
    else out.push(prefix + name);
  }
  return out;
}

/**
 * @param {string} extensionDir  the folder that holds manifest.json
 * @returns {{ name: string, bytes: Uint8Array, entries: string[] }}
 */
export function buildZip(extensionDir) {
  const manifest = JSON.parse(readFileSync(join(extensionDir, "manifest.json"), "utf8"));
  const entries = listFiles(extensionDir).sort((a, b) =>
    a === "manifest.json" ? -1 : b === "manifest.json" ? 1 : a.localeCompare(b),
  );
  const files = {};
  for (const entry of entries) {
    files[entry] = [
      new Uint8Array(readFileSync(join(extensionDir, entry))),
      { mtime: new Date("2026-01-01T00:00:00Z") },
    ];
  }
  return {
    name: `parentvue-better-assignment-view-${manifest.version}.zip`,
    bytes: zipSync(files, { level: 9 }),
    entries,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { name, bytes, entries } = buildZip(join(root, "extension"));
  mkdirSync(join(root, "dist"), { recursive: true });
  writeFileSync(join(root, "dist", name), bytes);
  console.log(`dist/${name}: ${entries.length} files, ${bytes.length} bytes`);
}
