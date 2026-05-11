# Publishing Checklist

## Chrome Web Store

1. Run `npm run lint`.
2. Run `npm run build`.
3. Run `npm run pack:extension`.
4. Upload the ZIP from `dist/` to the Chrome Web Store Developer Dashboard.
5. Use the listing copy from `docs/chrome-web-store-listing.md`.
6. Provide a hosted privacy policy URL based on `docs/privacy-policy.md`.
7. Add at least one store screenshot and one 440x280 small promo tile.
8. In Privacy practices, disclose that no user data is collected or transmitted.
9. Justify debugger access as an explicit user-started advanced caption scan.
10. Submit for review.

Useful official references:

- Chrome Web Store privacy fields: https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
- Chrome Web Store privacy policy requirements: https://developer.chrome.com/docs/webstore/program-policies/privacy
- Chrome Web Store image requirements: https://developer.chrome.com/webstore/images
- Chrome extension debugger API: https://developer.chrome.com/docs/extensions/reference/api/debugger

## Release Notes Template

### 0.2.0

- Generalized branding from site-specific caption extraction to Video Subtitle Scanner.
- Added extension icons and Chrome Web Store metadata preparation.
- Reduced broad site access by moving it to optional runtime requests.
- Added local privacy policy, listing draft, and packaging script.
- Improved popup layout, status feedback, and download filenames.

## Public Support

Use GitHub Issues for bug reports and support requests:

https://github.com/nguyengiaphu0304-rgb/Video-substitle-scanner/issues
