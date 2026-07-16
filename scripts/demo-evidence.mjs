import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { captionTextToSrt, parseCaptionCues } from "../chrome-extension/caption-core.js";

const SCHEMA = "video-subtitle-scanner-demo/v1";
const SOURCE = "docs/demo/captions.vtt";
const OUTPUT = "docs/demo/expected.srt";
const MANIFEST = "docs/demo/evidence.json";
const PARSER = "chrome-extension/caption-core.js";

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

async function expectedEvidence(projectRoot) {
  const source = await readFile(path.join(projectRoot, SOURCE));
  const parser = await readFile(path.join(projectRoot, PARSER));
  const output = Buffer.from(`${captionTextToSrt(source.toString("utf8"))}\n`, "utf8");
  const cueCount = parseCaptionCues(source.toString("utf8")).length;
  if (cueCount < 1) throw new Error("Demo fixture must contain at least one valid caption.");

  const manifest = {
    schema: SCHEMA,
    command: "npm run demo:generate",
    source: {
      path: SOURCE,
      sha256: sha256(source),
      bytes: source.length,
      license: "MIT",
      synthetic: true,
    },
    parser: { path: PARSER, sha256: sha256(parser) },
    output: { path: OUTPUT, sha256: sha256(output), bytes: output.length, cues: cueCount },
    limitations: [
      "Fixture evidence does not prove compatibility with every video provider.",
      "Fixture evidence contains no audio, DRM content, private media or network retrieval.",
    ],
  };
  return { output, manifest: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8") };
}

export async function generateDemoEvidence(projectRoot = path.resolve(".")) {
  const expected = await expectedEvidence(projectRoot);
  await mkdir(path.join(projectRoot, "docs/demo"), { recursive: true });
  await writeFile(path.join(projectRoot, OUTPUT), expected.output);
  await writeFile(path.join(projectRoot, MANIFEST), expected.manifest);
  return JSON.parse(expected.manifest.toString("utf8"));
}

export async function verifyDemoEvidence(projectRoot = path.resolve(".")) {
  const expected = await expectedEvidence(projectRoot);
  const [actualOutput, actualManifest] = await Promise.all([
    readFile(path.join(projectRoot, OUTPUT)),
    readFile(path.join(projectRoot, MANIFEST)),
  ]);
  if (!actualOutput.equals(expected.output)) {
    throw new Error("Committed demo SRT does not match the production parser output.");
  }
  if (!actualManifest.equals(expected.manifest)) {
    throw new Error("Committed demo manifest does not match source, parser and output lineage.");
  }
  return JSON.parse(actualManifest.toString("utf8"));
}

const action = process.argv[2];
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  if (action === "generate") {
    const evidence = await generateDemoEvidence();
    console.log(`Generated ${evidence.output.cues} synthetic cues with verified lineage.`);
  } else if (action === "verify") {
    const evidence = await verifyDemoEvidence();
    console.log(`Verified ${evidence.output.cues} synthetic cues and SHA-256 lineage.`);
  } else {
    throw new Error("Usage: node scripts/demo-evidence.mjs <generate|verify>");
  }
}
