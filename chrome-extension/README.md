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

Advanced Scan is optional. The extension declares Chrome debugger permission for this feature, but it attaches to the active tab only after the user clicks Start Scan. Use it only when regular extraction cannot find captions.

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

The upload ZIP will be created in `dist/`.
