import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

import { NextResponse } from "next/server";

export const runtime = "nodejs";

type CapturePayload = {
  imageDataUrl?: unknown;
  sourceUrl?: unknown;
  timecode?: unknown;
  title?: unknown;
  captureMode?: unknown;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function safeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9-]+/g, "-").replace(/(^-|-$)/g, "") || "frame";
}

export async function POST(request: Request) {
  const payload = (await request.json()) as CapturePayload;
  const imageDataUrl = asString(payload.imageDataUrl);
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(imageDataUrl);

  if (!match) {
    return NextResponse.json({ error: "PNG image data is required" }, { status: 400 });
  }

  const captureDir = path.join(process.cwd(), "screen-captures");
  const capturedAt = new Date().toISOString();
  const timecode = asString(payload.timecode);
  const frameName = `${safeName(timecode)}-${Date.now()}`;
  const imagePath = path.join(captureDir, `${frameName}.png`);
  const metadataPath = path.join(captureDir, `${frameName}.json`);
  const latestImagePath = path.join(captureDir, "latest-frame.png");
  const latestMetadataPath = path.join(captureDir, "latest-frame.json");
  const manifestPath = path.join(captureDir, "manifest.json");
  const metadata = {
    capturedAt,
    sourceUrl: asString(payload.sourceUrl),
    timecode,
    title: asString(payload.title),
    captureMode: asString(payload.captureMode) || "single",
    imagePath,
    metadataPath,
  };

  await mkdir(captureDir, { recursive: true });
  const imageBuffer = Buffer.from(match[1], "base64");
  await writeFile(imagePath, imageBuffer);
  await writeFile(latestImagePath, imageBuffer);
  await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  await writeFile(latestMetadataPath, JSON.stringify(metadata, null, 2));

  const previousManifest = await readFile(manifestPath, "utf8")
    .then((content) => JSON.parse(content) as unknown)
    .catch(() => []);
  const manifest = Array.isArray(previousManifest) ? previousManifest : [];
  manifest.push(metadata);
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  return NextResponse.json({
    imagePath,
    metadataPath,
    manifestPath,
    metadata,
  });
}
