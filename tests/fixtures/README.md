# Media fixtures

`synthetic.webm` is a two-second, 320×180 synthetic color pattern with a generated 660 Hz tone. It contains no captured or personal data. Its streams are VP9 video at 30 fps and mono Opus audio at 48 kHz.

SHA-256: `f28d00f04e6892214e85e7f65fea54bcd2d771139eebd87e0ea9546ebdfb5574`

Regenerate it with FFmpeg 9 or newer:

```sh
ffmpeg -f lavfi -i 'testsrc2=size=320x180:rate=30' \
  -f lavfi -i 'sine=frequency=660:sample_rate=48000' -t 2 \
  -c:v libvpx-vp9 -b:v 250k -c:a libopus -b:a 64k \
  -metadata title='OpenTake synthetic test fixture' synthetic.webm
```

Renderer golden-frame tests will use this recording when the compositor lands.
