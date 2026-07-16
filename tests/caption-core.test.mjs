import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_CAPTION_BYTES,
  captionTextToSrt,
  combineSrtTexts,
  hasHumanCaptions,
  isHumanCaptionText,
  parseCaptionCues,
  parseTimeToSeconds,
} from "../chrome-extension/caption-core.js";

test("preserves captions across writing systems", () => {
  const input = `WEBVTT

00:00:01.000 --> 00:00:02.000
你好，世界

00:00:03.000 --> 00:00:04.000
مرحبا بالعالم

00:00:05.000 --> 00:00:06.000
Đây là phụ đề`;

  const output = captionTextToSrt(input);
  assert.match(output, /你好，世界/u);
  assert.match(output, /مرحبا بالعالم/u);
  assert.match(output, /Đây là phụ đề/u);
  assert.equal(parseCaptionCues(input).length, 3);
});

test("parses TTML offsets and nested markup", () => {
  const input = `<tt><body><div>
    <p begin="1.25s" end="2.5s">Accessible <span>caption</span></p>
    <p begin="2500ms" end="4s">第二行</p>
  </div></body></tt>`;

  assert.equal(
    captionTextToSrt(input),
    [
      "1\n00:00:01,250 --> 00:00:02,500\nAccessible caption",
      "2\n00:00:02,500 --> 00:00:04,000\n第二行",
    ].join("\n\n"),
  );
});

test("rejects metadata, empty and reversed cues", () => {
  assert.equal(isHumanCaptionText('{"metadataType":"ID3","PTS":12}'), false);
  assert.equal(hasHumanCaptions("#EXT-X-DISCONTINUITY"), false);
  assert.equal(captionTextToSrt("00:00:02 --> 00:00:01\nbackwards"), "");
  assert.equal(captionTextToSrt("00:00:00 --> 00:00:01\n♪♪"), "");
});

test("deduplicates and canonically sorts combined segments", () => {
  const late = "00:00:03 --> 00:00:04\nLater cue";
  const early = "00:00:01 --> 00:00:02\nEarlier cue";
  const output = combineSrtTexts([late, early, early]);
  assert.equal((output.match(/Earlier cue/gu) ?? []).length, 1);
  assert.ok(output.indexOf("Earlier cue") < output.indexOf("Later cue"));
});

test("enforces timestamp and payload boundaries", () => {
  assert.equal(parseTimeToSeconds("01:02:03.5"), 3723.5);
  assert.equal(parseTimeToSeconds("1500ms"), 1.5);
  assert.equal(parseTimeToSeconds("00:60:00"), null);
  assert.equal(parseTimeToSeconds("00:00:60"), null);
  assert.equal(parseTimeToSeconds("Infinitys"), null);
  assert.deepEqual(parseCaptionCues("x".repeat(MAX_CAPTION_BYTES + 1)), []);
});
