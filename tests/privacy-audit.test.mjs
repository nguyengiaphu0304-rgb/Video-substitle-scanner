import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { auditPrivacy, inspectExecutableSource } from "../scripts/privacy-audit.mjs";

async function fixture(overrides = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "subtitle-privacy-"));
  const extension = path.join(root, "chrome-extension");
  await mkdir(extension);
  const manifest = {
    manifest_version: 3,
    version: "1.0.0",
    permissions: ["activeTab", "clipboardWrite", "scripting"],
    optional_permissions: ["debugger"],
    optional_host_permissions: ["https://*/*", "http://*/*"],
    ...overrides.manifest,
  };
  await writeFile(path.join(root, "package.json"), JSON.stringify({ version: "1.0.0" }));
  await writeFile(path.join(extension, "manifest.json"), JSON.stringify(manifest));
  await writeFile(
    path.join(extension, "background.js"),
    overrides.background ?? "export async function load(url) { return fetch(url, { cache: 'no-store' }); }",
  );
  await writeFile(path.join(extension, "caption-core.js"), overrides.core ?? "export const parse = () => [];" );
  await writeFile(path.join(extension, "popup.js"), overrides.popup ?? "export const render = () => {};" );
  return root;
}

test("production extension passes and leaves manual checks pending", async () => {
  const outputPath = path.join(os.tmpdir(), `privacy-${process.pid}.json`);
  const secondOutputPath = path.join(os.tmpdir(), `privacy-${process.pid}-second.json`);
  const report = await auditPrivacy({ projectRoot: path.resolve("."), outputPath });
  await auditPrivacy({ projectRoot: path.resolve("."), outputPath: secondOutputPath });
  assert.equal(report.version, "1.0.0");
  assert.deepEqual(new Set(Object.values(report.manualChecks)), new Set(["pending"]));
  assert.equal(report.network.dynamicFetchCalls, 1);
  assert.deepEqual(JSON.parse(await readFile(outputPath, "utf8")), report);
  assert.equal(await readFile(outputPath, "utf8"), await readFile(secondOutputPath, "utf8"));
});

test("required debugger permission fails closed", async () => {
  const root = await fixture({
    manifest: { permissions: ["activeTab", "clipboardWrite", "debugger", "scripting"] },
  });
  await assert.rejects(auditPrivacy({ projectRoot: root }), /Required permissions drifted/u);
});

test("mandatory broad host access fails closed", async () => {
  const root = await fixture({ manifest: { host_permissions: ["https://*/*"] } });
  await assert.rejects(auditPrivacy({ projectRoot: root }), /Broad host access must remain optional/u);
});

test("permission expansion and removal fail closed", async () => {
  const expanded = await fixture({
    manifest: { optional_permissions: ["debugger", "tabs"] },
  });
  await assert.rejects(auditPrivacy({ projectRoot: expanded }), /Optional permissions drifted/u);

  const removed = await fixture({ manifest: { permissions: ["activeTab", "scripting"] } });
  await assert.rejects(auditPrivacy({ projectRoot: removed }), /Required permissions drifted/u);
});

test("remote code primitives and hard-coded endpoints are reported", () => {
  const source = "new WebSocket('https://analytics.invalid/socket'); eval('code');";
  const result = inspectExecutableSource("background.js", source);
  assert.deepEqual(result.findings, [
    "background.js: forbidden eval",
    "background.js: forbidden WebSocket",
    "background.js: hard-coded network endpoint",
  ]);
});

test("unexpected fetch locations fail closed", async () => {
  const root = await fixture({ popup: "export const load = (url) => fetch(url);" });
  await assert.rejects(auditPrivacy({ projectRoot: root }), /Expected one dynamic caption-resource fetch/u);
});
