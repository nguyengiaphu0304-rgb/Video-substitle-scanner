# Chrome Web Store Listing Draft

## Name

Video Subtitle Scanner

## Short Description

Extract accessible video captions from the active tab and export SRT transcripts and notes.

## Detailed Description

Video Subtitle Scanner helps students, researchers, editors, and accessibility reviewers save timed captions from videos they can already access in their browser.

Open a video page, turn on captions, click the extension, and export the available subtitle data as SRT. When regular text tracks are not exposed, Advanced Scan can inspect caption-related network responses for the active tab after the user starts that mode.

The extension also creates simple timestamped Markdown notes from the extracted transcript, making it easier to review long videos without manually copying each subtitle line.

Core features:

- Extract loaded caption and subtitle text tracks from the active tab.
- Detect VTT, SRT, TTML, and subtitle playlist resources.
- Filter out timed metadata that is not human subtitle text.
- Combine compatible subtitle segments into a single SRT transcript.
- Copy or download SRT subtitles.
- Generate local timestamped notes in Markdown.

Privacy:

Video Subtitle Scanner runs locally in the browser. It does not upload extracted subtitles, notes, browsing history, or video data to any server.

## Category

Productivity

## Permission Justifications

- `activeTab`: needed to run extraction only on the tab the user is currently viewing.
- `scripting`: needed to inspect accessible video caption tracks in the active tab.
- `clipboardWrite`: needed to copy extracted subtitles or generated notes after a user action.
- `debugger`: needed for Advanced Scan, which inspects caption-related network responses when normal extraction cannot find captions. The extension attaches only after the user clicks Start Scan.
- Optional site access: needed only to fetch candidate caption resources discovered from the active tab.

## Privacy Dashboard Answers

- Single purpose: Extract accessible video captions from the active tab and export local subtitle transcripts and notes.
- Remote code: No remote code is loaded or executed.
- Data collection: The extension does not collect, transmit, sell, or share user data.
- Limited use certification: Data is handled locally and only for the user-facing caption extraction feature.

## Required Store Assets

- Extension icon: 128x128 PNG from `chrome-extension/icons/icon128.png`
- Screenshot: at least one 1280x800 or 640x400 image showing the popup with extracted captions
- Small promo tile: `store-assets/small-promo-440x280.png`
- Privacy policy URL: hosted copy of `docs/privacy-policy.md`
