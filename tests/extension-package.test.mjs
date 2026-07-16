import assert from "node:assert/strict";
import { cp, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  ALLOWED_FILES,
  createZipBuffer,
  inspectZipBuffer,
  packageExtension,
  verifyPackage,
} from "../scripts/extension-package.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "subtitle-package-"));
  const sourceDir = path.join(root, "extension");
  await cp(path.join(projectRoot, "chrome-extension"), sourceDir, { recursive: true });
  return { root, sourceDir, outputDir: path.join(root, "dist") };
}

test("produces byte-for-byte reproducible, canonically ordered packages", async () => {
  const first = await fixture();
  const second = await fixture();
  const left = await packageExtension(first);
  const right = await packageExtension(second);
  const repeated = await packageExtension(first);
  assert.deepEqual(left.archive, right.archive);
  assert.deepEqual(left.archive, repeated.archive);
  assert.equal(left.packageManifest.sha256, right.packageManifest.sha256);
  assert.deepEqual(
    left.packageManifest.entries.map((entry) => entry.path),
    [...ALLOWED_FILES].sort(),
  );
  assert.deepEqual(inspectZipBuffer(left.archive), left.packageManifest.entries);
});

test("verifies the archive against current source bytes", async () => {
  const input = await fixture();
  const result = await packageExtension(input);
  assert.equal((await verifyPackage({ sourceDir: input.sourceDir, archivePath: result.archivePath })).length, 11);
  await writeFile(path.join(input.sourceDir, "popup.css"), "changed");
  await assert.rejects(
    verifyPackage({ sourceDir: input.sourceDir, archivePath: result.archivePath }),
    /do not match/u,
  );
});

test("rejects unexpected files, missing files and symlinks", async () => {
  const unexpected = await fixture();
  await writeFile(path.join(unexpected.sourceDir, "debug.log"), "secret");
  await assert.rejects(packageExtension(unexpected), /Unexpected extension files: debug\.log/u);

  const missing = await fixture();
  await rm(path.join(missing.sourceDir, "popup.js"));
  await assert.rejects(packageExtension(missing), /Missing extension files: popup\.js/u);

  const linked = await fixture();
  await symlink(path.join(linked.sourceDir, "popup.js"), path.join(linked.sourceDir, "linked.js"));
  await assert.rejects(packageExtension(linked), /Symlinks are not allowed/u);
});

test("rejects unsafe and duplicate archive paths", () => {
  assert.throws(() => createZipBuffer([{ path: "../escape", data: Buffer.alloc(0) }]), /Unsafe archive path/u);
  assert.throws(
    () => createZipBuffer([{ path: "same", data: Buffer.alloc(0) }, { path: "same", data: Buffer.alloc(0) }]),
    /Duplicate archive path/u,
  );
});
