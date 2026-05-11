const statusEl = document.getElementById("status");
const outputEl = document.getElementById("output");
const notesEl = document.getElementById("notes");
const extractButton = document.getElementById("extract");
const copyButton = document.getElementById("copy");
const downloadButton = document.getElementById("download");
const copyNotesButton = document.getElementById("copy-notes");
const downloadNotesButton = document.getElementById("download-notes");
const startScanButton = document.getElementById("start-scan");
const refreshScanButton = document.getElementById("refresh-scan");
const stopScanButton = document.getElementById("stop-scan");

function setStatus(message) {
  statusEl.textContent = message;
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function frameProbe() {
  const URL_HINT = /vtt|srt|ttml|caption|subtitle|texttrack|webvtt|m3u8/i;
  const BAD_URL_HINT = /metadata|timedmetadata|discontinuity|id3|emsg/i;
  const BAD_TEXT_HINT = /"metadataType"|discontinuity|DISCONTINUITY|"\s*PTS\s*"|^\s*\{[\s\S]*\}\s*$/i;

  function srtTime(seconds) {
    const ms = Math.max(0, Math.round(Number(seconds || 0) * 1000));
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms / 60000) % 60);
    const s = Math.floor((ms / 1000) % 60);
    const x = ms % 1000;
    return [h, m, s].map((value) => String(value).padStart(2, "0")).join(":") + "," + String(x).padStart(3, "0");
  }

  function cleanText(text) {
    const div = document.createElement("div");
    div.innerHTML = String(text || "");
    return (div.textContent || div.innerText || String(text || ""))
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .trim();
  }

  function cueText(cue) {
    if (typeof cue.getCueAsHTML === "function") {
      const fragment = cue.getCueAsHTML();
      const div = document.createElement("div");
      div.append(fragment.cloneNode(true));
      return cleanText(div.textContent || "");
    }

    return cleanText(cue.text);
  }

  function isHumanCaptionText(text) {
    const cleaned = cleanText(text);
    if (!cleaned || cleaned.length < 2 || BAD_TEXT_HINT.test(cleaned)) {
      return false;
    }

    const letters = cleaned.match(/[A-Za-z]/g) || [];
    if (letters.length < 3) {
      return false;
    }

    const jsonPunctuation = cleaned.match(/[{}":,]/g) || [];
    return jsonPunctuation.length / Math.max(cleaned.length, 1) < 0.18;
  }

  function toSrt(cues) {
    return cues
      .sort((left, right) => left.startTime - right.startTime || left.endTime - right.endTime)
      .map((cue, index) =>
        [
          String(index + 1),
          `${srtTime(cue.startTime)} --> ${srtTime(cue.endTime)}`,
          cue.text
        ].join("\n")
      )
      .join("\n\n");
  }

  function collectVideos(root = document) {
    const videos = Array.from(root.querySelectorAll?.("video") || []);
    const elements = Array.from(root.querySelectorAll?.("*") || []);
    for (const element of elements) {
      if (element.shadowRoot) {
        videos.push(...collectVideos(element.shadowRoot));
      }
    }

    return videos;
  }

  const cueMap = new Map();
  const videos = collectVideos();

  for (const video of videos) {
    for (const track of Array.from(video.textTracks || [])) {
      if (track.kind && !["captions", "subtitles"].includes(track.kind)) {
        continue;
      }

      try {
        track.mode = "hidden";
      } catch {}

      for (const cue of Array.from(track.cues || [])) {
        const text = cueText(cue);
        if (!isHumanCaptionText(text)) {
          continue;
        }

        const key = `${cue.startTime}|${cue.endTime}|${text}`;
        cueMap.set(key, {
          startTime: cue.startTime,
          endTime: cue.endTime,
          text
        });
      }
    }
  }

  const urls = [];
  for (const entry of performance.getEntriesByType("resource")) {
    if (URL_HINT.test(entry.name) && !BAD_URL_HINT.test(entry.name)) {
      urls.push(entry.name);
    }
  }

  for (const track of Array.from(document.querySelectorAll("track[src]"))) {
    if (!BAD_URL_HINT.test(track.src)) {
      urls.push(track.src);
    }
  }

  const html = document.documentElement?.innerHTML || "";
  const matches = html.match(/https?:\/\/[^"'<>\\\s]+/g) || [];
  for (const url of matches) {
    if (URL_HINT.test(url) && !BAD_URL_HINT.test(url)) {
      urls.push(url.replace(/&amp;/g, "&"));
    }
  }

  const cues = [...cueMap.values()];
  return {
    href: location.href,
    title: document.title,
    cueCount: cues.length,
    srt: cues.length > 0 ? toSrt(cues) : "",
    urls: [...new Set(urls)]
  };
}

function parseTimeToSeconds(value) {
  const text = String(value || "").trim().replace(",", ".");
  const parts = text.split(":");
  if (parts.length < 2 || parts.length > 3) {
    return null;
  }

  const secondsText = parts.pop();
  const minutesText = parts.pop();
  const hoursText = parts.pop() || "0";
  const seconds = Number(secondsText);
  const minutes = Number(minutesText);
  const hours = Number(hoursText);

  if (![hours, minutes, seconds].every(Number.isFinite)) {
    return null;
  }

  return hours * 3600 + minutes * 60 + seconds;
}

function srtTime(seconds) {
  const ms = Math.max(0, Math.round(Number(seconds || 0) * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms / 60000) % 60);
  const s = Math.floor((ms / 1000) % 60);
  const x = ms % 1000;
  return [h, m, s].map((value) => String(value).padStart(2, "0")).join(":") + "," + String(x).padStart(3, "0");
}

function stripTags(text) {
  return String(text || "")
    .replace(/<[^>]+>/g, "")
    .replace(/\u00a0/g, " ")
    .trim();
}

function isHumanCaptionText(text) {
  const cleaned = stripTags(text).replace(/\s+/g, " ");
  if (!cleaned || cleaned.length < 2) {
    return false;
  }

  if (/"metadataType"|discontinuity|DISCONTINUITY|"\s*PTS\s*"|^\s*\{[\s\S]*\}\s*$/i.test(cleaned)) {
    return false;
  }

  const letters = cleaned.match(/[A-Za-z]/g) || [];
  if (letters.length < 3) {
    return false;
  }

  const jsonPunctuation = cleaned.match(/[{}":,]/g) || [];
  return jsonPunctuation.length / Math.max(cleaned.length, 1) < 0.18;
}

function parseSrtCues(srt) {
  return String(srt || "")
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .flatMap((block) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      const timingIndex = lines.findIndex((line) => line.includes("-->"));
      if (timingIndex === -1) {
        return [];
      }

      const match = /^(.+?)\s+-->\s+(.+?)(?:\s|$)/.exec(lines[timingIndex]);
      if (!match) {
        return [];
      }

      const start = parseTimeToSeconds(match[1]);
      const end = parseTimeToSeconds(match[2]);
      const text = stripTags(lines.slice(timingIndex + 1).join(" "));
      if (start === null || end === null || !isHumanCaptionText(text)) {
        return [];
      }

      return [{ start, end, text }];
    });
}

function noteTime(seconds) {
  const rounded = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function normalizeSentence(text) {
  return String(text || "")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\([^)]*music[^)]*\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSentences(text) {
  const normalized = normalizeSentence(text);
  if (!normalized) {
    return [];
  }

  const sentences = normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
  return sentences.map((sentence) => sentence.trim()).filter((sentence) => sentence.length > 18);
}

function scoreSentence(sentence) {
  const lower = sentence.toLowerCase();
  const keywordScore = [
    "because",
    "important",
    "changed",
    "history",
    "territory",
    "community",
    "people",
    "city",
    "land",
    "rights",
    "colonial",
    "ancestors",
    "government",
    "development",
    "agreement",
    "impact"
  ].filter((word) => lower.includes(word)).length;
  const lengthScore = Math.min(3, Math.floor(sentence.length / 70));
  return keywordScore * 3 + lengthScore;
}

function uniqueSentences(sentences) {
  const seen = new Set();
  const result = [];

  for (const sentence of sentences) {
    const key = sentence.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(sentence);
  }

  return result;
}

function makeSectionNotes(cues, sectionMinutes = 5) {
  const sectionSeconds = sectionMinutes * 60;
  const sections = new Map();

  for (const cue of cues) {
    const sectionStart = Math.floor(cue.start / sectionSeconds) * sectionSeconds;
    const existing = sections.get(sectionStart) || [];
    existing.push(cue);
    sections.set(sectionStart, existing);
  }

  return [...sections.entries()].map(([start, sectionCues]) => {
    const end = sectionCues[sectionCues.length - 1]?.end || start + sectionSeconds;
    const allSentences = uniqueSentences(splitSentences(sectionCues.map((cue) => cue.text).join(" ")));
    const selected = allSentences
      .map((sentence) => ({ sentence, score: scoreSentence(sentence) }))
      .sort((left, right) => right.score - left.score)
      .slice(0, 5)
      .map((item) => item.sentence);

    const fallback = sectionCues
      .map((cue) => normalizeSentence(cue.text))
      .filter(Boolean)
      .slice(0, 5);

    return {
      start,
      end,
      bullets: selected.length > 0 ? selected : fallback
    };
  });
}

function generateNotesFromSrt(srt, title = "Video Notes") {
  const cues = parseSrtCues(srt);
  if (cues.length === 0) {
    return "";
  }

  const sections = makeSectionNotes(cues);
  const lines = [
    `# ${title}`,
    "",
    `Generated from ${cues.length} subtitle cues.`,
    "",
    "## Timestamped Notes"
  ];

  for (const section of sections) {
    lines.push("", `### ${noteTime(section.start)}-${noteTime(section.end)}`);
    for (const bullet of section.bullets) {
      lines.push(`- ${bullet}`);
    }
  }

  lines.push("", "## Full Timed Transcript");
  for (const cue of cues) {
    lines.push(`- [${noteTime(cue.start)}] ${cue.text}`);
  }

  return lines.join("\n");
}

function setExtractedSrt(srt, title = "Video Notes") {
  outputEl.value = srt;
  notesEl.value = generateNotesFromSrt(srt, title);
}

async function activeTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id || null;
}

function captionTextToSrt(text) {
  const trimmed = String(text || "").replace(/\r/g, "").trim();
  if (!trimmed) {
    return "";
  }

  if (/<tt[\s>]/i.test(trimmed)) {
    const doc = new DOMParser().parseFromString(trimmed, "text/xml");
    const paragraphs = Array.from(doc.querySelectorAll("p[begin][end]"));
    return paragraphs
      .map((node, index) => {
        const start = parseTimeToSeconds(node.getAttribute("begin"));
        const end = parseTimeToSeconds(node.getAttribute("end"));
        const textValue = stripTags(node.textContent || "");
        if (start === null || end === null || !isHumanCaptionText(textValue)) {
          return "";
        }

        return [String(index + 1), `${srtTime(start)} --> ${srtTime(end)}`, textValue].join("\n");
      })
      .filter(Boolean)
      .join("\n\n");
  }

  const blocks = trimmed
    .replace(/^WEBVTT[^\n]*(\n|$)/i, "")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  let index = 0;
  return blocks
    .map((block) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      const timingIndex = lines.findIndex((line) => line.includes("-->"));
      if (timingIndex === -1) {
        return "";
      }

      const match = /^(.+?)\s+-->\s+(.+?)(?:\s|$)/.exec(lines[timingIndex]);
      if (!match) {
        return "";
      }

      const start = parseTimeToSeconds(match[1]);
      const end = parseTimeToSeconds(match[2]);
      const cueText = stripTags(lines.slice(timingIndex + 1).join("\n"));
      if (start === null || end === null || !isHumanCaptionText(cueText)) {
        return "";
      }

      index += 1;
      return [String(index), `${srtTime(start)} --> ${srtTime(end)}`, cueText].join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

function renumberSrt(srt) {
  const blocks = String(srt || "")
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.includes("-->"));

  return blocks
    .map((block, index) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      const timingIndex = lines.findIndex((line) => line.includes("-->"));
      return [String(index + 1), lines[timingIndex], ...lines.slice(timingIndex + 1)].join("\n");
    })
    .join("\n\n");
}

function combineSrtTexts(texts) {
  return renumberSrt(texts.filter(Boolean).join("\n\n"));
}

async function extractCaptions() {
  setStatus("Looking inside the active tab...");
  outputEl.value = "";
  notesEl.value = "";

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setStatus("No active tab found.");
    return;
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    func: frameProbe
  });

  const frameResults = results.map((item) => item.result).filter(Boolean);
  const srtResults = frameResults.filter((result) => result.srt);
  if (srtResults.length > 0) {
    const srt = srtResults.map((result) => result.srt).join("\n\n");
    setExtractedSrt(srt, srtResults[0]?.title || "Video Notes");
    await navigator.clipboard.writeText(srt);
    setStatus(`Copied ${srtResults.reduce((sum, result) => sum + result.cueCount, 0)} loaded cues as SRT.`);
    return;
  }

  const urls = [...new Set(frameResults.flatMap((result) => result.urls || []))];
  if (urls.length === 0) {
    setStatus("No text tracks or caption URLs found. Turn on CC, play a few seconds, then try again.");
    return;
  }

  setStatus(`Found ${urls.length} possible caption resources. Fetching...`);
  const response = await chrome.runtime.sendMessage({
    type: "FETCH_CAPTION_CANDIDATES",
    urls
  });

  const captionText = response?.result?.text || "";
  const srt = captionTextToSrt(captionText);
  if (srt) {
    setExtractedSrt(srt, frameResults[0]?.title || "Video Notes");
    await navigator.clipboard.writeText(srt);
    setStatus("Copied captions from resource: " + (response.result.sourceUrl || "unknown"));
    return;
  }

  outputEl.value = urls.join("\n");
  await navigator.clipboard.writeText(outputEl.value);
  setStatus("No human captions found yet. Copied candidate URLs instead.");
}

async function startDeepScan() {
  const tabId = await activeTabId();
  if (!tabId) {
    setStatus("No active tab found.");
    return;
  }

  const response = await chrome.runtime.sendMessage({
    type: "START_DEEP_SCAN",
    tabId
  });

  if (!response?.ok) {
    setStatus("Deep scan failed: " + (response?.error || "unknown error"));
    return;
  }

  setStatus(response.result.message);
}

async function refreshDeepScan() {
  const tabId = await activeTabId();
  if (!tabId) {
    setStatus("No active tab found.");
    return;
  }

  const response = await chrome.runtime.sendMessage({
    type: "GET_DEEP_SCAN",
    tabId
  });
  const result = response?.result;

  if (!result?.attached) {
    setStatus("Deep scan is not running.");
  }

  const captions = result?.captions || [];
  if (captions.length > 0) {
    const srt = combineSrtTexts(captions.map((caption) => captionTextToSrt(caption.text)));
    if (srt) {
      setExtractedSrt(srt, "Video Notes");
      await navigator.clipboard.writeText(srt);
      setStatus(`Deep scan found ${captions.length} human caption resource${captions.length === 1 ? "" : "s"}.`);
      return;
    }
  }

  const candidates = result?.candidates || [];
  outputEl.value = candidates
    .map((item) => `${item.mimeType || "unknown"} ${item.url}`)
    .join("\n");
  setStatus(`Deep scan has ${candidates.length} candidates, but no human captions yet.`);
}

async function stopDeepScan() {
  const tabId = await activeTabId();
  if (!tabId) {
    setStatus("No active tab found.");
    return;
  }

  await chrome.runtime.sendMessage({
    type: "STOP_DEEP_SCAN",
    tabId
  });
  setStatus("Deep scan stopped.");
}

extractButton.addEventListener("click", () => {
  extractCaptions().catch((error) => {
    setStatus("Extraction failed: " + (error?.message || String(error)));
  });
});

copyButton.addEventListener("click", async () => {
  await navigator.clipboard.writeText(outputEl.value);
  setStatus("Copied output.");
});

downloadButton.addEventListener("click", () => {
  downloadText("knowledge-captions.srt", outputEl.value);
});

copyNotesButton.addEventListener("click", async () => {
  await navigator.clipboard.writeText(notesEl.value);
  setStatus("Copied notes.");
});

downloadNotesButton.addEventListener("click", () => {
  downloadText("knowledge-notes.md", notesEl.value);
});

startScanButton.addEventListener("click", () => {
  startDeepScan().catch((error) => setStatus("Deep scan failed: " + (error?.message || String(error))));
});

refreshScanButton.addEventListener("click", () => {
  refreshDeepScan().catch((error) => setStatus("Refresh failed: " + (error?.message || String(error))));
});

stopScanButton.addEventListener("click", () => {
  stopDeepScan().catch((error) => setStatus("Stop failed: " + (error?.message || String(error))));
});
