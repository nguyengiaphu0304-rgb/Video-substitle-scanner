# Video Subtitle Scanner

Video Subtitle Scanner is a local subtitle capture workspace for collecting timed captions from web videos and turning them into SRT transcripts and timestamped notes.

The project contains two parts:

- A Next.js app with a subtitle capture and export interface.
- A Chrome extension that runs inside the active video tab and tries to extract caption tracks, subtitle files, and subtitle playlist segments from logged-in pages.

## Features

- Extract captions from browser video text tracks when the site exposes them.
- Scan network responses for VTT, SRT, TTML, and subtitle playlist resources.
- Filter out timed metadata and discontinuity events that are not real subtitles.
- Combine subtitle segments into a complete SRT when a subtitle playlist is available.
- Generate timestamped notes and a full timed transcript from extracted SRT text.
- Export captions as SRT from the web app or Chrome extension.
- Package the Chrome extension for public release.
- Preserve multilingual subtitle text through a shared, deterministic SRT/WebVTT/TTML parser.
- Request site and debugger access only at runtime when the relevant action needs it.

## Project Structure

```text
chrome-extension/       Unpacked Chrome extension for logged-in video pages
docs/                   Chrome Web Store listing, privacy, and release notes
scripts/                Local packaging scripts
src/app/subtitle-capture Next.js subtitle capture interface
src/modules/subtitle-capture Shared subtitle time/export helpers
tests/                  Offline parser and manifest security tests
prisma/                 Local development schema
```

## Run The Web App

Install dependencies:

```bash
npm ci
```

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000/subtitle-capture
```

## Install The Chrome Extension

1. Open Chrome and go to `chrome://extensions`.
2. Turn on Developer mode.
3. Click Load unpacked.
4. Select the `chrome-extension` folder from this project.
5. Open the logged-in video page.
6. Turn on CC in the video player.
7. Open the extension and extract captions.

For videos that load subtitles through playlists or short segments, use the extension's deep network scan mode, then refresh the scan after the video page has loaded caption resources.

## Build And Check

```bash
npm run lint
npm run typecheck
npm test
npm run verify:extension
npm run build
npm run audit
```

`npm run audit` is an enforced release gate. A release must not be tagged while high-severity advisories remain unresolved.

## Package The Extension

```bash
npm run pack:extension
```

The Chrome Web Store upload ZIP is written to `dist/`.

Publishing materials are in `docs/`:

- `docs/privacy-policy.md`
- `docs/chrome-web-store-listing.md`
- `docs/publishing-checklist.md`

## Notes

This tool can only extract captions that the browser can access from the page, text tracks, or network responses. If a site never exposes a full subtitle file or playlist and only loads chunks during playback, the extension can only collect chunks that have been requested by the page.

The tool does not bypass DRM, transcribe audio or upload user media. TTML support covers timed paragraph elements and does not claim conformance with every TTML profile. See [architecture](docs/architecture.md), [threat model](docs/threat-model.md), [ADR 001](docs/adr/001-shared-parser-and-optional-debugger.md) and the [roadmap](docs/roadmap.md).
