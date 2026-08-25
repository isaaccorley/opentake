# Releasing OpenTake

OpenTake has two distribution paths: GitHub developer builds for manual local installation, and the Chrome Web Store for normal one-click installation and automatic updates.

## Readiness gate

Do not submit the current scaffold to the Chrome Web Store yet. Complete and verify these items first:

- Production tab recording, editing, preview, MP4 export, and WebM export.
- End-to-end recovery tests for interrupted recordings and extension service-worker restarts.
- Extension icons and Chrome Web Store screenshots and promotional artwork.
- A public URL for the privacy policy, plus an in-product disclosure and consent review.
- Chrome Web Store data-use declarations and narrow permission justifications matching actual behavior.

## Publish a GitHub developer build

The package version is the single source of truth for both `package.json` and the generated extension manifest. Choose a semantic version and update it without creating npm's automatic tag:

```sh
pnpm version patch --no-git-tag-version
pnpm check
git add package.json pnpm-lock.yaml
git commit -m "chore: release vX.Y.Z"
git tag vX.Y.Z
git push origin main vX.Y.Z
```

Replace `X.Y.Z` with the version written by `pnpm version`. The tag must match it exactly. The release workflow runs all gates, builds the extension, creates `opentake-vX.Y.Z.zip` with `manifest.json` at the archive root, generates a SHA-256 checksum, and attaches both files to a GitHub release.

Users download and extract that ZIP, open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the extracted folder.

## Publish to the Chrome Web Store

1. [Register a Chrome Web Store developer account](https://developer.chrome.com/docs/webstore/register/), pay Google's one-time registration fee, and enable two-step verification on the publisher account.
2. Complete the extension and pass the readiness gate above.
3. Create a release version and [upload its ZIP in the Chrome Web Store Developer Dashboard](https://developer.chrome.com/docs/webstore/publish).
4. Complete the Store Listing, Privacy, Distribution, and Test instructions tabs. State the extension's single purpose, justify every permission, and [disclose all handled data even when processing stays on-device](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq).
5. Supply the [required listing assets](https://developer.chrome.com/docs/webstore/cws-dashboard-listing): a 128 x 128 icon, at least one 1280 x 800 screenshot, and a 440 x 280 small promotional tile.
6. Start with trusted testers if useful, then submit the item for review.
7. After approval, replace the README developer-build button with the [official Chrome Web Store badge](https://developer.chrome.com/docs/webstore/branding) linked to the listing.

The Web Store listing is the supported route for a true one-click **Add to Chrome** button and automatic updates on ordinary Chrome installations.
