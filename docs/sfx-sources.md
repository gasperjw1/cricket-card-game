# SFX sourcing guide

The game ships with the SFX module wired up but no audio files yet. Drop
WebM files into `client/public/sfx/` matching the names below and they
appear in-game with no further code changes (graceful fallback handles
missing files).

## Files needed (10 total, ~150-300KB combined)

| Filename | Plays during | Suggested length | Description |
|----------|--------------|-----------------|-------------|
| `bat-thwack-light.webm` | dot/1/2-run shots | 0.3-0.6s | Dull cricket-bat hit |
| `bat-thwack-heavy.webm` | 4s and 6s | 0.4-0.8s | Crisp/sharp cricket-bat hit |
| `stumps-shatter.webm` | bowled / stumped wickets | 0.5-1.0s | Wood crack + bail clatter |
| `glove-catch.webm` | caught-keeper dismissal | 0.3-0.6s | Leather slap / glove smack |
| `crowd-cheer.webm` | 4/6/wicket-celebration | 1.5-2.5s | Stadium cheer (medium intensity) |
| `crowd-gasp.webm` | wicket dismissals | 1.0-1.5s | Sudden hush + collective "ooh" |
| `umpire-whistle.webm` | no-ball / wide / DRS | 0.2-0.5s | Sharp whistle blast |
| `card-flip.webm` | reveal animation start | 0.2-0.4s | Paper flick / playing-card flip |
| `timer-tick.webm` | last 5s of pick window | 0.15s (loopable) | Single clock tick (urgent) |
| `match-end-sting.webm` | match-over screen | 1.5-3s | Celebratory drum roll / fanfare |

## Free, license-clear sources

### 1. Mixkit (mixkit.co/free-sound-effects)
- No attribution required, no signup
- Search: "cricket bat", "stadium crowd", "wood break", "whistle"
- Download as MP3, convert to WebM (see below)

### 2. Pixabay Sound Effects (pixabay.com/sound-effects)
- Free, no attribution
- Search: "bat hit", "applause", "crack", "cheer"

### 3. Freesound.org
- Filter by license: "Creative Commons 0" (CC0) for no-attribution use
- Higher-quality / more variety than Mixkit
- Requires a free signup

### 4. Zapsplat (zapsplat.com)
- Free tier with attribution required
- High quality, broad library

## Format conversion

Browsers prefer WebM/Opus for audio (smallest, broadly supported on
modern mobile). If you only have MP3/WAV, convert with ffmpeg:

```bash
# One file
ffmpeg -i input.mp3 -c:a libopus -b:a 64k output.webm

# Batch (every .mp3 in current dir)
for f in *.mp3; do
  ffmpeg -i "$f" -c:a libopus -b:a 64k "${f%.mp3}.webm"
done
```

64 kbps Opus is plenty for short SFX and keeps each file ~30-60KB.

## Where to drop them

```
client/public/sfx/
├── bat-thwack-light.webm
├── bat-thwack-heavy.webm
├── stumps-shatter.webm
├── glove-catch.webm
├── crowd-cheer.webm
├── crowd-gasp.webm
├── umpire-whistle.webm
├── card-flip.webm
├── timer-tick.webm
└── match-end-sting.webm
```

Vite serves anything under `client/public/` at the root URL — so
`/sfx/bat-thwack-light.webm` resolves automatically. No imports needed.

## Testing

After dropping files in:

1. `npm --prefix client run dev`
2. Open http://localhost:5173
3. Tap "Play vs CPU" (this initializes the audio pool — iOS needs the user gesture)
4. Play through a few balls and listen for the SFX
5. Toggle Settings → Sound effects: Off, confirm silence
6. Toggle back: On, confirm sounds resume

If a file is missing or the wrong format, the game silently skips it —
no broken state. Check the browser dev tools Network tab for 404s on
`/sfx/*.webm` to spot which files are missing.

## Recommended sourcing time

~30-45 minutes total if you batch through Mixkit. I'd grab the
crowd-cheer + crowd-gasp + bat-thwacks first — those are the most
impactful for the "feels alive" payoff. Stumps + signals can come later.
