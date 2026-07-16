import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { MAX_CAPTION_BYTES, parseCaptionCues } from "../chrome-extension/caption-core.js";

export const PERFORMANCE_BUDGET = Object.freeze({
  archiveBytes: 64 * 1024,
  executableJavaScriptBytes: 48 * 1024,
  fixtureCues: 25_000,
  parseMilliseconds: 2_000,
});

function timestamp(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":") + ".000";
}

export function createLargeCaptionFixture(cueCount = PERFORMANCE_BUDGET.fixtureCues) {
  if (!Number.isSafeInteger(cueCount) || cueCount < 1) {
    throw new TypeError("Fixture cue count must be a positive safe integer.");
  }
  const blocks = ["WEBVTT"];
  for (let index = 0; index < cueCount; index += 1) {
    const start = index * 2;
    blocks.push(
      `${timestamp(start)} --> ${timestamp(start + 1)}\nCaption ${index} — 你好 — phụ đề`,
    );
  }
  const fixture = blocks.join("\n\n");
  if (fixture.length > MAX_CAPTION_BYTES) {
    throw new RangeError("Generated fixture exceeds the parser input limit.");
  }
  return fixture;
}

export function enforceByteBudget(label, actual, limit) {
  if (!Number.isSafeInteger(actual) || actual < 0 || !Number.isSafeInteger(limit) || limit < 0) {
    throw new TypeError("Byte budgets require non-negative safe integers.");
  }
  if (actual > limit) throw new Error(`${label} is ${actual} bytes; budget is ${limit} bytes.`);
}

export async function measureArtifactSizes({ sourceDir, archivePath }) {
  const archiveBytes = (await stat(archivePath)).size;
  const names = (await readdir(sourceDir)).filter((name) => name.endsWith(".js")).sort();
  let executableJavaScriptBytes = 0;
  for (const name of names) executableJavaScriptBytes += (await stat(path.join(sourceDir, name))).size;
  return { archiveBytes, executableJavaScriptBytes, executableJavaScriptFiles: names };
}

async function findSingleArchive(outputDirectory) {
  const archives = (await readdir(outputDirectory)).filter((name) => name.endsWith(".zip")).sort();
  if (archives.length !== 1) {
    throw new Error(`Expected exactly one extension ZIP in ${outputDirectory}; found ${archives.length}.`);
  }
  return path.join(outputDirectory, archives[0]);
}

export async function checkPerformanceBudget({
  sourceDir = path.resolve("chrome-extension"),
  archivePath,
  outputDirectory = path.resolve("dist"),
  outputPath = path.resolve("dist/performance-report.json"),
  budget = PERFORMANCE_BUDGET,
  clock = () => performance.now(),
} = {}) {
  const fixture = createLargeCaptionFixture(budget.fixtureCues);
  parseCaptionCues("WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nWarm up");
  const started = clock();
  const cues = parseCaptionCues(fixture);
  const parseMilliseconds = clock() - started;

  if (cues.length !== budget.fixtureCues) {
    throw new Error(`Expected ${budget.fixtureCues} cues, parsed ${cues.length}.`);
  }
  if (cues[0]?.text !== "Caption 0 — 你好 — phụ đề") {
    throw new Error("Large fixture lost its first multilingual caption.");
  }
  if (cues.at(-1)?.text !== `Caption ${budget.fixtureCues - 1} — 你好 — phụ đề`) {
    throw new Error("Large fixture output is incomplete or incorrectly ordered.");
  }
  if (!Number.isFinite(parseMilliseconds) || parseMilliseconds < 0) {
    throw new Error("Parser duration is not a valid non-negative measurement.");
  }
  if (parseMilliseconds > budget.parseMilliseconds) {
    throw new Error(
      `Large fixture parse took ${parseMilliseconds.toFixed(3)} ms; budget is ${budget.parseMilliseconds} ms.`,
    );
  }

  const resolvedArchivePath = archivePath ?? (await findSingleArchive(outputDirectory));
  const sizes = await measureArtifactSizes({ sourceDir, archivePath: resolvedArchivePath });
  enforceByteBudget("Extension archive", sizes.archiveBytes, budget.archiveBytes);
  enforceByteBudget(
    "Executable JavaScript",
    sizes.executableJavaScriptBytes,
    budget.executableJavaScriptBytes,
  );

  const report = {
    schema: "video-subtitle-scanner-performance/v1",
    runtime: { node: process.version, platform: process.platform, architecture: process.arch },
    fixture: { characters: fixture.length, bytes: Buffer.byteLength(fixture), cues: cues.length },
    parser: {
      measuredMilliseconds: Number(parseMilliseconds.toFixed(3)),
      budgetMilliseconds: budget.parseMilliseconds,
    },
    artifacts: {
      archiveBytes: sizes.archiveBytes,
      archiveBudgetBytes: budget.archiveBytes,
      executableJavaScriptBytes: sizes.executableJavaScriptBytes,
      executableJavaScriptBudgetBytes: budget.executableJavaScriptBytes,
      executableJavaScriptFiles: sizes.executableJavaScriptFiles,
    },
  };
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const report = await checkPerformanceBudget();
  console.log(
    `Performance budgets passed: ${report.fixture.cues} cues in ${report.parser.measuredMilliseconds} ms; ` +
      `${report.artifacts.archiveBytes} archive bytes.`,
  );
}
