# ADR 004: deterministic-input performance budgets

## Status

Accepted.

## Context

Caption parsing runs in an extension service worker and can receive large subtitle resources. Package growth also affects reviewability and installation cost. A release gate needs to catch material regressions without relying on private videos, live websites or unverifiable benchmark claims.

## Decision

- Generate 25,000 valid multilingual WebVTT cues deterministically. The fixture remains below the parser's existing 2 MiB character limit.
- Warm the parser once, then require the complete fixture to parse and canonically order within 2,000 ms in the Node.js CI environment.
- Verify the first and last Unicode captions and exact cue count so a faster but incomplete parser cannot pass.
- Limit the deterministic store ZIP to 64 KiB and extension JavaScript to 48 KiB.
- Write a JSON report with the runtime identity, input size, duration, artifact sizes and limits.

The thresholds provide deliberate headroom over the verified baseline. Exact byte boundaries pass; exceeding a threshold fails CI.

## Consequences

The gate detects large relative regressions with deterministic input and no network. Wall-clock measurements still vary with runner load, JavaScript engine and hardware, so 2,000 ms is intentionally broad. The report is not a promise of browser latency, does not model remote fetch time or DOM extraction, and must not be used as a cross-device benchmark.
