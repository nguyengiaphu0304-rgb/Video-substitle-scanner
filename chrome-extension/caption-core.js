export const MAX_CAPTION_BYTES = 2 * 1024 * 1024;
export const MAX_CANDIDATE_URLS = 250;

export function originPattern(url) {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return "";
    }

    // Chrome match patterns do not include ports. Requesting the literal
    // URL origin would fall outside the optional host pattern in the manifest.
    return `${parsed.protocol}//${parsed.hostname}/*`;
  } catch {
    return "";
  }
}

export function uniqueOriginPatterns(urls) {
  return [...new Set(urls.map(originPattern).filter(Boolean))].slice(0, 20);
}

const BAD_TEXT_HINT =
  /"metadataType"|discontinuity|"\s*PTS\s*"|^\s*\{[\s\S]*\}\s*$/iu;
const UNICODE_LETTER_OR_NUMBER = /[\p{L}\p{N}]/gu;

export function stripTags(text) {
  return String(text ?? "")
    .replace(/<br\s*\/?>/giu, "\n")
    .replace(/<[^>]+>/gu, "")
    .replace(/&nbsp;|&#160;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/\u00a0/gu, " ")
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/[ \t]{2,}/gu, " ")
    .trim();
}

export function isHumanCaptionText(text) {
  const cleaned = stripTags(text).replace(/\s+/gu, " ");
  if (!cleaned || cleaned.length < 2 || BAD_TEXT_HINT.test(cleaned)) {
    return false;
  }

  const meaningfulCharacters = cleaned.match(UNICODE_LETTER_OR_NUMBER) ?? [];
  if (meaningfulCharacters.length < 1) {
    return false;
  }

  const jsonPunctuation = cleaned.match(/[{}":,]/gu) ?? [];
  return jsonPunctuation.length / cleaned.length < 0.18;
}

export function parseTimeToSeconds(value) {
  const text = String(value ?? "").trim().replace(",", ".");
  const offset = /^(\d+(?:\.\d+)?)(ms|h|m|s)$/u.exec(text);
  if (offset) {
    const amount = Number(offset[1]);
    const multiplier = { h: 3600, m: 60, s: 1, ms: 0.001 }[offset[2]];
    const seconds = amount * multiplier;
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
  }

  const parts = text.split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => part === "")) {
    return null;
  }

  const seconds = Number(parts.at(-1));
  const minutes = Number(parts.at(-2));
  const hours = parts.length === 3 ? Number(parts[0]) : 0;
  if (![hours, minutes, seconds].every(Number.isFinite)) {
    return null;
  }
  if (hours < 0 || minutes < 0 || seconds < 0 || seconds >= 60) {
    return null;
  }
  if (parts.length === 3 && minutes >= 60) {
    return null;
  }

  return hours * 3600 + minutes * 60 + seconds;
}

export function srtTime(seconds) {
  const milliseconds = Math.round(Number(seconds) * 1000);
  if (!Number.isFinite(milliseconds) || milliseconds < 0) {
    throw new TypeError("Caption time must be a non-negative finite number.");
  }

  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds / 60_000) % 60);
  const wholeSeconds = Math.floor((milliseconds / 1000) % 60);
  const remainder = milliseconds % 1000;
  return (
    [hours, minutes, wholeSeconds]
      .map((part) => String(part).padStart(2, "0"))
      .join(":") + `,${String(remainder).padStart(3, "0")}`
  );
}

function cue(startText, endText, text) {
  const start = parseTimeToSeconds(startText);
  const end = parseTimeToSeconds(endText);
  const cleaned = stripTags(text);
  if (start === null || end === null || end <= start || !isHumanCaptionText(cleaned)) {
    return null;
  }
  return { start, end, text: cleaned };
}

function parseBlockCues(input) {
  return String(input ?? "")
    .replace(/\r/gu, "")
    .replace(/^\uFEFF?WEBVTT[^\n]*(?:\n|$)/iu, "")
    .split(/\n{2,}/u)
    .flatMap((block) => {
      const lines = block
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const timingIndex = lines.findIndex((line) => line.includes("-->"));
      if (timingIndex === -1) {
        return [];
      }
      const match = /^(\S+)\s+-->\s+(\S+)/u.exec(lines[timingIndex]);
      if (!match) {
        return [];
      }
      const parsed = cue(match[1], match[2], lines.slice(timingIndex + 1).join("\n"));
      return parsed ? [parsed] : [];
    });
}

function parseTtmlCues(input) {
  return [...String(input ?? "").matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/giu)].flatMap(
    (match) => {
      const attributes = match[1];
      const begin = /\bbegin\s*=\s*["']([^"']+)["']/iu.exec(attributes)?.[1];
      const end = /\bend\s*=\s*["']([^"']+)["']/iu.exec(attributes)?.[1];
      if (!begin || !end) {
        return [];
      }
      const parsed = cue(begin, end, match[2]);
      return parsed ? [parsed] : [];
    },
  );
}

export function parseCaptionCues(input) {
  const text = String(input ?? "");
  if (!text || text.length > MAX_CAPTION_BYTES || BAD_TEXT_HINT.test(text.trim())) {
    return [];
  }

  const parsed = /<tt[\s>]/iu.test(text) ? parseTtmlCues(text) : parseBlockCues(text);
  const unique = new Map();
  for (const item of parsed) {
    unique.set(`${item.start}|${item.end}|${item.text}`, item);
  }
  return [...unique.values()].sort(
    (left, right) => left.start - right.start || left.end - right.end || left.text.localeCompare(right.text),
  );
}

export function captionTextToSrt(input) {
  return parseCaptionCues(input)
    .map((item, index) =>
      [String(index + 1), `${srtTime(item.start)} --> ${srtTime(item.end)}`, item.text].join("\n"),
    )
    .join("\n\n");
}

export function combineSrtTexts(texts) {
  const cues = texts.flatMap(parseCaptionCues);
  return captionTextToSrt(
    cues
      .map((item) => `${srtTime(item.start)} --> ${srtTime(item.end)}\n${item.text}`)
      .join("\n\n"),
  );
}

export function hasHumanCaptions(input) {
  return parseCaptionCues(input).length > 0;
}
