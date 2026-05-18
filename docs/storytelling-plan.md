# Storytelling — Phase 2 Plan

> **Status (v4): Phase 1 + emoji art shipped.** Story-sequence wiring
> is live (pitch → bowler → batter → result stages, ~2-4s total with a
> user-controllable speed setting). SFX hooks fire per stage but the
> actual `.webm` files still need to be sourced — see
> [sfx-sources.md](sfx-sources.md). Real-photo asset library is
> backlogged; see [todo.md](todo.md).

This doc lays out the art-direction and asset-sourcing plan for the
result-screen storytelling sequence. Phase 1 (emoji-placeholder
skeleton) is shipped; Phase 2 turns the placeholders into real
illustrations.

---

## 1. Where we are

**Phase 1 (shipped — commit `cead5ce`):** Story sequence runs as a
pre-roll inside `RevealOverlay`. Emoji placeholders for every stage,
~2.3-3.8s total per ball, skip button works. The state machine in
[useStorySequence.ts](../client/src/components/story/useStorySequence.ts)
detects which conditional stages apply to each ball.

**Phase 2 (this doc):** Source illustrations and wire them in.

**Phase 3 (later):** Polish — preloading optimizations, special-case
animations for Mankad/Cramps/Retired Out, audio cues if desired.

---

## 2. Art direction — three viable styles

Pick ONE. All three work for AI-generated assets in a consistent style.

### A. Modern flat illustration ⭐ recommended for default
Clean shapes, limited palette, minimal gradients. Think Instagram
illustrators, Apple's vector iconography, Headspace app aesthetic.
- ✅ Reads instantly even at small sizes (mobile-first wins)
- ✅ AI generators handle this style very consistently
- ✅ Broadly appealing, doesn't lean kid-only or sports-bro
- ⚠️ Less dramatic than action-focused styles

### B. Comic book / cel-shaded
Bold outlines, dynamic action lines, halftone shading. Sports manga
energy (think *Major*, *Cricket 24* loading screens).
- ✅ Most dramatic for sport — captures the *moment* of a wicket
- ✅ Great for the "wow" feel we're going for
- ⚠️ Can feel intense for very casual players
- ⚠️ Slightly harder to keep consistent across 40+ images

### C. Children's-book / soft watercolor
Hand-painted look, warm palette, friendly. Studio Ghibli-adjacent.
- ✅ Most welcoming, broadest demographic reach
- ✅ Forgives AI inconsistencies (looks intentional)
- ⚠️ Less dramatic than B; less crisp than A on small screens

**My recommendation:** Start with **A (modern flat)**. Cheapest to
iterate, reads on every screen size, and you can always re-source in
style B/C later if A feels flat. Commit on a single style and stick
to it across all 41 images — mixing styles looks amateur.

---

## 3. Critical art constraint: no faces

Every illustration should be from **side, back, or low-angle view** with
the player's face obscured by a helmet grille, cap brim, or shadow.
Reasons:
- **AI consistency** — keeping the same face across 40+ images is hard;
  anonymous figures sidestep the problem entirely.
- **Likeness liability** — the cards reference real players; the result
  images must NOT look like specific people (could be IP issues for a
  game that ships on Messenger).
- **Inclusivity** — players of all backgrounds project onto the
  generic figure.

For umpires: traditional white coat, white sunhat, side angle. No face.

---

## 4. Complete asset list — 41 images for v1

| Category | Count | IDs |
|----------|-------|-----|
| Pitches | 2 | `regular`, `day-5` |
| Bowlers (archetypes) | 6 | `pace-rh`, `pace-lh`, `off-spin`, `leg-spin`, `la-orthodox`, `la-wrist` |
| Shots (per ShotCategory) | 18 | `drive-straight`, `drive-cover`, `drive-off`, `cut`, `late-cut`, `pull`, `flick`, `glance`, `sweep`, `reverse-sweep`, `loft-straight`, `loft-off`, `loft-leg`, `slog`, `ramp`, `scoop`, `defend`, `mistime` |
| Dismissals (per DismissalCategory) | 11 | `bowled`, `lbw`, `caught-keeper`, `caught-slip`, `caught-cover`, `caught-midwicket`, `caught-point`, `caught-deep`, `caught-and-bowled`, `stumped`, `runout` |
| Umpire signals | 4 | `no-ball`, `wide`, `six`, `out` |

Phase 3 adds ~5 more for special situations (DRS T-signal, Mankad,
Cramps, Retired Out, Biryani umpire).

---

## 5. Tooling — Midjourney v7 (recommended)

| Tool | Cost | Pros | Cons |
|------|------|------|------|
| **Midjourney v7 standard plan** ⭐ | $30/mo | Best quality, character refs (`--cref`), unlimited relaxed mode, easy iteration | Discord-based UI |
| DALL-E 3 (API) | ~$0.04-0.08/img | Direct API, scriptable | Less consistent style across batches |
| Leonardo.ai | $12/mo | Custom-trained character models | Lower max quality |
| Stable Diffusion (local) | Free (need GPU) | Full control, character LoRA | Setup overhead, lower quality without tuning |

**Recommended path:** Midjourney $30 plan for one month. Generate all
41 images with iteration headroom, cancel after.

---

## 6. Prompt template

The shared prompt skeleton — vary the bracketed `[ACTION]` per image.

```
Cricket [BATTER / BOWLER / FIELDER / UMPIRE] [ACTION].
Side angle view, helmet grille obscuring face, plain white kit.
Modern flat illustration style, limited palette of [GREEN, WHITE,
NAVY, OCHRE], bold shapes, minimal gradients, soft drop shadows.
1:1 aspect ratio, plain green field background. --ar 1:1 --v 7
```

### Example prompts

**`drive-cover`** (a cover drive):
> Cricket batter playing a classic cover drive. Side angle view,
> helmet grille obscuring face, plain white kit. Bat extended through
> the line of the ball at knee height, weight transferred onto front
> foot, classical textbook stance. Modern flat illustration style,
> limited palette of greens, whites, navy, ochre, bold shapes,
> minimal gradients. 1:1 aspect ratio, plain green field background.

**`bowled`** (the dismissal):
> Cricket stumps shattering as the ball strikes them, bails flying
> through the air. Wicketkeeper crouched in background, hands raised
> in celebration. Modern flat illustration style, limited palette,
> dynamic action moment. 1:1 aspect ratio, plain green field
> background.

**`pace-rh`** (right-arm pace bowler):
> Cricket bowler mid-delivery, right-arm pace, ball about to leave
> hand, body rotated through. Side angle, cap obscuring face, plain
> white kit. Modern flat illustration style, bold shapes. 1:1 aspect
> ratio, plain green field background.

**`umpire-wide`**:
> Cricket umpire signalling wide ball, both arms extended horizontally
> straight out from shoulders. Traditional white coat, white sunhat,
> side angle. Modern flat illustration style, plain green field
> background. 1:1 aspect ratio.

---

## 7. Workflow

**Step 1: style validation (1 hour)**
- Generate `drive-cover` in all 3 candidate styles (A, B, C)
- Pick the winner, lock the prompt skeleton

**Step 2: bulk generation (~6 hours over a weekend)**
- Generate all 41 images, 3-5 candidates per asset
- Pick best of each batch

**Step 3: post-processing (~1 hour)**
- Crop to consistent 1:1 aspect ratio (Midjourney sometimes adds borders)
- Convert to WebP at 80% quality (~30-60KB per image)
- Total bundle: ~2-3MB for all 41 images

**Step 4: drop into app**
- Save to `client/public/story/` in subfolders matching the
  [imageMap.ts](../client/src/components/story/imageMap.ts) categories
- The wire-up I'm building in this PR auto-detects the files via the
  `<img>` `onError` fallback to emoji
- Hard-refresh, watch the story play with real images

---

## 8. What's getting built in this PR (alongside this doc)

So that the moment you drop images into `client/public/story/`, the
game uses them with zero further code changes:

1. **`client/src/components/story/imageMap.ts`** — canonical map from
   `ShotCategory` / `DismissalCategory` / `BowlerArchetype` etc. to
   image paths under `/story/...`.
2. **`<StoryImage>` component** — renders the image if present, falls
   back to the emoji placeholder if the file is missing or fails to
   load. (No 404 noise during development.)
3. **Image preloader** — preloads all story images on `InningsScreen`
   mount via hidden `<link rel="prefetch">` tags, so the first reveal
   isn't a flash of placeholders.
4. **Story preview screen** at `?preview=story` — a QA tool that walks
   through all 41 stages with hardcoded inputs so you can audit assets
   as they arrive without playing actual matches.

---

## 9. Cost + timeline summary

| Item | Cost | Time |
|------|------|------|
| Midjourney standard plan (1 month) | $30 | n/a |
| Style validation | $0 | 1 hour |
| Bulk generation (41 images, 3-5 candidates each) | $0 (within plan) | 6 hours |
| Post-processing + organize | $0 | 1 hour |
| In-app testing + iteration | $0 | 1-2 hours |
| **Total** | **$30** | **~10 hours over a weekend** |

---

## 10. Decisions to confirm before generation begins

1. **Art style** — A (modern flat), B (comic), or C (watercolor)?
2. **Tool** — Midjourney $30 plan, or do you have access to another generator?
3. **Faces hidden** — confirm the helmet/back-angle constraint is OK?
4. **Scope** — 41 images for v1, or trim somewhere? (e.g. skip the
   3 individual `loft-*` variants and use one generic `loft`?)
5. **Asset organization** — `client/public/story/{pitches,bowlers,shots,dismissals,signals}/` OK?

Once you've decided, the wire-up shipping in this PR means dropping a
WebP into the right folder is the only step needed to make it appear
in-game.
