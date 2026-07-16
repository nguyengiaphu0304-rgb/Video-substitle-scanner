import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  checkPerformanceBudget,
  createLargeCaptionFixture,
  enforceByteBudget,
  measureArtifactSizes,
} from "../scripts/check-performance-budget.mjs";

async function artifactFixture({ archiveBytes = 10, scriptBytes = 10 } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "subtitle-budget-"));
  const sourceDir = path.join(root, "extension");
  const archivePath = path.join(root, "dist", "extension.zip");
  await mkdir(sourceDir, { recursive: true });
  await mkdir(path.dirname(archivePath), { recursive: true });
  await writeFile(path.join(sourceDir, "core.js"), Buffer.alloc(scriptBytes));
  await writeFile(path.join(sourceDir, "styles.css"), Buffer.alloc(100));
  await writeFile(archivePath, Buffer.alloc(archiveBytes));
  return { root, sourceDir, archivePath, outputPath: path.join(root, "report.json") };
}

test("creates a deterministic multilingual fixture below the parser limit", () => {
  const first = createLargeCaptionFixture(3);
  assert.equal(first, createLargeCaptionFixture(3));
  assert.match(first, /Caption 2 — 你好 — phụ đề/u);
  assert.throws(() => createLargeCaptionFixture(0), /positive safe integer/u);
  assert.throws(() => createLargeCaptionFixture(100_000), /exceeds the parser input limit/u);
});

test("accepts an exact byte boundary and rejects a one-byte overrun", () => {
  assert.doesNotThrow(() => enforceByteBudget("Artifact", 64, 64));
  assert.throws(() => enforceByteBudget("Artifact", 65, 64), /65 bytes; budget is 64 bytes/u);
  assert.throws(() => enforceByteBudget("Artifact", -1, 64), /non-negative safe integers/u);
});

test("counts executable JavaScript only and fails when artifacts are missing", async () => {
  const input = await artifactFixture({ archiveBytes: 12, scriptBytes: 7 });
  assert.deepEqual(await measureArtifactSizes(input), {
    archiveBytes: 12,
    executableJavaScriptBytes: 7,
    executableJavaScriptFiles: ["core.js"],
  });
  await assert.rejects(
    measureArtifactSizes({ ...input, archivePath: path.join(input.root, "missing.zip") }),
    /ENOENT/u,
  );
});

test("writes a machine-readable report with injected deterministic timing", async () => {
  const input = await artifactFixture();
  const ticks = [100, 125];
  const report = await checkPerformanceBudget({
    ...input,
    budget: { archiveBytes: 10, executableJavaScriptBytes: 10, fixtureCues: 3, parseMilliseconds: 25 },
    clock: () => ticks.shift(),
  });
  assert.equal(report.parser.measuredMilliseconds, 25);
  assert.equal(report.fixture.cues, 3);
  assert.equal(report.artifacts.archiveBytes, 10);
  assert.deepEqual(JSON.parse(await readFile(input.outputPath, "utf8")), report);
});

test("discovers one versioned ZIP and rejects ambiguous package output", async () => {
  const input = await artifactFixture();
  const ticks = [0, 1];
  const report = await checkPerformanceBudget({
    sourceDir: input.sourceDir,
    outputDirectory: path.dirname(input.archivePath),
    outputPath: input.outputPath,
    budget: { archiveBytes: 10, executableJavaScriptBytes: 10, fixtureCues: 1, parseMilliseconds: 25 },
    clock: () => ticks.shift(),
  });
  assert.equal(report.artifacts.archiveBytes, 10);
  await writeFile(path.join(input.root, "dist", "second.zip"), Buffer.alloc(1));
  const moreTicks = [0, 1];
  await assert.rejects(
    checkPerformanceBudget({
      sourceDir: input.sourceDir,
      outputDirectory: path.dirname(input.archivePath),
      outputPath: input.outputPath,
      budget: { archiveBytes: 10, executableJavaScriptBytes: 10, fixtureCues: 1, parseMilliseconds: 25 },
      clock: () => moreTicks.shift(),
    }),
    /Expected exactly one extension ZIP/u,
  );
});

test("fails closed when duration or an artifact exceeds its budget", async () => {
  const input = await artifactFixture({ archiveBytes: 11, scriptBytes: 10 });
  const slowTicks = [0, 26];
  await assert.rejects(
    checkPerformanceBudget({
      ...input,
      budget: { archiveBytes: 11, executableJavaScriptBytes: 10, fixtureCues: 2, parseMilliseconds: 25 },
      clock: () => slowTicks.shift(),
    }),
    /budget is 25 ms/u,
  );

  const fastTicks = [0, 1];
  await assert.rejects(
    checkPerformanceBudget({
      ...input,
      budget: { archiveBytes: 10, executableJavaScriptBytes: 10, fixtureCues: 2, parseMilliseconds: 25 },
      clock: () => fastTicks.shift(),
    }),
    /Extension archive is 11 bytes/u,
  );
});
