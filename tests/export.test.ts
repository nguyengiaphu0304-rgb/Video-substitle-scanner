import { describe, expect, it } from "vitest";

import { buildCsv, buildSrt, buildVtt, sortCues } from "../src/modules/subtitle-capture/export";
import type { CaptureSession } from "../src/modules/subtitle-capture/types";

const session: CaptureSession = {
  title: "Unicode fixture",
  sourceUrl: "https://example.test/video",
  cues: [
    { id: "later", startMs: 2_000, endMs: 3_000, text: "Xin chào", note: "a,b" },
    { id: "first", startMs: 0, endMs: 1_000, text: "你好", note: "quote \"safe\"" },
  ],
};

describe("subtitle exports", () => {
  it("sorts without mutating the capture", () => {
    const sorted = sortCues(session.cues);
    expect(sorted.map((cue) => cue.id)).toEqual(["first", "later"]);
    expect(session.cues[0]?.id).toBe("later");
  });

  it("builds deterministic Unicode SRT and VTT", () => {
    expect(buildSrt(session)).toContain("1\n00:00:00,000 --> 00:00:01,000\n你好");
    expect(buildVtt(session)).toContain("WEBVTT\n\nNOTE Unicode fixture");
  });

  it("escapes CSV fields", () => {
    const csv = buildCsv(session);
    expect(csv).toContain('"a,b"');
    expect(csv).toContain('"quote ""safe"""');
  });
});
