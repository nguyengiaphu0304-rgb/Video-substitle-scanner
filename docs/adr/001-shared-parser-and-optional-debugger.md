# ADR 001: Shared parser and optional debugger permission

- Status: accepted
- Date: 2026-07-16

## Context

The popup and service worker implemented different caption filters. Both counted only ASCII letters, so valid CJK and Arabic cues were silently discarded. The extension also declared `debugger` as a mandatory install-time permission even though only Advanced Scan needs it.

## Decision

Use one side-effect-free ES module for SRT, WebVTT and TTML parsing. Both extension contexts import it. The injected page probe keeps a small self-contained Unicode-aware predicate because Chrome serializes the injected function and cannot resolve module imports in the page context.

Move `debugger` to `optional_permissions`. Request it only from the explicit Start Scan action. Keep site origins optional and request only origins discovered in the active tab. Bound resource traversal to 250 URLs and each caption payload to 2 MiB.

## Consequences

- Parsing behavior is deterministic and testable without Chrome or network access.
- Install-time permission exposure is smaller.
- Advanced Scan still exposes inspected network responses to the extension process after explicit consent. It must be stopped when no longer needed.
- Regex-based TTML parsing supports timed `<p begin end>` content, not every TTML profile or inherited timing rule.
