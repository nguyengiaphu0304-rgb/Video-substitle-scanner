import {
  MAX_CANDIDATE_URLS,
  MAX_CAPTION_BYTES,
  hasHumanCaptions
} from "./caption-core.js";

const CAPTION_HINT = /-->|WEBVTT|<tt[\s>]|<p\s/i;
const URL_HINT = /vtt|srt|ttml|caption|subtitle|texttrack|webvtt|m3u8/i;
const MIME_HINT = /vtt|srt|ttml|mpegurl|x-mpegurl|text|json|xml/i;
const BAD_URL_HINT = /metadata|timedmetadata|discontinuity|id3|emsg/i;
const scanByTab = new Map();

function absoluteUrl(baseUrl, value) {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return "";
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function targetKey(target) {
  return String(target.tabId || "");
}

function isCandidateResponse(url, mimeType) {
  if (!url || BAD_URL_HINT.test(url)) {
    return false;
  }

  return URL_HINT.test(url) || MIME_HINT.test(mimeType || "");
}

function decodeBody(body, base64Encoded) {
  const maximumEncodedLength = Math.ceil((MAX_CAPTION_BYTES * 4) / 3) + 4;
  if (String(body || "").length > (base64Encoded ? maximumEncodedLength : MAX_CAPTION_BYTES)) {
    return "";
  }
  if (!base64Encoded) {
    return body || "";
  }

  try {
    return atob(body || "");
  } catch {
    return "";
  }
}

function scanState(tabId) {
  const key = String(tabId);
  if (!scanByTab.has(key)) {
    scanByTab.set(key, {
      attached: false,
      candidates: [],
      captions: [],
      requestById: {}
    });
  }

  return scanByTab.get(key);
}

function uniqueByUrl(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item?.url || seen.has(item.url)) {
      return false;
    }

    seen.add(item.url);
    return true;
  });
}

function sendDebuggerCommand(target, method, params = {}) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand(target, method, params, (result) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve(result);
    });
  });
}

function attachDebugger(target) {
  return new Promise((resolve, reject) => {
    chrome.debugger.attach(target, "1.3", () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve();
    });
  });
}

function detachDebugger(target) {
  return new Promise((resolve) => {
    chrome.debugger.detach(target, () => resolve());
  });
}

async function startDeepScan(tabId) {
  const target = { tabId };
  const state = scanState(tabId);

  if (!state.attached) {
    await attachDebugger(target);
    state.attached = true;
  }

  state.candidates = [];
  state.captions = [];
  state.requestById = {};

  await sendDebuggerCommand(target, "Network.enable", {
    maxResourceBufferSize: 1024 * 1024 * 20,
    maxTotalBufferSize: 1024 * 1024 * 100
  });
  await sendDebuggerCommand(target, "Page.enable").catch(() => {});

  return {
    attached: true,
    message: "Advanced scan attached. Turn on captions, refresh or play the video, then click Refresh."
  };
}

async function stopDeepScan(tabId) {
  const target = { tabId };
  const state = scanState(tabId);

  if (state?.attached) {
    await detachDebugger(target);
  }

  scanByTab.delete(String(tabId));
  return { attached: false };
}

function debuggerTargets() {
  return new Promise((resolve, reject) => {
    chrome.debugger.getTargets((targets) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(targets || []);
    });
  });
}

async function getDeepScan(tabId) {
  const state = scanState(tabId);
  if (state.attached) {
    const targets = await debuggerTargets();
    state.attached = targets.some((target) => target.tabId === tabId && target.attached);
  }
  return {
    attached: state.attached,
    candidates: uniqueByUrl(state.candidates),
    captions: state.captions
  };
}

async function collectBody(target, requestId) {
  const state = scanByTab.get(targetKey(target));
  const request = state?.requestById?.[requestId];
  if (!state || !request || request.checked) {
    return;
  }

  request.checked = true;

  try {
    const result = await sendDebuggerCommand(target, "Network.getResponseBody", { requestId });
    const text = decodeBody(result.body, result.base64Encoded);
    if (!text) {
      return;
    }

    if (CAPTION_HINT.test(text) && hasHumanCaptions(text)) {
      state.captions.push({
        url: request.url,
        mimeType: request.mimeType,
        text
      });
      return;
    }

    if (/^#EXTM3U/m.test(text)) {
      const nested = parseManifestUrls(request.url, text).filter((url) => !BAD_URL_HINT.test(url));
      state.candidates.push(
        ...nested.map((url) => ({
          url,
          mimeType: "manifest-reference",
          source: request.url
        }))
      );
    }
  } catch {
    // Some streaming bodies are not available through the debugger API.
  }
}

chrome.debugger.onEvent.addListener((target, method, params) => {
  const state = scanByTab.get(targetKey(target));
  if (!state?.attached) {
    return;
  }

  if (method === "Network.responseReceived") {
    const response = params?.response || {};
    const url = response.url || "";
    const mimeType = response.mimeType || "";
    if (!isCandidateResponse(url, mimeType)) {
      return;
    }

    state.requestById[params.requestId] = {
      url,
      mimeType,
      checked: false
    };
    state.candidates.push({
      url,
      mimeType,
      status: response.status
    });
  }

  if (method === "Network.loadingFinished") {
    collectBody(target, params.requestId);
  }
});

chrome.debugger.onDetach.addListener((target) => {
  const state = scanByTab.get(targetKey(target));
  if (state) {
    state.attached = false;
  }
});

function parseManifestUrls(baseUrl, text) {
  const urls = [];
  const uriMatches = text.matchAll(/URI="([^"]+)"/g);
  for (const match of uriMatches) {
    urls.push(absoluteUrl(baseUrl, match[1]));
  }

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const url = absoluteUrl(baseUrl, trimmed);
    if (url && !BAD_URL_HINT.test(url)) {
      urls.push(url);
    }
  }

  return unique(urls);
}

function cleanCaptionSegment(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/^WEBVTT[^\n]*(\n|$)/i, "")
    .split("\n")
    .filter((line) => !/^X-TIMESTAMP-MAP=/i.test(line.trim()))
    .join("\n")
    .trim();
}

function combineCaptionSegments(segments) {
  const body = segments
    .map((segment) => cleanCaptionSegment(segment.text))
    .filter(Boolean)
    .join("\n\n");

  return body ? ["WEBVTT", "", body].join("\n") : "";
}

async function fetchText(url) {
  const response = await fetch(url, {
    credentials: "include",
    cache: "no-store"
  });

  if (!response.ok) {
    return "";
  }
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_CAPTION_BYTES) {
    return "";
  }

  if (!response.body) {
    const text = await response.text();
    return text.length <= MAX_CAPTION_BYTES ? text : "";
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let byteCount = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    byteCount += value.byteLength;
    if (byteCount > MAX_CAPTION_BYTES) {
      await reader.cancel();
      return "";
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

async function findCaptionText(urls) {
  const seen = new Set();
  const queue = unique(urls).filter((url) => !BAD_URL_HINT.test(url));
  const captionSegments = [];
  const completeCaptionFiles = [];

  while (queue.length > 0 && seen.size < MAX_CANDIDATE_URLS) {
    const url = queue.shift();
    if (!url || seen.has(url)) {
      continue;
    }

    seen.add(url);

    try {
      const text = await fetchText(url);
      if (!text) {
        continue;
      }

      if (CAPTION_HINT.test(text) && !/^#EXTM3U/m.test(text) && hasHumanCaptions(text)) {
        const item = { url, text };
        if (/seg|fragment|frag|part|_\d+|\/\d+\.|\.webvtt|\.vtt/i.test(url)) {
          captionSegments.push(item);
        } else {
          completeCaptionFiles.push(item);
        }
        continue;
      }

      if (/^#EXTM3U/m.test(text)) {
        queue.push(...parseManifestUrls(url, text));
      }
    } catch {
      // Keep trying other candidates.
    }
  }

  if (captionSegments.length > 0) {
    return {
      sourceUrl: `combined ${captionSegments.length} subtitle segments`,
      text: combineCaptionSegments(captionSegments)
    };
  }

  if (completeCaptionFiles.length > 0) {
    return completeCaptionFiles[0];
  }

  return null;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "FETCH_CAPTION_CANDIDATES") {
    findCaptionText(message.urls || [])
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));

    return true;
  }

  if (message?.type === "START_DEEP_SCAN") {
    startDeepScan(message.tabId)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));

    return true;
  }

  if (message?.type === "GET_DEEP_SCAN") {
    getDeepScan(message.tabId)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));

    return true;
  }

  if (message?.type === "STOP_DEEP_SCAN") {
    stopDeepScan(message.tabId)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));

    return true;
  }

  return false;
});
