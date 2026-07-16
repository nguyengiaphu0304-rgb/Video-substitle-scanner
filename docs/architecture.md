# Architecture

## Trust boundaries

1. The active page is untrusted. Regular extraction reads only accessible text tracks and candidate resource URLs after an extension click.
2. Cross-origin caption resources require an optional origin grant. Denial returns candidate URLs instead of silently broadening access.
3. Advanced Scan requires a separate optional `debugger` grant and attaches only to the active tab.
4. Caption bodies are untrusted. Parsing is side-effect free, size bounded and rejects malformed timing or metadata-only content.
5. Results stay in the popup until the user copies or downloads them. The extension does not upload media or captions.

## Modules

- `chrome-extension/caption-core.js`: deterministic Unicode-aware parsing, validation, ordering and SRT serialization.
- `chrome-extension/popup.js`: user interaction, active-tab probe, permission prompts and export actions.
- `chrome-extension/background.js`: bounded caption fetching and opt-in debugger lifecycle.
- `src/modules/subtitle-capture`: companion web workspace export and time helpers.

## Data flow

The popup first probes text tracks in the active tab. If only resource URLs are found, it requests the minimum origin grants and asks the service worker to fetch bounded candidates. Advanced Scan is a separate path and never starts automatically. Parsed cues are canonically ordered and deduplicated before export.
