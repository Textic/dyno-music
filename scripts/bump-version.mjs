// Sets the app version everywhere it is written down, and prints the new version.
//
//   node scripts/bump-version.mjs patch   0.1.0 -> 0.1.1
//   node scripts/bump-version.mjs minor   0.1.0 -> 0.2.0
//   node scripts/bump-version.mjs major   0.1.0 -> 1.0.0
//   node scripts/bump-version.mjs 1.2.3   exactly that
//
// tauri.conf.json is the source of truth; the release workflow runs this on merges to main.

import { readFileSync, writeFileSync } from "node:fs";

const files = {
  tauriConf: "src-tauri/tauri.conf.json",
  packageJson: "package.json",
  packageLock: "package-lock.json",
  cargoToml: "src-tauri/Cargo.toml",
  cargoLock: "src-tauri/Cargo.lock",
};

const read = (path) => readFileSync(path, "utf8");
const write = (path, text) => writeFileSync(path, text);

const current = JSON.parse(read(files.tauriConf)).version;
const [major, minor, patch] = current.split(".").map(Number);
const arg = process.argv[2] ?? "patch";
const next =
  arg === "major" ? `${major + 1}.0.0`
  : arg === "minor" ? `${major}.${minor + 1}.0`
  : arg === "patch" ? `${major}.${minor}.${patch + 1}`
  : arg;
if (!/^\d+\.\d+\.\d+$/.test(next)) {
  console.error(`Not a version: ${arg}`);
  process.exit(1);
}

// JSON files: only the version fields change, formatting is kept.
const setJsonVersion = (text) => text.replace(/("version":\s*")[^"]+(")/, `$1${next}$2`);
write(files.tauriConf, setJsonVersion(read(files.tauriConf)));
write(files.packageJson, setJsonVersion(read(files.packageJson)));
// package-lock.json repeats it at the top and for the root package ("packages" -> "").
write(
  files.packageLock,
  read(files.packageLock)
    .replace(/^(\s*"version":\s*")[^"]+(")/m, `$1${next}$2`)
    .replace(/("packages":\s*\{\s*"":\s*\{[^}]*?"version":\s*")[^"]+(")/, `$1${next}$2`),
);
// Cargo: the [package] version, and this crate's entry in the lock file.
write(files.cargoToml, read(files.cargoToml).replace(/^version = "[^"]+"/m, `version = "${next}"`));
write(
  files.cargoLock,
  read(files.cargoLock).replace(/(name = "dyno-music"\r?\nversion = ")[^"]+(")/, `$1${next}$2`),
);

console.log(next);
