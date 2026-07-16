import { describe, expect, it } from "vitest";

import {
  clampMs,
  formatEditableTimecode,
  formatSrtTimecode,
  parseTimecode,
} from "../src/modules/subtitle-capture/time";

describe("subtitle timecodes", () => {
  it("formats boundaries deterministically", () => {
    expect(formatEditableTimecode(3_661_007)).toBe("01:01:01.007");
    expect(formatSrtTimecode(3_661_007)).toBe("01:01:01,007");
  });

  it.each(["", "1", "00:60.000", "00:-1.000", "00:00:00.0.1", "NaN:00"])(
    "rejects malformed value %j",
    (value) => expect(parseTimecode(value)).toBeNull(),
  );

  it("accepts SRT and VTT separators", () => {
    expect(parseTimecode("01:02:03,004")).toBe(3_723_004);
    expect(parseTimecode("02:03.5")).toBe(123_500);
  });

  it("clamps non-finite and negative values", () => {
    expect(clampMs(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clampMs(-10)).toBe(0);
  });
});
