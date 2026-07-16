import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const POLICY = Object.freeze({
  requiredPermissions: ["activeTab", "clipboardWrite", "scripting"],
  optionalPermissions: ["debugger"],
  optionalHostPermissions: ["http://*/*", "https://*/*"],
  executableFiles: ["background.js", "caption-core.js", "popup.js"],
});

const FORBIDDEN_SOURCE_PATTERNS = Object.freeze([
  ["eval", /\beval\s*\(/u],
  ["Function constructor", /\bnew\s+Function\s*\(/u],
  ["importScripts", /\bimportScripts\s*\(/u],
  ["XMLHttpRequest", /\bXMLHttpRequest\b/u],
  ["WebSocket", /\bWebSocket\s*\(/u],
  ["EventSource", /\bEventSource\s*\(/u],
  ["sendBeacon", /\bsendBeacon\s*\(/u],
]);

function sortedStrings(value, label) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new TypeError(`${label} must be an array of strings.`);
  }
  return [...value].sort();
}

function assertExact(actual, expected, label) {
  const left = sortedStrings(actual, label);
  const right = [...expected].sort();
  if (JSON.stringify(left) !== JSON.stringify(right)) {
    throw new Error(`${label} drifted: expected ${right.join(", ")}; received ${left.join(", ")}.`);
  }
  return left;
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

export function inspectExecutableSource(file, source) {
  const findings = [];
  for (const [label, pattern] of FORBIDDEN_SOURCE_PATTERNS) {
    if (pattern.test(source)) findings.push(`${file}: forbidden ${label}`);
  }
  if (/['"`]https?:\/\//u.test(source)) {
    findings.push(`${file}: hard-coded network endpoint`);
  }
  return {
    file,
    bytes: Buffer.byteLength(source),
    sha256: sha256(source),
    fetchCalls: [...source.matchAll(/\bfetch\s*\(/gu)].length,
    findings,
  };
}

export async function auditPrivacy({
  projectRoot = path.resolve("."),
  outputPath = path.resolve("dist/privacy-report.json"),
} = {}) {
  const extensionRoot = path.join(projectRoot, "chrome-extension");
  const manifest = JSON.parse(await readFile(path.join(extensionRoot, "manifest.json"), "utf8"));
  const packageJson = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8"));

  if (manifest.version !== packageJson.version) {
    throw new Error(`Version mismatch: manifest ${manifest.version}; package ${packageJson.version}.`);
  }
  if (manifest.version !== "1.0.0") {
    throw new Error(`Release candidate must be version 1.0.0; received ${manifest.version}.`);
  }

  const requiredPermissions = assertExact(
    manifest.permissions,
    POLICY.requiredPermissions,
    "Required permissions",
  );
  const optionalPermissions = assertExact(
    manifest.optional_permissions,
    POLICY.optionalPermissions,
    "Optional permissions",
  );
  const optionalHostPermissions = assertExact(
    manifest.optional_host_permissions,
    POLICY.optionalHostPermissions,
    "Optional host permissions",
  );
  const requiredHostPermissions = sortedStrings(manifest.host_permissions, "Required host permissions");
  if (requiredHostPermissions.length > 0) {
    throw new Error("Broad host access must remain optional.");
  }

  const sources = [];
  for (const file of POLICY.executableFiles) {
    const source = await readFile(path.join(extensionRoot, file), "utf8");
    sources.push(inspectExecutableSource(file, source));
  }
  const findings = sources.flatMap((entry) => entry.findings);
  if (findings.length > 0) throw new Error(`Privacy audit failed: ${findings.join("; ")}.`);

  const totalFetchCalls = sources.reduce((sum, entry) => sum + entry.fetchCalls, 0);
  const backgroundSource = await readFile(path.join(extensionRoot, "background.js"), "utf8");
  if (totalFetchCalls !== 1 || !/\bfetch\s*\(\s*url\s*,/u.test(backgroundSource)) {
    throw new Error("Expected one dynamic caption-resource fetch in background.js.");
  }

  const report = {
    schema: "video-subtitle-scanner-privacy/v1",
    status: "pass",
    version: manifest.version,
    permissions: {
      required: requiredPermissions,
      requiredHosts: requiredHostPermissions,
      optional: optionalPermissions,
      optionalHosts: optionalHostPermissions,
    },
    network: {
      dynamicFetchCalls: totalFetchCalls,
      allowedPurpose: "Fetch caption resources discovered from the active tab during Advanced Scan.",
      constraint:
        "The user must start Advanced Scan and grant optional origin access; no fixed developer or analytics endpoint is present in executable extension code.",
    },
    executableSources: sources.map((entry) => ({
      file: entry.file,
      bytes: entry.bytes,
      sha256: entry.sha256,
      fetchCalls: entry.fetchCalls,
    })),
    manualChecks: {
      chromePermissionPrompt: "pending",
      privacyReview: "pending",
      screenReader: "pending",
      zoomAndReflow200Percent: "pending",
    },
    limitations: [
      "Static source inspection does not replace a manual browser privacy review.",
      "Origin providers may observe normal request metadata when caption resources are fetched.",
    ],
  };

  if (Object.values(report.manualChecks).some((status) => status !== "pending")) {
    throw new Error("Automated evidence cannot complete manual release checks.");
  }
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const report = await auditPrivacy();
  console.log(
    `Privacy audit passed for v${report.version}: ${report.executableSources.length} files, ` +
      `${report.network.dynamicFetchCalls} constrained fetch call.`,
  );
}
