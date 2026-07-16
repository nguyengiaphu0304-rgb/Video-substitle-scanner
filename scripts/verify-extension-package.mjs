import { readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { verifyPackage } from "./extension-package.mjs";

const root = process.cwd();
const manifest = JSON.parse(await readFile(path.join(root, "chrome-extension/manifest.json"), "utf8"));
const safeName = manifest.name.toLowerCase().replace(/[^a-z0-9.-]+/gu, "-").replace(/^-+|-+$/gu, "");
const archivePath = path.join(root, "dist", `${safeName}-v${manifest.version}.zip`);
const entries = await verifyPackage({ sourceDir: path.join(root, "chrome-extension"), archivePath });
const archive = await readFile(archivePath);
const expectedHash = createHash("sha256").update(archive).digest("hex");
const sidecar = await readFile(`${archivePath}.sha256`, "utf8");
if (sidecar !== `${expectedHash}  ${path.basename(archivePath)}\n`) throw new Error("SHA-256 sidecar is invalid.");
const packageManifest = JSON.parse(await readFile(`${archivePath}.manifest.json`, "utf8"));
if (packageManifest.sha256 !== expectedHash || packageManifest.bytes !== archive.length) {
  throw new Error("Package manifest integrity fields are invalid.");
}
if (JSON.stringify(packageManifest.entries) !== JSON.stringify(entries)) {
  throw new Error("Package manifest entry list is invalid.");
}
console.log(`Verified deterministic extension package with ${entries.length} files.`);
