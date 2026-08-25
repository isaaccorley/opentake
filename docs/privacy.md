# Privacy

OpenTake is designed to work without a backend, account, analytics service, or upload path.

## Stored locally

- Raw tab media in the browser's Origin Private File System (OPFS)
- Normalized cursor coordinates and click locations
- Opaque keypress timestamps, never the key values
- Scroll positions, viewport sizes, focus gaps, clock-alignment markers, and edit metadata
- The visible tab title used to identify a recording

## Never collected

- Key values or typed text
- Page text or form contents
- Browsing URLs or history
- Cookies, credentials, or account data

Export reads the local source and project document, renders frames on-device, and writes the selected MP4 or WebM file locally. Codec support checks call browser APIs and do not send media anywhere.

This document describes the intended contract for the early scaffold. A production release will add automated privacy regression tests and a permissions review before distribution.
