# Photo Library

Per-player photos for the outcome reveal screen. Files are resolved at render time as:

```
assets/photos/<playerId>/<outcomeKey>.jpg
```

`<playerId>` matches the `id` field on a card (e.g. `kohli-bat`, `bumrah-bowl`, `hardik-pandya-bat`).

## Per batsman

Required outcome keys (one image per shot listed on the card, plus standardized dismissals/leaves):

- One file per scoring shot, named after the shot (e.g. `cover-drive-4.jpg`, `pull-6.jpg`, `flick-4.jpg`)
- `leave.jpg`
- `block.jpg`
- `bowled.jpg`
- `lbw.jpg`
- `caught-off-side.jpg`
- `caught-leg-side.jpg`
- `caught-straight.jpg`

## Per bowler

- `run-up.jpg` — bowler delivering
- `wicket-celebration.jpg` — bowler celebrating

## Fallbacks

When a specific player's photo is missing, the engine falls back to a watermarked stock image at:

```
assets/photos/_stock/<outcomeKey>.jpg
```

All stock fallbacks should carry a small watermark so they're visually distinguishable from real player photos.
