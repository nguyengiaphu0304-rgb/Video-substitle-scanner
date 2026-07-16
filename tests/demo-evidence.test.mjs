import assert from "node:assert/strict";
import { cp, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { generateDemoEvidence, verifyDemoEvidence } from "../scripts/demo-evidence.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "subtitle-demo-"));
  await mkdir(path.join(root, "chrome-extension"), { recursive: true });
  await mkdir(path.join(root, "docs/demo"), { recursive: true });
  await cp(
    path.join(projectRoot, "chrome-extension/caption-core.js"),
    path.join(root, "chrome-extension/caption-core.js"),
  );
  await cp(path.join(projectRoot, "docs/demo/captions.vtt"), path.join(root, "docs/demo/captions.vtt"));
  return root;
}

test("generates deterministic multilingual evidence from the production parser", async () => {
  const root = await fixture();
  const first = await generateDemoEvidence(root);
  const output = await readFile(path.join(root, "docs/demo/expected.srt"), "utf8");
  const initialManifest = await readFile(path.join(root, "docs/demo/evidence.json"));
  const second = await generateDemoEvidence(root);
  const repeatedManifest = await readFile(path.join(root, "docs/demo/evidence.json"));

  assert.deepEqual(first, second);
  assert.deepEqual(initialManifest, repeatedManifest);
  assert.equal(first.output.cues, 3);
  assert.match(output, /Xin chào 世界 & welcome/u);
  assert.match(output, /مرحبا بالعالم/u);
  assert.doesNotMatch(output, /reversed cue/u);
  assert.equal((output.match(/Xin chào/gu) ?? []).length, 1);
});

test("verifies committed evidence byte for byte", async () => {
  const root = await fixture();
  await generateDemoEvidence(root);
  const evidence = await verifyDemoEvidence(root);
  assert.equal(evidence.schema, "video-subtitle-scanner-demo/v1");
  assert.equal(evidence.source.synthetic, true);
  assert.equal(evidence.source.license, "MIT");
});

test("rejects stale output, lineage drift and missing evidence", async () => {
  const staleOutput = await fixture();
  await generateDemoEvidence(staleOutput);
  await writeFile(path.join(staleOutput, "docs/demo/expected.srt"), "stale\n");
  await assert.rejects(verifyDemoEvidence(staleOutput), /does not match the production parser output/u);

  const staleManifest = await fixture();
  await generateDemoEvidence(staleManifest);
  const manifestPath = path.join(staleManifest, "docs/demo/evidence.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.extra = true;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await assert.rejects(verifyDemoEvidence(staleManifest), /does not match source, parser and output lineage/u);

  const missing = await fixture();
  await assert.rejects(verifyDemoEvidence(missing), /ENOENT/u);
});
