# Threat model

## Protected assets

- Browsing activity and authenticated page content.
- Extracted captions and notes.
- Browser stability and extension responsiveness.

## Controls

- No remote code, analytics, cloud upload or embedded credentials.
- `activeTab` and `scripting` activate only after user interaction.
- Host and debugger permissions are optional runtime grants.
- Candidate traversal is capped at 250 URLs; each caption body is capped at 2 MiB.
- Non-HTTP(S) origins are rejected by the popup permission request.
- Metadata-only bodies, invalid timing and oversized payloads fail closed.

## Residual risks

- A debugger session can observe caption-related response bodies from the active tab while attached.
- Site changes, DRM, inaccessible shadow roots and proprietary streaming formats can prevent extraction.
- Candidate URL heuristics may miss captions or inspect a text-like non-caption response.
- The companion Next.js app expands the dependency and server-side attack surface; every release must pass the dependency audit and deployment-specific review.
