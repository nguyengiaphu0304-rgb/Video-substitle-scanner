import type { CaptureExportKind, CaptureSession, Cue } from "@/modules/subtitle-capture/types";
import { formatEditableTimecode, formatSrtTimecode } from "@/modules/subtitle-capture/time";

function singleLine(text: string): string {
  return text.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
}

function escapeCsv(text: string): string {
  return `"${text.replace(/"/g, "\"\"")}"`;
}

function escapeMarkdown(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\r?\n/g, "<br />");
}

export function sortCues(cues: Cue[]): Cue[] {
  return [...cues].sort((left, right) => {
    if (left.startMs !== right.startMs) {
      return left.startMs - right.startMs;
    }

    if (left.endMs !== right.endMs) {
      return left.endMs - right.endMs;
    }

    return left.text.localeCompare(right.text);
  });
}

export function buildSrt(session: CaptureSession): string {
  return sortCues(session.cues)
    .map((cue, index) => {
      return [
        `${index + 1}`,
        `${formatSrtTimecode(cue.startMs)} --> ${formatSrtTimecode(cue.endMs)}`,
        cue.text.trim(),
      ].join("\n");
    })
    .join("\n\n");
}

export function buildVtt(session: CaptureSession): string {
  const body = sortCues(session.cues)
    .map((cue) => {
      return [
        `${formatEditableTimecode(cue.startMs)} --> ${formatEditableTimecode(cue.endMs)}`,
        cue.text.trim(),
      ].join("\n");
    })
    .join("\n\n");

  return ["WEBVTT", session.title ? `NOTE ${session.title}` : "", body].filter(Boolean).join("\n\n");
}

export function buildCsv(session: CaptureSession): string {
  const header = "index,start,end,text,note";
  const rows = sortCues(session.cues).map((cue, index) =>
    [
      `${index + 1}`,
      escapeCsv(formatEditableTimecode(cue.startMs)),
      escapeCsv(formatEditableTimecode(cue.endMs)),
      escapeCsv(singleLine(cue.text)),
      escapeCsv(singleLine(cue.note)),
    ].join(","),
  );

  return [header, ...rows].join("\r\n");
}

export function buildMarkdown(session: CaptureSession): string {
  const header = [
    `# ${session.title || "Untitled capture"}`,
    "",
    session.sourceUrl ? `Source: ${session.sourceUrl}` : "",
    "",
    "| # | Start | End | Text | Note |",
    "| --- | --- | --- | --- | --- |",
  ].filter(Boolean);

  const rows = sortCues(session.cues).map((cue, index) =>
    [
      "|",
      `${index + 1}`,
      "|",
      formatEditableTimecode(cue.startMs),
      "|",
      formatEditableTimecode(cue.endMs),
      "|",
      escapeMarkdown(cue.text),
      "|",
      escapeMarkdown(cue.note),
      "|",
    ].join(" "),
  );

  return [...header, ...rows].join("\n");
}

export function buildJson(session: CaptureSession): string {
  return JSON.stringify(
    {
      title: session.title,
      sourceUrl: session.sourceUrl,
      cues: sortCues(session.cues),
    },
    null,
    2,
  );
}

export function buildExport(kind: CaptureExportKind, session: CaptureSession): string {
  switch (kind) {
    case "csv":
      return buildCsv(session);
    case "markdown":
      return buildMarkdown(session);
    case "json":
      return buildJson(session);
    case "vtt":
      return buildVtt(session);
    case "srt":
    default:
      return buildSrt(session);
  }
}
