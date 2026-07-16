# ADR 003: Browser extension verification

## Status

Accepted

## Context

Unit tests cannot prove that Manifest V3 service workers, `chrome.scripting`, optional permissions or the debugger lifecycle behave correctly in a browser. The extension also needs repeatable accessibility checks without implying that automation is a screen-reader review.

## Decision

Run Playwright's pinned Chromium in an isolated persistent profile and load the unpacked extension. Tests use a local HTTP fixture with synthetic Unicode cues and never contact video providers. A generated test copy moves optional host/debugger permissions into its required permissions so success and detach paths can run without nondeterministic browser prompts; the production manifest remains unchanged and is validated separately. A production-manifest context covers the optional permission denial path.

Test initial, success and error popup states with axe WCAG 2.0/2.1 A/AA rules. Test explicit keyboard order and live-region attributes. Keep the browser job separate from the unit/build job and retain traces, screenshots and HTML reports only on failure.

## Consequences

- Real Chromium covers extension pages, active-tab scripting and the MV3 worker.
- Fixtures are deterministic and contain no user media.
- Browser downloads increase CI time and depend on Playwright's browser distribution.
- The permission-granted harness is not evidence that Chrome Web Store review will approve the requested permissions.
- Axe and keyboard automation do not replace manual Chrome, zoom/reflow or screen-reader testing.
