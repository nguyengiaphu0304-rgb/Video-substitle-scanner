import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export const ALLOWED_FILES = Object.freeze([
  "README.md",
  "background.js",
  "caption-core.js",
  "icons/icon16.png",
  "icons/icon32.png",
  "icons/icon48.png",
  "icons/icon128.png",
  "manifest.json",
  "popup.css",
  "popup.html",
  "popup.js",
]);

const REQUIRED_FILES = new Set(["manifest.json", "background.js", "caption-core.js", "popup.html"]);
const MAX_FILE_BYTES = 16 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;
const ZIP32_MAX = 0xffff_ffff;
const UTF8_FLAG = 0x0800;
const DOS_TIME = 0;
const DOS_DATE = 0x0021; // 1980-01-01, the earliest ZIP timestamp.
const UNIX_FILE_MODE = (0o100644 << 16) >>> 0;

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

export function crc32(buffer) {
  let crc = 0xffff_ffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffff_ffff) >>> 0;
}

function validateArchivePath(relativePath) {
  if (
    relativePath.length === 0 ||
    relativePath.startsWith("/") ||
    relativePath.includes("\\") ||
    relativePath.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new Error(`Unsafe archive path: ${relativePath}`);
  }
}

function unsigned32(value, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > ZIP32_MAX) {
    throw new Error(`${label} exceeds the ZIP32 limit.`);
  }
  return value;
}

export function createZipBuffer(entries) {
  const names = new Set();
  let localOffset = 0;
  const localParts = [];
  const centralParts = [];

  for (const entry of entries) {
    validateArchivePath(entry.path);
    if (names.has(entry.path)) throw new Error(`Duplicate archive path: ${entry.path}`);
    names.add(entry.path);

    const name = Buffer.from(entry.path, "utf8");
    const data = Buffer.from(entry.data);
    const checksum = crc32(data);
    unsigned32(data.length, `File ${entry.path}`);
    unsigned32(localOffset, "Archive offset");

    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(UTF8_FLAG, 6);
    local.writeUInt16LE(0, 8); // Stored: deterministic and dependency-free.
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);
    localParts.push(local, data);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4); // ZIP 2.0, created on Unix.
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(UTF8_FLAG, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(UNIX_FILE_MODE, 38);
    central.writeUInt32LE(localOffset, 42);
    name.copy(central, 46);
    centralParts.push(central);

    localOffset += local.length + data.length;
  }

  if (entries.length > 0xffff) throw new Error("Archive has too many entries for ZIP32.");
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(unsigned32(centralDirectory.length, "Central directory"), 12);
  end.writeUInt32LE(unsigned32(localOffset, "Central directory offset"), 16);
  end.writeUInt16LE(0, 20);

  const archive = Buffer.concat([...localParts, centralDirectory, end]);
  if (archive.length > MAX_ARCHIVE_BYTES) throw new Error("Extension archive exceeds 64 MiB.");
  return archive;
}

export function inspectZipBuffer(archive) {
  const endOffset = archive.length - 22;
  if (endOffset < 0 || archive.readUInt32LE(endOffset) !== 0x06054b50) {
    throw new Error("Archive does not have a valid ZIP32 end record.");
  }
  const entryCount = archive.readUInt16LE(endOffset + 10);
  const directorySize = archive.readUInt32LE(endOffset + 12);
  let cursor = archive.readUInt32LE(endOffset + 16);
  if (cursor + directorySize !== endOffset) throw new Error("Central directory bounds are invalid.");

  const entries = [];
  for (let index = 0; index < entryCount; index += 1) {
    if (archive.readUInt32LE(cursor) !== 0x02014b50) throw new Error("Invalid central directory entry.");
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    const relativePath = archive.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    validateArchivePath(relativePath);
    entries.push({
      path: relativePath,
      crc32: archive.readUInt32LE(cursor + 16).toString(16).padStart(8, "0"),
      size: archive.readUInt32LE(cursor + 24),
    });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  if (cursor !== endOffset) throw new Error("Central directory entry count is inconsistent.");
  return entries;
}

async function collectFiles(root) {
  const found = [];
  async function visit(directory, prefix = "") {
    const children = await readdir(directory, { withFileTypes: true });
    children.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const child of children) {
      const relativePath = prefix ? `${prefix}/${child.name}` : child.name;
      const absolutePath = path.join(directory, child.name);
      const details = await lstat(absolutePath);
      if (details.isSymbolicLink()) throw new Error(`Symlinks are not allowed: ${relativePath}`);
      if (details.isDirectory()) await visit(absolutePath, relativePath);
      else if (details.isFile()) found.push(relativePath);
      else throw new Error(`Unsupported filesystem entry: ${relativePath}`);
    }
  }
  await visit(root);
  return found.sort();
}

async function loadPackageEntries(sourceDir) {
  const found = await collectFiles(sourceDir);
  const unexpected = found.filter((file) => !ALLOWED_FILES.includes(file));
  const missing = ALLOWED_FILES.filter((file) => !found.includes(file));
  if (unexpected.length > 0) throw new Error(`Unexpected extension files: ${unexpected.join(", ")}`);
  if (missing.length > 0) throw new Error(`Missing extension files: ${missing.join(", ")}`);
  for (const required of REQUIRED_FILES) {
    if (!found.includes(required)) throw new Error(`Missing required extension file: ${required}`);
  }

  const entries = [];
  for (const relativePath of found) {
    const data = await readFile(path.join(sourceDir, ...relativePath.split("/")));
    if (data.length > MAX_FILE_BYTES) throw new Error(`Extension file exceeds 16 MiB: ${relativePath}`);
    entries.push({ path: relativePath, data });
  }
  return entries;
}

function parseManifest(entries) {
  const raw = entries.find((entry) => entry.path === "manifest.json")?.data;
  if (!raw) throw new Error("Extension manifest is missing.");
  const manifest = JSON.parse(raw.toString("utf8"));
  if (typeof manifest.name !== "string" || !manifest.name.trim()) throw new Error("Manifest name is invalid.");
  if (typeof manifest.version !== "string" || !/^\d+(?:\.\d+){0,3}$/u.test(manifest.version)) {
    throw new Error("Manifest version is invalid.");
  }
  const safeName = manifest.name.toLowerCase().replace(/[^a-z0-9.-]+/gu, "-").replace(/^-+|-+$/gu, "");
  if (!safeName) throw new Error("Manifest name cannot produce a safe archive name.");
  return { name: manifest.name, version: manifest.version, safeName };
}

async function atomicWrite(target, data) {
  const temporary = path.join(path.dirname(target), `.${path.basename(target)}.${process.pid}.tmp`);
  await writeFile(temporary, data, { flag: "wx" });
  try {
    await rename(temporary, target);
  } catch (error) {
    if (error.code !== "EEXIST" && error.code !== "EPERM") {
      await rm(temporary, { force: true });
      throw error;
    }
    // Windows cannot atomically replace an existing file with rename().
    await rm(target, { force: true });
    try {
      await rename(temporary, target);
    } catch (replacementError) {
      await rm(temporary, { force: true });
      throw replacementError;
    }
  }
}

export async function packageExtension({ sourceDir, outputDir }) {
  const entries = await loadPackageEntries(sourceDir);
  const manifest = parseManifest(entries);
  const archive = createZipBuffer(entries);
  const inspected = inspectZipBuffer(archive);
  const sha256 = createHash("sha256").update(archive).digest("hex");
  const archiveName = `${manifest.safeName}-v${manifest.version}.zip`;
  const packageManifest = {
    schemaVersion: 1,
    archive: archiveName,
    extension: { name: manifest.name, version: manifest.version },
    sha256,
    bytes: archive.length,
    entries: inspected,
  };

  await mkdir(outputDir, { recursive: true });
  const archivePath = path.join(outputDir, archiveName);
  await atomicWrite(archivePath, archive);
  await atomicWrite(`${archivePath}.sha256`, `${sha256}  ${archiveName}\n`);
  await atomicWrite(`${archivePath}.manifest.json`, `${JSON.stringify(packageManifest, null, 2)}\n`);
  return { archivePath, archive, packageManifest };
}

export async function verifyPackage({ sourceDir, archivePath }) {
  const entries = await loadPackageEntries(sourceDir);
  const expected = createZipBuffer(entries);
  const actual = await readFile(archivePath);
  if (!actual.equals(expected)) throw new Error("Archive bytes do not match the canonical extension package.");
  return inspectZipBuffer(actual);
}
