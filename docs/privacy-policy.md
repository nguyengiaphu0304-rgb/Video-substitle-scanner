# Privacy Policy

Last updated: July 16, 2026

Video Subtitle Scanner is a local browser extension and companion web app for extracting accessible timed captions from the active video tab.

## Data Collection

Video Subtitle Scanner does not collect, sell, or share personal data with the developer, analytics providers, or a project-operated server.

The extension runs in the user's browser. Extracted subtitles, candidate caption URLs, and generated notes are shown locally in the extension popup. The user may copy or download those results.

When the user explicitly starts Advanced Scan and grants optional origin access, the extension may request caption resources discovered from the active page. Those requests go directly from the user's browser to the page's origin or content-delivery provider. That provider may observe normal request metadata such as the user's IP address, cookies and user agent. The extension does not redirect the response through a developer-controlled service.

## Permissions

The extension uses these Chrome permissions:

- `activeTab`: lets the extension inspect the currently selected tab after the user clicks the extension.
- `scripting`: lets the extension read accessible video caption tracks from the active tab.
- `clipboardWrite`: lets the extension copy extracted subtitles or notes when the user asks it to.
- Optional `debugger`: requested only after the user starts Advanced Scan, so the extension can inspect caption-related network responses for the active tab while attached. It is not granted at installation and is detached when the scan completes or fails.
- Optional site access: requested only when needed to fetch candidate caption resources discovered from the active tab. Requests use the user's existing browser credentials for that origin.

## Local Storage

The extension does not store extracted captions on a remote server. Browser clipboard and downloaded files are controlled by the user and remain on the user's device.

The companion web app has separate local development APIs. The Chrome extension does not send data to those APIs.

## Remote Code

The extension does not load or execute remotely hosted code. All extension logic is included in the submitted extension package.

## Contact

For support, open an issue on the project repository:

https://github.com/nguyengiaphu0304-rgb/Video-substitle-scanner
