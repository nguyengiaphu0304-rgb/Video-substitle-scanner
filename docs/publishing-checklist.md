# Publishing Checklist

## Chrome Web Store

1. Run `npm run lint`.
2. Run `npm run typecheck`, `npm test`, `npm run demo:verify`, `npm run privacy:verify`, `npm run test:browser`, `npm run verify:extension`, `npm run build` and `npm run audit`.
3. Run `npm run pack:extension`, then `npm run verify:package` and `npm run budget`.
4. Verify the `.sha256` and `.manifest.json` sidecars in `dist/`, then upload only the ZIP to the Chrome Web Store Developer Dashboard.
5. Use the listing copy from `docs/chrome-web-store-listing.md`.
6. Provide a hosted privacy policy URL based on `docs/privacy-policy.md`.
7. Add at least one store screenshot and one 440x280 small promo tile.
8. In Privacy practices, disclose that the project does not collect user data, while Advanced Scan can request discovered caption resources directly from the active page's origin or CDN after optional access is granted.
9. Justify debugger access as an explicit user-started advanced caption scan.
10. Submit for review.

Automated Chromium and axe gates cover deterministic extension states. Before release, manually verify Chrome permission prompts, 200% zoom/reflow, keyboard operation and at least one screen reader; record only checks actually performed.

The Node.js packager is cross-platform and fails if `chrome-extension/` contains a symlink, a missing allowlisted file or an unexpected file. Identical source must produce identical ZIP bytes. Generated artifacts are CI outputs and are not committed.

The performance report is a reproducible-input regression gate. Record its runtime and artifact sizes, but do not compare timing across unlike hardware or describe it as end-user latency.

Follow `docs/manual-install-and-demo.md` for the unpacked-extension walkthrough. The committed demo fixture is synthetic and project-owned; never present it as evidence from a real provider or user video.

Useful official references:

- Chrome Web Store privacy fields: https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
- Chrome Web Store privacy policy requirements: https://developer.chrome.com/docs/webstore/program-policies/privacy
- Chrome Web Store image requirements: https://developer.chrome.com/webstore/images
- Chrome extension debugger API: https://developer.chrome.com/docs/extensions/reference/api/debugger

## Release Notes Template

### 1.0.0

- Use the verified release notes in `docs/releases/v1.0.0.md`.

## Public Support

Use GitHub Issues for bug reports and support requests:

https://github.com/nguyengiaphu0304-rgb/Video-substitle-scanner/issues
