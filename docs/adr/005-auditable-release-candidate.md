# ADR-005: Auditable release candidate

## Status

Accepted on July 16, 2026.

## Context

The extension needs a v1.0.0 candidate whose permissions, executable network surface and documentation can be checked in CI. Static automation cannot truthfully complete manual permission-prompt, privacy, reflow or assistive-technology observations.

## Decision

- Keep broad origin access and `debugger` optional.
- Fail CI if the permission contract drifts, required host access appears, executable code adds remote-code primitives or fixed network endpoints, or package and manifest versions disagree.
- Permit one dynamic `fetch(url, ...)` path for caption resources discovered during Advanced Scan.
- Generate a deterministic privacy report with source hashes and all manual checks marked `pending`.
- Treat v1.0.0 as a release candidate until human-observed gates are recorded and the final merge commit is tagged.

## Consequences

The check is intentionally conservative and may require an explicit ADR update for a legitimate new network capability. Source inspection reduces accidental permission or endpoint drift, but it does not prove runtime privacy behavior and cannot replace a manual browser review.
