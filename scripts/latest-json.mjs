// Writes the updater manifest (latest.json) for a GitHub release from the assets already
// attached to it: each installer's download URL plus the contents of its .sig file.
//
//   node scripts/latest-json.mjs v0.2.0 Textic/dyno-music latest.json
//
// The release workflow runs this once, after every build has uploaded its files. Letting each
// build update latest.json itself made parallel builds race and fail.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [tag, repo, out = "latest.json"] = process.argv.slice(2);
if (!tag || !repo) {
  console.error("Usage: node scripts/latest-json.mjs <tag> <owner/repo> [out]");
  process.exit(1);
}

const gh = (...args) => execFileSync("gh", args, { encoding: "utf8" });

const release = JSON.parse(gh("release", "view", tag, "--repo", repo, "--json", "assets,body"));
const sigDir = mkdtempSync(join(tmpdir(), "dyno-sigs-"));
gh("release", "download", tag, "--repo", repo, "--pattern", "*.sig", "--dir", sigDir);

/** Updater platform keys and the installer each one gets (matched on the asset name). */
const PLATFORMS = {
  "windows-x86_64-nsis": /x64-setup\.exe$/,
  "windows-x86_64-msi": /x64.*\.msi$/,
  "darwin-aarch64-app": /aarch64\.app\.tar\.gz$/,
  "darwin-x86_64-app": /x64\.app\.tar\.gz$/,
  "linux-x86_64-appimage": /amd64\.AppImage$/,
  "linux-x86_64-deb": /amd64\.deb$/,
  "linux-x86_64-rpm": /x86_64\.rpm$/,
};
/** Copies older updaters look for when they don't know which installer was used. */
const FALLBACKS = {
  "windows-x86_64": "windows-x86_64-msi",
  "darwin-aarch64": "darwin-aarch64-app",
  "darwin-x86_64": "darwin-x86_64-app",
  "linux-x86_64": "linux-x86_64-appimage",
};

const platforms = {};
for (const [key, pattern] of Object.entries(PLATFORMS)) {
  const asset = release.assets.find((a) => pattern.test(a.name));
  if (!asset) {
    console.warn(`No installer for ${key}`);
    continue;
  }
  let signature;
  try {
    signature = readFileSync(join(sigDir, `${asset.name}.sig`), "utf8").trim();
  } catch {
    console.warn(`No signature for ${asset.name}; ${key} left out`);
    continue;
  }
  // While the release is a draft, its assets' own URLs point at an "untagged-…" path that stops
  // working once it is published; the tag's download URL works from then on.
  const url = `https://github.com/${repo}/releases/download/${tag}/${encodeURIComponent(asset.name)}`;
  platforms[key] = { signature, url };
}
for (const [key, source] of Object.entries(FALLBACKS)) {
  if (platforms[source]) platforms[key] = platforms[source];
}

if (!Object.keys(platforms).length) {
  console.error("No signed installers found in the release");
  process.exit(1);
}

const manifest = {
  version: tag.replace(/^v/, ""),
  notes: release.body ?? "",
  pub_date: new Date().toISOString(),
  platforms,
};
writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`${out}: ${Object.keys(platforms).length} platform entries for ${manifest.version}`);
