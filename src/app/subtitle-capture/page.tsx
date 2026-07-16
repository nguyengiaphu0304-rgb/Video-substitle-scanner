"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { buildExport, sortCues } from "@/modules/subtitle-capture/export";
import { formatEditableTimecode, parseTimecode } from "@/modules/subtitle-capture/time";
import type {
  CaptureExportKind,
  CaptureSession,
  Cue,
} from "@/modules/subtitle-capture/types";

const STORAGE_KEY = "video-subtitle-scanner:subtitle-capture:v1";
const DEFAULT_SOURCE_URL = "";
const DEFAULT_TITLE = "Untitled subtitle project";
const EXTRACT_SCRIPT = `(async () => {
  const video = document.querySelector("video");
  const srtTime = (seconds) => {
    const ms = Math.max(0, Math.round(seconds * 1000));
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms / 60000) % 60);
    const s = Math.floor((ms / 1000) % 60);
    const x = ms % 1000;
    return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":") + "," + String(x).padStart(3, "0");
  };
  const clean = (text) => text.replace(/<[^>]+>/g, "").replace(/\\s+\\n/g, "\\n").trim();
  const toSrt = (cues) => cues.map((cue, index) => [
    index + 1,
    srtTime(cue.startTime) + " --> " + srtTime(cue.endTime),
    clean(cue.text)
  ].join("\\n")).join("\\n\\n");

  const tracks = video ? Array.from(video.textTracks) : [];
  for (const track of tracks) {
    track.mode = "hidden";
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const loadedCues = tracks.flatMap((track) => Array.from(track.cues || []));
  if (loadedCues.length > 0) {
    copy(toSrt(loadedCues));
    console.log("Copied " + loadedCues.length + " subtitle cues as SRT.");
    return;
  }

  const candidates = performance.getEntriesByType("resource")
    .map((entry) => entry.name)
    .filter((url) => /vtt|srt|ttml|caption|subtitle|texttrack|webvtt/i.test(url));

  for (const url of candidates) {
    try {
      const text = await fetch(url, { credentials: "include" }).then((response) => response.ok ? response.text() : "");
      if (/-->|WEBVTT/i.test(text)) {
        copy(text);
        console.log("Copied captions from:", url);
        return;
      }
    } catch {}
  }

  copy(candidates.join("\\n"));
  console.log("No loaded subtitle cues found. Copied candidate caption URLs instead.", candidates);
})();`;

type ClockSource = "manual" | "video";
type MediaMode = "source" | "local" | "mirror";

type DraftCue = {
  start: string;
  end: string;
  text: string;
  note: string;
};

type PersistedState = {
  title: string;
  sourceUrl: string;
  cues: Cue[];
  draft: DraftCue;
  baseElapsedMs: number;
  filterText: string;
  exportKind: CaptureExportKind;
  clockSource: ClockSource;
  mediaMode: MediaMode;
  manualClockRate: number;
};

function defaultDraft(timecode = "00:00:00.000"): DraftCue {
  return {
    start: timecode,
    end: timecode,
    text: "",
    note: "",
  };
}

function createCueId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `cue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clampMs(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value));
}

function asCueArray(value: unknown): Cue[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const candidate = item as Partial<Cue>;
    if (
      typeof candidate.id !== "string" ||
      typeof candidate.startMs !== "number" ||
      typeof candidate.endMs !== "number" ||
      typeof candidate.text !== "string"
    ) {
      return [];
    }

    return [
      {
        id: candidate.id,
        startMs: clampMs(candidate.startMs),
        endMs: clampMs(candidate.endMs),
        text: candidate.text,
        note: typeof candidate.note === "string" ? candidate.note : "",
      },
    ];
  });
}

function isExportKind(value: unknown): value is CaptureExportKind {
  return value === "csv" || value === "markdown" || value === "json" || value === "srt" || value === "vtt";
}

function parsePersistedState(raw: string | null): PersistedState | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      title: typeof parsed.title === "string" ? parsed.title : DEFAULT_TITLE,
      sourceUrl: typeof parsed.sourceUrl === "string" ? parsed.sourceUrl : DEFAULT_SOURCE_URL,
      cues: asCueArray(parsed.cues),
      draft:
        parsed.draft &&
        typeof parsed.draft.start === "string" &&
        typeof parsed.draft.end === "string" &&
        typeof parsed.draft.text === "string" &&
        typeof parsed.draft.note === "string"
          ? parsed.draft
          : defaultDraft(),
      baseElapsedMs:
        typeof parsed.baseElapsedMs === "number" && Number.isFinite(parsed.baseElapsedMs)
          ? clampMs(parsed.baseElapsedMs)
          : 0,
      filterText: typeof parsed.filterText === "string" ? parsed.filterText : "",
      exportKind: isExportKind(parsed.exportKind) ? parsed.exportKind : "srt",
      clockSource: parsed.clockSource === "video" ? "video" : "manual",
      mediaMode:
        parsed.mediaMode === "local" || parsed.mediaMode === "mirror" ? parsed.mediaMode : "source",
      manualClockRate:
        typeof parsed.manualClockRate === "number" && Number.isFinite(parsed.manualClockRate)
          ? Math.min(4, Math.max(0.25, parsed.manualClockRate))
          : 1,
    };
  } catch {
    return null;
  }
}

function slugifyTitle(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return slug || "subtitle-capture";
}

function getCueIssue(cue: Cue, index: number, cues: Cue[]): string {
  if (cue.endMs <= cue.startMs) {
    return "Duration";
  }

  const previousCue = cues[index - 1];
  if (previousCue && cue.startMs < previousCue.endMs) {
    return "Overlap";
  }

  return "";
}

function parseCaptionImport(input: string): Cue[] {
  const normalized = input.replace(/\r/g, "").trim();
  if (!normalized) {
    return [];
  }

  return normalized
    .split(/\n{2,}/)
    .flatMap((block) => {
      const lines = block
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const timingIndex = lines.findIndex((line) => line.includes("-->"));

      if (timingIndex === -1) {
        return [];
      }

      const timingLine = lines[timingIndex];
      const timingMatch = /^(.+?)\s+-->\s+(.+?)(?:\s|$)/.exec(timingLine);
      if (!timingMatch) {
        return [];
      }

      const startMs = parseTimecode(timingMatch[1]);
      const endMs = parseTimecode(timingMatch[2]);
      const text = lines.slice(timingIndex + 1).join("\n").trim();

      if (startMs === null || endMs === null || endMs <= startMs || !text) {
        return [];
      }

      return [
        {
          id: createCueId(),
          startMs,
          endMs,
          text,
          note: "",
        },
      ];
    });
}

export default function SubtitleCapturePage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const autoSnapshotBusyRef = useRef(false);
  const subtitleTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [sessionTitle, setSessionTitle] = useState(DEFAULT_TITLE);
  const [sourceUrl, setSourceUrl] = useState(DEFAULT_SOURCE_URL);
  const [mediaMode, setMediaMode] = useState<MediaMode>("source");
  const [clockSource, setClockSource] = useState<ClockSource>("manual");
  const videoObjectUrl = "";
  const [videoCurrentMs, setVideoCurrentMs] = useState(0);
  const [screenShareActive, setScreenShareActive] = useState(false);
  const [cues, setCues] = useState<Cue[]>([]);
  const [draft, setDraft] = useState<DraftCue>(defaultDraft());
  const [baseElapsedMs, setBaseElapsedMs] = useState(0);
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);
  const [manualClockRate, setManualClockRate] = useState(1);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [timerSyncInput, setTimerSyncInput] = useState("00:00:00.000");
  const [filterText, setFilterText] = useState("");
  const [importText, setImportText] = useState("");
  const [exportKind, setExportKind] = useState<CaptureExportKind>("srt");
  const [editingCueId, setEditingCueId] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("");
  const [loaded, setLoaded] = useState(false);

  const manualElapsedMs =
    startedAtMs === null
      ? baseElapsedMs
      : baseElapsedMs + Math.max(0, nowMs - startedAtMs) * manualClockRate;
  const usingVideoClock = clockSource === "video" && Boolean(videoObjectUrl);
  const currentMs = usingVideoClock ? videoCurrentMs : manualElapsedMs;
  const sortedCueList = useMemo(() => sortCues(cues), [cues]);
  const filteredCues = useMemo(() => {
    const needle = filterText.trim().toLowerCase();
    if (!needle) {
      return sortedCueList;
    }

    return sortedCueList.filter((cue) => {
      return (
        cue.text.toLowerCase().includes(needle) ||
        cue.note.toLowerCase().includes(needle) ||
        formatEditableTimecode(cue.startMs).includes(needle) ||
        formatEditableTimecode(cue.endMs).includes(needle)
      );
    });
  }, [filterText, sortedCueList]);
  const cueIssues = useMemo(() => {
    return new Map(sortedCueList.map((cue, index) => [cue.id, getCueIssue(cue, index, sortedCueList)]));
  }, [sortedCueList]);
  const warningCount = Array.from(cueIssues.values()).filter(Boolean).length;
  const session: CaptureSession = {
    title: sessionTitle,
    sourceUrl,
    cues: sortedCueList,
  };
  const exportPreview = buildExport(exportKind, session);
  const exportExtension: Record<CaptureExportKind, string> = {
    csv: "csv",
    json: "json",
    markdown: "md",
    srt: "srt",
    vtt: "vtt",
  };
  const latestCue = sortedCueList[sortedCueList.length - 1];

  useEffect(() => {
    const restored = parsePersistedState(window.localStorage.getItem(STORAGE_KEY));
    if (restored) {
      setSessionTitle(restored.title);
      setSourceUrl(restored.sourceUrl);
      setCues(restored.cues);
      setDraft(restored.draft);
      setBaseElapsedMs(restored.baseElapsedMs);
      setFilterText(restored.filterText);
      setExportKind(restored.exportKind);
      setClockSource(restored.clockSource);
      setMediaMode(restored.mediaMode);
      setManualClockRate(restored.manualClockRate);
      setTimerSyncInput(formatEditableTimecode(restored.baseElapsedMs));
    }

    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) {
      return;
    }

    const state: PersistedState = {
      title: sessionTitle,
      sourceUrl,
      cues: sortedCueList,
      draft,
      baseElapsedMs: currentMs,
      filterText,
      exportKind,
      clockSource,
      mediaMode,
      manualClockRate,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [
    clockSource,
    currentMs,
    draft,
    exportKind,
    filterText,
    loaded,
    manualClockRate,
    mediaMode,
    sessionTitle,
    sortedCueList,
    sourceUrl,
  ]);

  useEffect(() => {
    if (startedAtMs === null) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 80);

    return () => window.clearInterval(intervalId);
  }, [startedAtMs]);

  useEffect(() => {
    if (!statusText) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setStatusText("");
    }, 3000);

    return () => window.clearTimeout(timeoutId);
  }, [statusText]);

  useEffect(() => {
    return () => {
      screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const setManualClockTo = (value: number) => {
    const nextValue = clampMs(value);
    setBaseElapsedMs(nextValue);
    setTimerSyncInput(formatEditableTimecode(nextValue));

    if (startedAtMs !== null) {
      const currentTime = Date.now();
      setNowMs(currentTime);
      setStartedAtMs(currentTime);
    }
  };

  const handleClockRateChange = (value: number) => {
    const nextRate = Math.min(4, Math.max(0.25, value));

    if (startedAtMs !== null) {
      const currentTime = Date.now();
      setBaseElapsedMs(manualElapsedMs);
      setNowMs(currentTime);
      setStartedAtMs(currentTime);
    }

    setManualClockRate(nextRate);
  };

  const seekToMs = (value: number) => {
    const nextValue = clampMs(value);
    if (usingVideoClock && videoRef.current) {
      videoRef.current.currentTime = nextValue / 1000;
      setVideoCurrentMs(nextValue);
      return;
    }

    setManualClockTo(nextValue);
  };

  const resetDraft = (timecode = formatEditableTimecode(currentMs)) => {
    setDraft(defaultDraft(timecode));
    setEditingCueId(null);
  };

  const syncDraftTo = (field: "start" | "end") => {
    const stamp = formatEditableTimecode(currentMs);
    setDraft((current) => ({
      ...current,
      [field]: stamp,
    }));
  };

  const handleStartScreenShare = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setStatusText("Screen capture is not available in this browser.");
      return;
    }

    try {
      screenStreamRef.current?.getTracks().forEach((track) => track.stop());
      const stream = await navigator.mediaDevices.getDisplayMedia({
        audio: false,
        video: true,
      });

      screenStreamRef.current = stream;
      setMediaMode("mirror");
      setScreenShareActive(true);

      const [track] = stream.getVideoTracks();
      track?.addEventListener("ended", () => {
        setScreenShareActive(false);
        screenStreamRef.current = null;
      });

      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
        await screenVideoRef.current.play();
      }

      setStatusText("Shared tab connected.");
    } catch {
      setStatusText("Screen sharing was cancelled.");
    }
  };

  const handleStopScreenShare = () => {
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null;
    }
    setScreenShareActive(false);
    setStatusText("Shared tab stopped.");
  };

  const saveSnapshot = async () => {
    if (autoSnapshotBusyRef.current) {
      return;
    }

    const video = screenVideoRef.current;
    const canvas = screenCanvasRef.current;

    if (!video || !canvas || !screenShareActive || video.videoWidth === 0 || video.videoHeight === 0) {
      setStatusText("Share a tab before saving a snapshot.");
      return;
    }

    autoSnapshotBusyRef.current = true;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      autoSnapshotBusyRef.current = false;
      setStatusText("Snapshot canvas could not start.");
      return;
    }

    try {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const response = await fetch("/api/screen-capture", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageDataUrl: canvas.toDataURL("image/png"),
          sourceUrl,
          timecode: formatEditableTimecode(currentMs),
          title: sessionTitle,
          captureMode: "single",
        }),
      });

      if (!response.ok) {
        setStatusText("Snapshot could not be saved.");
        return;
      }

      const result = (await response.json()) as { imagePath?: string };
      setStatusText(result.imagePath ? "Snapshot saved for Codex." : "Snapshot saved.");
    } catch {
      autoSnapshotBusyRef.current = false;
      setStatusText("Snapshot could not be saved.");
      return;
    } finally {
      autoSnapshotBusyRef.current = false;
    }
  };

  const handleSaveSnapshot = () => {
    void saveSnapshot();
  };

  const handleStartTimer = () => {
    if (usingVideoClock) {
      void videoRef.current?.play();
      return;
    }

    if (startedAtMs !== null) {
      return;
    }

    const currentTime = Date.now();
    setNowMs(currentTime);
    setStartedAtMs(currentTime);
    setStatusText("Manual clock running.");
  };

  const handlePauseTimer = () => {
    if (usingVideoClock) {
      videoRef.current?.pause();
      return;
    }

    if (startedAtMs === null) {
      return;
    }

    setBaseElapsedMs(manualElapsedMs);
    setStartedAtMs(null);
    setStatusText("Manual clock paused.");
  };

  const handleApplySync = () => {
    const parsed = parseTimecode(timerSyncInput);
    if (parsed === null) {
      setStatusText("Use a valid timecode.");
      return;
    }

    seekToMs(parsed);
    setStatusText(`Clock synced to ${formatEditableTimecode(parsed)}.`);
  };

  const saveCueFromDraft = (candidateDraft: DraftCue) => {
    const startMs = parseTimecode(candidateDraft.start);
    const endMs = parseTimecode(candidateDraft.end);
    const trimmedText = candidateDraft.text.trim();

    if (startMs === null || endMs === null) {
      setStatusText("Both cue times must be valid.");
      return false;
    }

    if (!trimmedText) {
      setStatusText("Subtitle text is empty.");
      return false;
    }

    if (endMs <= startMs) {
      setStatusText("End time must be after start time.");
      return false;
    }

    const nextCue: Cue = {
      id: editingCueId ?? createCueId(),
      startMs,
      endMs,
      text: trimmedText,
      note: candidateDraft.note.trim(),
    };

    setCues((current) => {
      if (editingCueId) {
        return current.map((cue) => (cue.id === editingCueId ? nextCue : cue));
      }

      return [...current, nextCue];
    });

    resetDraft(formatEditableTimecode(endMs));
    seekToMs(endMs);
    setStatusText(editingCueId ? "Cue updated." : "Cue saved.");
    return true;
  };

  const handleSaveCueAtCurrentTime = () => {
    const nextDraft = {
      ...draft,
      end: formatEditableTimecode(currentMs),
    };

    setDraft(nextDraft);
    if (saveCueFromDraft(nextDraft)) {
      window.setTimeout(() => subtitleTextareaRef.current?.focus(), 0);
    }
  };

  const handleStartNextCue = () => {
    const stamp = formatEditableTimecode(currentMs);
    setEditingCueId(null);
    setDraft(defaultDraft(stamp));
    window.setTimeout(() => subtitleTextareaRef.current?.focus(), 0);
    setStatusText("Next cue started.");
  };

  const handleEditCue = (cue: Cue) => {
    setEditingCueId(cue.id);
    setDraft({
      start: formatEditableTimecode(cue.startMs),
      end: formatEditableTimecode(cue.endMs),
      text: cue.text,
      note: cue.note,
    });
    seekToMs(cue.startMs);
    document.getElementById("cue-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
    setStatusText("Cue loaded.");
  };

  const handleDeleteCue = (cueId: string) => {
    if (!window.confirm("Delete this cue?")) {
      return;
    }

    setCues((current) => current.filter((cue) => cue.id !== cueId));
    if (editingCueId === cueId) {
      resetDraft();
    }
    setStatusText("Cue deleted.");
  };

  const handleCopyExport = async () => {
    try {
      await navigator.clipboard.writeText(exportPreview);
      setStatusText(`${exportKind.toUpperCase()} copied.`);
    } catch {
      setStatusText("Clipboard copy was blocked.");
    }
  };

  const handleDownloadExport = () => {
    const blob = new Blob([exportPreview], {
      type: exportKind === "json" ? "application/json;charset=utf-8" : "text/plain;charset=utf-8",
    });
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `${slugifyTitle(sessionTitle)}.${exportExtension[exportKind]}`;
    link.click();
    window.URL.revokeObjectURL(objectUrl);
    setStatusText(`${exportKind.toUpperCase()} download started.`);
  };

  const handleImportCaptions = () => {
    const importedCues = parseCaptionImport(importText);

    if (importedCues.length === 0) {
      setStatusText("Paste valid SRT or WebVTT captions first.");
      return;
    }

    setCues((current) => sortCues([...current, ...importedCues]));
    setImportText("");
    setStatusText(`${importedCues.length} captions imported.`);
  };

  const handleCopyExtractScript = async () => {
    try {
      await navigator.clipboard.writeText(EXTRACT_SCRIPT);
      setStatusText("Extractor script copied.");
    } catch {
      setStatusText("Copy was blocked. Select the script manually.");
    }
  };

  const handleClearSession = () => {
    if (!window.confirm("Clear all saved cues and the current draft?")) {
      return;
    }

    setCues([]);
    setBaseElapsedMs(0);
    setStartedAtMs(null);
    setVideoCurrentMs(0);
    setTimerSyncInput("00:00:00.000");
    setFilterText("");
    resetDraft("00:00:00.000");
    seekToMs(0);
    setStatusText("Session cleared.");
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;
      const isTyping =
        tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || Boolean(target?.isContentEditable);

      if (event.ctrlKey && event.key === "Enter") {
        event.preventDefault();
        handleSaveCueAtCurrentTime();
        return;
      }

      if (isTyping) {
        return;
      }

      if (event.key === "F2") {
        event.preventDefault();
        syncDraftTo("start");
        subtitleTextareaRef.current?.focus();
        return;
      }

      if (event.key === "F3") {
        event.preventDefault();
        syncDraftTo("end");
        return;
      }

      if (event.key === "F4") {
        event.preventDefault();
        handleSaveCueAtCurrentTime();
        return;
      }

      if (event.key === "F6") {
        event.preventDefault();
        handleStartNextCue();
        return;
      }

      if (event.key === "F8") {
        event.preventDefault();
        handleSaveSnapshot();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <main className="simple-subtitle-app">
      <header className="simple-header">
        <div>
          <span>Subtitle Timeline</span>
          <h1>{sessionTitle || DEFAULT_TITLE}</h1>
        </div>
        <div className="simple-header-actions">
          {sourceUrl ? (
            <a className="button button-secondary" href={sourceUrl} target="_blank" rel="noreferrer">
              Open Video
            </a>
          ) : null}
          <button className="button button-danger" type="button" onClick={handleClearSession}>
            Clear
          </button>
        </div>
      </header>

      <section className="simple-status">
        <div>
          <span>Time</span>
          <strong>{formatEditableTimecode(currentMs)}</strong>
        </div>
        <div>
          <span>Cues</span>
          <strong>{sortedCueList.length}</strong>
        </div>
        <div>
          <span>Last End</span>
          <strong>{latestCue ? formatEditableTimecode(latestCue.endMs) : "00:00:00.000"}</strong>
        </div>
      </section>

      <section className="simple-workspace">
        <article className="simple-video-panel">
          <div className="simple-video-frame">
            {screenShareActive ? (
              <video ref={screenVideoRef} muted playsInline autoPlay />
            ) : (
              <div className="simple-empty-video">
                <strong>Share your logged-in video tab</strong>
                <span>Click Share Video Tab, then pick the video tab.</span>
              </div>
            )}
            <canvas ref={screenCanvasRef} className="capture-canvas" />
          </div>

          <div className="simple-controls">
            <button className="button button-primary" type="button" onClick={handleStartScreenShare}>
              Share Video Tab
            </button>
            <button className="button" type="button" onClick={handleStopScreenShare}>
              Stop Share
            </button>
            <button className="button" type="button" onClick={handleSaveSnapshot}>
              Send Frame
            </button>
          </div>

          <div className="simple-sync">
            <label>
              <span>Video time</span>
              <input
                aria-label="sync time"
                value={timerSyncInput}
                onChange={(event) => setTimerSyncInput(event.target.value)}
                placeholder="00:00:00.000"
              />
            </label>
            <button className="button button-secondary" type="button" onClick={handleApplySync}>
              Sync
            </button>
            <button
              className={startedAtMs === null ? "button button-primary" : "button button-secondary"}
              type="button"
              onClick={startedAtMs === null ? handleStartTimer : handlePauseTimer}
            >
              {startedAtMs === null ? "Start Clock" : "Pause Clock"}
            </button>
            <label>
              <span>Speed</span>
              <select
                value={manualClockRate}
                onChange={(event) => handleClockRateChange(Number(event.target.value))}
              >
                <option value={1}>1x</option>
                <option value={1.25}>1.25x</option>
                <option value={1.5}>1.5x</option>
                <option value={2}>2x</option>
                <option value={3}>3x</option>
                <option value={4}>4x</option>
              </select>
            </label>
          </div>
        </article>

        <aside className="simple-cue-panel" id="cue-editor">
          <div className="simple-panel-title">
            <div>
              <span>{statusText || (loaded ? "Ready" : "Loading")}</span>
              <h2>{editingCueId ? "Edit Caption" : "Caption"}</h2>
            </div>
            {editingCueId ? (
              <button className="button" type="button" onClick={() => resetDraft()}>
                Cancel
              </button>
            ) : null}
          </div>

          <div className="simple-timing">
            <label>
              <span>Start</span>
              <input
                value={draft.start}
                onChange={(event) => setDraft((current) => ({ ...current, start: event.target.value }))}
              />
            </label>
            <label>
              <span>End</span>
              <input
                value={draft.end}
                onChange={(event) => setDraft((current) => ({ ...current, end: event.target.value }))}
              />
            </label>
          </div>

          <textarea
            ref={subtitleTextareaRef}
            className="simple-caption-box"
            value={draft.text}
            onChange={(event) => setDraft((current) => ({ ...current, text: event.target.value }))}
            placeholder="Type the caption you see"
          />

          <div className="simple-cue-actions">
            <button className="button" type="button" onClick={handleStartNextCue}>
              New Caption
            </button>
            <button className="button button-primary" type="button" onClick={handleSaveCueAtCurrentTime}>
              Save at Current Time
            </button>
            <button className="button" type="button" onClick={() => syncDraftTo("start")}>
              Start = Now
            </button>
            <button className="button" type="button" onClick={() => syncDraftTo("end")}>
              End = Now
            </button>
          </div>

          <div className="simple-export">
            <select value={exportKind} onChange={(event) => setExportKind(event.target.value as CaptureExportKind)}>
              <option value="srt">SRT</option>
              <option value="vtt">WebVTT</option>
              <option value="csv">CSV</option>
              <option value="markdown">Markdown</option>
              <option value="json">JSON</option>
            </select>
            <button className="button button-primary" type="button" onClick={handleDownloadExport}>
              Download
            </button>
            <button className="button" type="button" onClick={handleCopyExport}>
              Copy
            </button>
          </div>

          <details className="simple-import">
            <summary>Import captions</summary>
            <textarea
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              placeholder="Paste SRT or WebVTT text here"
            />
            <button className="button button-primary" type="button" onClick={handleImportCaptions}>
              Import Timed Captions
            </button>
          </details>

          <details className="simple-import">
            <summary>One-minute extractor</summary>
            <button className="button button-primary" type="button" onClick={handleCopyExtractScript}>
              Copy Extract Script
            </button>
            <textarea readOnly value={EXTRACT_SCRIPT} />
          </details>

          <pre className="simple-preview">{exportPreview || "No cues saved yet."}</pre>
        </aside>
      </section>

      <section className="simple-timeline">
        <div className="simple-panel-title">
          <div>
            <span>{warningCount > 0 ? `${warningCount} timing issue${warningCount === 1 ? "" : "s"}` : "Clean"}</span>
            <h2>Saved Captions</h2>
          </div>
          <input
            aria-label="filter captions"
            value={filterText}
            onChange={(event) => setFilterText(event.target.value)}
            placeholder="Filter"
          />
        </div>

        {filteredCues.length === 0 ? (
          <div className="empty-table">No captions saved.</div>
        ) : (
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Caption</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCues.map((cue) => {
                  const index = sortedCueList.findIndex((item) => item.id === cue.id);
                  return (
                    <tr key={cue.id} className={editingCueId === cue.id ? "selected-row" : undefined}>
                      <td>{index + 1}</td>
                      <td>{formatEditableTimecode(cue.startMs)}</td>
                      <td>{formatEditableTimecode(cue.endMs)}</td>
                      <td>
                        <span className="cue-text">{cue.text}</span>
                      </td>
                      <td>
                        <div className="inline-actions">
                          <button className="button" type="button" onClick={() => handleEditCue(cue)}>
                            Edit
                          </button>
                          <button className="button button-danger" type="button" onClick={() => handleDeleteCue(cue.id)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
