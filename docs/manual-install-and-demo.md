# Manual install and reproducible demo

This guide separates two kinds of evidence:

- The committed synthetic fixture proves deterministic parser input, output and SHA-256 lineage.
- The unpacked Chrome walkthrough demonstrates the real extension against a page you choose. It does not prove compatibility with every provider or bypass inaccessible captions, DRM or proprietary formats.

No fixture contains user media, provider data or a claimed real-world transcript.

## Verify the fixture evidence

From a clean checkout with Node.js 24:

```bash
npm ci
npm run demo:verify
```

The command reads `docs/demo/captions.vtt`, runs the production parser in `chrome-extension/caption-core.js`, and verifies:

- `docs/demo/expected.srt` byte for byte;
- the source, parser and output SHA-256 values in `docs/demo/evidence.json`;
- exact byte and cue counts;
- the project-owned MIT license and synthetic-data marker.

To regenerate the evidence after an intentional parser or fixture change:

```bash
npm run demo:generate
npm run demo:verify
git diff -- docs/demo
```

Review the diff. A changed parser hash requires regenerated evidence even when the visible SRT is unchanged.

## Load the unpacked extension

1. Run `npm ci`, `npm run verify:extension` and `npm run demo:verify`.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Select **Load unpacked** and choose the repository's `chrome-extension` directory.
5. Confirm the install prompt does not request debugger access or access to every website.
6. Open a video page you are permitted to use and enable its captions.
7. Open Video Subtitle Scanner and select **Extract From Active Tab**.
8. Review the SRT before copying or downloading it.

Advanced Scan is optional. Starting it may request debugger permission and site access for caption resource origins discovered in the active tab. Stop the scan when finished. Do not use the extension to evade access controls or copy content without permission.

## Automated browser demonstration

Run:

```bash
npx playwright install chromium
npm run test:browser
```

The five tests load the unpacked extension in isolated Chromium profiles and use only a loopback synthetic page. They cover Unicode cue extraction, restricted pages, debugger detach, deterministic permission denial, keyboard order, live status and automated axe checks.

These automated results do not replace manual Chrome permission-prompt review, 200% zoom/reflow testing or a screen-reader session. Those release checklist items must remain incomplete until a person actually performs and records them.
