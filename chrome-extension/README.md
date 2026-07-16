# Video Subtitle Scanner Extension

This Chrome extension extracts accessible timed captions from the active video tab and exports them as SRT subtitles and Markdown notes.

## Local Install

1. Open Chrome and go to `chrome://extensions`.
2. Turn on Developer mode.
3. Click Load unpacked.
4. Select this folder:

   `chrome-extension`

## Use

1. Open a video page that you can already access.
2. Turn on captions or subtitles in the video player.
3. Click the Video Subtitle Scanner extension icon.
4. Click Extract From Active Tab.
5. Copy or download the SRT and notes.

## Advanced Scan

Advanced Scan is optional. Chrome asks for debugger permission only after the user clicks Start Scan, and the extension attaches only to the active tab. Use it only when regular extraction cannot find captions.

1. Click Start Scan.
2. Accept Chrome's debugger notice if shown.
3. Refresh or play the video page with captions on.
4. Click Refresh in the extension popup.
5. Click Stop when finished.

## Package For Chrome Web Store

From the project root:

```bash
npm run pack:extension
```

The cross-platform Node.js packager creates the upload ZIP, a SHA-256 sidecar and a machine-readable package manifest in `dist/`. Verify them before upload:

```bash
npm run verify:package
```

The archive is reproducible for identical source. Packaging rejects symlinks and unexpected files instead of silently including them.
