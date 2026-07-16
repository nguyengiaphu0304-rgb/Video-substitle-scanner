# ADR 002: Deterministic extension packaging

## Status

Accepted

## Context

The original release script called PowerShell `Compress-Archive`. That made packaging unavailable on a clean Linux or macOS checkout and left file order, timestamps and permissions to the host archive tool. A store reviewer or contributor could not prove that two archives came from identical source.

## Decision

Use a dependency-free Node.js ZIP32 writer with stored entries. The packager recursively inspects the extension directory, rejects symlinks and anything outside an explicit file allowlist, and sorts POSIX-style paths. Every entry uses the earliest DOS timestamp, mode `0644`, UTF-8 names and CRC-32. The command also writes a SHA-256 sidecar and canonical JSON manifest.

CI rebuilds the ZIP, compares it with the canonical source representation and uploads the three generated artifacts. Generated packages remain ignored by Git.

## Consequences

- Any supported Node.js host produces identical bytes for identical source.
- The allowlist makes accidental inclusion of logs, source maps or credentials fail closed.
- Stored ZIP entries are larger than deflated entries. The extension is small, and reproducibility plus zero packaging dependencies is the preferred trade-off.
- ZIP64 is intentionally unsupported. Individual files above 16 MiB and archives above 64 MiB fail before ZIP32 becomes relevant.
- Releasing still requires a human Chrome Web Store upload and manual browser/privacy review.
