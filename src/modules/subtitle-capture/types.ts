export type Cue = {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  note: string;
};

export type CaptureSession = {
  title: string;
  sourceUrl: string;
  cues: Cue[];
};

export type CaptureExportKind = "srt" | "vtt" | "csv" | "markdown" | "json";
