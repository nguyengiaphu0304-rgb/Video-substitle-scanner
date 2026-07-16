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
- The page origin or its CDN can observe normal request metadata when Advanced Scan fetches a discovered caption resource with the user's browser credentials.
- Static privacy inspection can detect known source patterns and permission drift but cannot prove runtime behavior.
- Site changes, DRM, inaccessible shadow roots and proprietary streaming formats can prevent extraction.
- Candidate URL heuristics may miss captions or inspect a text-like non-caption response.
- The companion Next.js app expands the dependency and server-side attack surface; every release must pass the dependency audit and deployment-specific review.
