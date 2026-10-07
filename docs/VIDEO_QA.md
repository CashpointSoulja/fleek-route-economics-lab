# Demo video QA

Checks I ran on the delivered desktop-width MP4 (2026-10-07). These are my own checks, not independent review.

| Check | Method | Result |
|---|---|---|
| Format | ffprobe | 1080×1920, 30 fps, H.264 video, AAC audio, 85.55 s (target 75–95 s) |
| Desktop capture, both routes in one view | 14 frames taken across the timeline | Wide shots at about 12 s, 30 s and 44 s show Route A and Route B cards side by side at desktop layout |
| Required content | same frames | Both routes, sensitivity table and sweeps, cash timing, the Evidence gap Route B "Blocked: evidence gap, no scale recommendation" verdict and gate list, blocked scale card, footer disclaimer |
| Zoom readability | full-resolution frame at 17 s | Route B KPI cards and waterfall readable at full width; zoom targets sized to fit the frame, so no target text is clipped |
| Captions | frames | Whole phrases, at most two lines, never cut mid-phrase |
| Dead screens | `ffmpeg freezedetect` (noise 0.001, 2 s) | No black or blank frames. Two near-static holds were flagged where only the slow drift moves: 71.7–74.2 s (decision log) and 82.4–84.8 s (footer close) |
| Metadata | ffprobe tags | Title only; no author, tool or path tags |

**No listening check.** I have not listened to the narration end to end, so pronunciation, pacing and audio quality are unverified. Only the duration and stream format are confirmed.

## Limitations
- Wide shots of the full desktop page are small at phone size. They establish the side-by-side layout; the zooms carry the readable detail.
- Case changes use the native select. Its dropdown list is not drawn in headless capture, so the video shows the click and then the new case.
- The cursor and click ripples are drawn afterwards, not recorded as real OS pointer movement. The page states, scrolling and case switches are real app interactions.
- The browser window is 2428 CSS px tall, much taller than a normal desktop window, so each shot shows more of the page at once.
- Two near-static holds of about 2.5 s, noted above.
