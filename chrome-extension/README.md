# Knowledge Caption Extractor

This local Chrome extension runs inside the currently open video tab and tries to extract timed captions directly from the page.

## Install

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder:

   `C:\Users\trann\.codex\skills\lecture-record\chrome-extension`

## Use

1. Open the Knowledge video page and sign in.
2. Turn on **CC** in the video player.
3. Play the video for a few seconds.
4. Click the extension icon.
5. Click **Extract From This Tab**.
6. If captions are exposed by the player, the extension copies SRT text to your clipboard and shows it in the popup.
7. Click **Download SRT** or paste the result into the app's **Import captions** section.

If it cannot extract the caption text, it copies candidate caption URLs. Those URLs can be inspected to identify the real caption resource.
