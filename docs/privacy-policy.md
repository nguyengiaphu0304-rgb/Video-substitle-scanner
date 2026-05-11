# Privacy Policy

Last updated: May 11, 2026

Video Subtitle Scanner is a local browser extension and companion web app for extracting accessible timed captions from the active video tab.

## Data Collection

Video Subtitle Scanner does not collect, sell, transmit, or share personal data with the developer or any third party.

The extension runs in the user's browser. Extracted subtitles, candidate caption URLs, and generated notes are shown locally in the extension popup. The user may copy or download those results.

## Permissions

The extension uses these Chrome permissions:

- `activeTab`: lets the extension inspect the currently selected tab after the user clicks the extension.
- `scripting`: lets the extension read accessible video caption tracks from the active tab.
- `clipboardWrite`: lets the extension copy extracted subtitles or notes when the user asks it to.
- `debugger`: used only when the user starts Advanced Scan, so the extension can inspect caption-related network responses for the active tab.
- Optional site access: requested only when needed to fetch candidate caption resources discovered from the active tab.

## Local Storage

The extension does not store extracted captions on a remote server. Browser clipboard and downloaded files are controlled by the user and remain on the user's device.

## Remote Code

The extension does not load or execute remotely hosted code. All extension logic is included in the submitted extension package.

## Contact

For support, open an issue on the project repository:

https://github.com/nguyengiaphu0304-rgb/Video-substitle-scanner
