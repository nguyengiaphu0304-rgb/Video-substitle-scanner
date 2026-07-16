import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("chrome-extension");
const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));

assert.equal(manifest.manifest_version, 3, "Only Manifest V3 packages are accepted.");
assert.ok(!manifest.permissions.includes("debugger"), "debugger must not be mandatory.");
assert.ok(manifest.optional_permissions.includes("debugger"), "Advanced Scan needs optional debugger access.");
assert.equal(manifest.background.type, "module", "Shared parser requires a module service worker.");

const requiredFiles = [
  manifest.background.service_worker,
  manifest.action.default_popup,
  "caption-core.js",
  "popup.js",
  "popup.css",
];
for (const relativePath of requiredFiles) {
  await access(path.join(root, relativePath));
}

const coreSize = (await stat(path.join(root, "caption-core.js"))).size;
assert.ok(coreSize <= 32 * 1024, "Shared parser exceeds its 32 KiB source budget.");

console.log(`Validated Manifest V3 package with ${requiredFiles.length} required files.`);
