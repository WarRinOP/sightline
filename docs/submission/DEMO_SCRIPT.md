# Demo script: the 240-second Stage 1 video (DRAFT 1, 2026-10-02)

Status: **draft for the team to edit and record.** Structure set by the team lead on 2026-10-02; it
differs from the split in `docs/MASTER_PLAN.md` §4.3 (which has the demo at 1:10 to 2:40). Target:
submit the night of **6 October** (Stage 1 is reported as due 7 October; the exact time and the video
format are not yet confirmed with the organizers, task S1-00).

## Rules for every shot

1. **Show only what is real.** Every screen is the running page or a document in this repository.
   No mock, no mock-up, no concept art. If a feature is not built, say it is not built.
2. **No NASA logo, meatball, worm or insignia** anywhere. NASA is credited in text only. Do not use
   NASA photographs or video unless the team lead has checked their credit line and that no logo is
   visible.
3. **People.** Anyone under 18 must not appear or be heard. Credits are text only. The team lead
   decides who is named.
4. **Say a number only if it is in the table below**, with its definition. Do not read live values
   from the page aloud (the readouts change every moment); read the fixed statistics.
5. **Do not say "validated at the sites".** No published value exists for these exact points
   (`docs/science/METHODS.md` §7). Say "checked".

## Numbers you may say

| Say | Value | Definition and source |
|---|---|---|
| Sun's height | "within about three degrees of the horizon" | Sun's centre over 2026 at the three sites, METHODS §5 |
| Shadow length | "one kilometre of relief throws about 38 kilometres of shadow at 1.5 degrees" | Arithmetic: 1 km / tan(1.5°) = 38.2 km |
| Shackleton Rim crest | 85.8 % average disk visible; longest day 115.8 d; longest night 185.8 d | 2026, hourly, 2 m mast; day and night with the Sun's centre above the horizontal; engine, METHODS §6 and §7 |
| Connecting Ridge | 45.6 % | same |
| de Gerlache Rim | 54.0 % | same |
| Old Shackleton position | on a wall about 32 degrees steep; Sun visible 11 % of 2026, Earth never | `docs/progress/DECISIONS.md` D-023 (not in the app any more; show the document) |
| Mast | Connecting Ridge 36 % at ground level, 48 % at 2 m | mean disk visible, 2024 to 2026, METHODS §7 |
| JPL Horizons | 300 comparisons; Sun 3.3e-8 degrees (0.0001 arcsecond); Earth 2.65e-5 degrees (0.095 arcsecond); limit 0.02 degrees, 755 times larger | `fixtures/golden/horizons_residuals.json`, METHODS §5.1 |
| Barker et al. 2021 | at their seven Site 1 regions ours is 74 to 85 % at 1 m and 83 to 91 % at 5 m, consistent with their published values by criteria fixed before the run | METHODS §7, D-025 |
| AVGVISIB map | rank correlation 0.95 over 900 random points | METHODS §7 |

## Storyboard and voice-over

Voice-over at about 2.5 words a second. The narration below is **474 words (about 190 seconds)**,
which leaves about 50 seconds of silence for the on-screen text and the demo.

### 0:00 to 0:40, the problem and the hook (96 words)

**On screen.** Black. Title card: "SIGHTLINE" and the line *Know when the Sun shines and Earth listens,
anywhere on the Moon's south pole.* Then a plain diagram drawn for the video (a low Sun, a ridge, a
long shadow, the label "1.5° → 38 km per km of relief"; it is arithmetic, say so in a small caption).
Then a screen capture of the real page, readout area only, showing a Sun elevation of a degree or so.
Last 5 seconds: a text card "Earth is within about 10° of the horizon too".

**Voice-over.**

> The Moon's south pole is where the next landers are heading, and choosing a site is hard. The Sun
> never climbs more than a few degrees above the horizon, so every ridge throws a long shadow: one
> kilometre of relief shadows about thirty-eight kilometres of ground. Earth sits near the horizon
> too, so a crater wall can cut a lander off from direct contact. Power and a line home depend on
> every hill in every direction. We built SIGHTLINE to answer that with real NASA data, and to show
> how far you can trust the answer.

### 0:40 to 1:30, the science engine (99 words)

**On screen.** The architecture diagram from the README (screenshot of the rendered Mermaid chart on
GitHub). Then a terminal capture of `sightline horizon` finishing and printing the three sites'
mask summaries, then of `pnpm verify` ending green. Keep each under 8 seconds. Then the README table
"What works today", with the "Not built yet" column visible.

**Voice-over.**

> SIGHTLINE starts from NASA's laser-altimeter terrain: five-metre maps of three sites, joined to an
> eighty-metre map out to three hundred kilometres. Sun and Earth positions come from NASA's SPICE
> ephemerides, in the Moon's own frame. A Python pipeline casts rays across the terrain every quarter
> of a degree and keeps, for every direction, the highest skyline for any mast height. A TypeScript
> engine, running in your browser, compares the Sun and the Earth with that skyline, hour by hour
> through 2026. Nothing is fetched from NASA while you use it, and anything not computed is left
> blank and labelled.

### 1:30 to 2:30, the live demo and three sites (117 words)

**On screen.** Screen capture of the real page at `http://localhost:3000` (from `pnpm dev`; **pause
playback first**, because the readout otherwise advances 10 hours a second). Pick **Shackleton Rim
crest** and scroll to the "illumination, as published studies define it" row (85.8 %) and the lander
row (115.8 d). Click **Connecting Ridge** (45.6 %), then **de Gerlache Rim** (54.0 %). Then cut to
`docs/progress/DECISIONS.md` D-023 on screen, the passage about the old tile centre on the crater wall
(caption: "an earlier position, from our decision log; not in the app"). Last, back to the page for
the note under the tiles that ends "the values at these three sites are not themselves published".

**Voice-over.**

> Here is the live page. At the crest of Shackleton's rim, the Sun's disc is visible eighty-six
> percent of the year on average, and the longest unbroken day, with the Sun above the horizontal, is
> one hundred and fifteen days. Connecting Ridge: forty-six percent. de Gerlache: fifty-four. These
> are positions in NASA's terrain tiles, not landing sites. Terrain matters. The tile centre we first
> picked for Shackleton sits on a crater wall about thirty-two degrees steep: from there the Sun shows
> only eleven percent of the year, and Earth never. Height matters too: a two-metre mast lifts
> Connecting Ridge from thirty-six to forty-eight percent. And the page says which numbers have been
> checked and which have not.

### 2:30 to 3:30, evidence and proof (114 words)

**On screen.** Three cards, about 15 seconds each, then a closing card. (1) The Horizons table from
`docs/science/METHODS.md` §5.1, with the two bold figures (Sun, Earth) and "limit 0.02°". (2) The
Barker et al. comparison: the seven-row table from METHODS §7. (3) The AVGVISIB result: the line
"Spearman rank correlation 0.95, 900 points" and the per-tile figures. Closing card, plain text, 8
seconds: **"What we have not shown: a published value at these exact sites. The Earth link is not yet
checked."**

**Voice-over.**

> We check the engine three ways. Against JPL Horizons, an independent ephemeris service: three
> hundred comparisons. The largest gap for the Sun is about a ten-thousandth of an arcsecond; for
> Earth, ninety-five thousandths, against a limit we set beforehand that is over seven hundred times
> larger. Against a published method, the two thousand twenty-one illumination study by Barker and
> colleagues: at their seven regions our averages are consistent with their published values, by
> criteria fixed before we ran it. And against NASA's published average-illumination map: nine hundred
> random points, rank correlation point nine five. What we have not shown: a published value at these
> exact sites, and the Earth link is not yet checked.

### 3:30 to 4:00, roadmap and the team (48 words)

**On screen.** The README "What works today" table again, then a text-only credits card (names as the
team lead decides, GitHub handles, roles; data credits: NASA LRO/LOLA, PGDA, NAIF, JPL Horizons, PDS;
"No NASA logos used; NASA credited in text only"), then the repository address.

**Voice-over.**

> This is Stage 1. The engine, the pipeline and a working page are built and open on GitHub. Next: a
> three-dimensional terrain view, an evidence page, a landing-window finder, and the Earth-link
> check. We are entering through the Bangladesh local event. SIGHTLINE: open code, open data, honest
> numbers.

## Capture checklist (for whoever records the screen)

- `pnpm install && pnpm dev`, a browser at 1920 x 1080, zoom 100 %. Pause the readout before
  recording. Do not record while the console shows an error other than the missing favicon.
- Run `pnpm verify` and `uv run --project pipeline sightline horizon` once beforehand so the
  terminal captures are clean (a few minutes; no downloads needed once `data/raw/` is filled).
- Record the architecture diagram from GitHub's rendering of `README.md`, not from an editor preview.
- Check the three site statistics on screen against the table above before recording. If the page and
  the table disagree, the table is right and the page has a bug: tell Dev 1.

## Open items for the team lead

1. **Video format, length limit and where to submit** (S1-00): not yet confirmed with the organizers.
2. **Team registration** on nasaspaceappsbd.com (P0-14) is still open; the last line says "entering
   through the Bangladesh local event". Change it if the facts differ when you record.
3. **Credits.** Who is named, and whether anyone under 18 is on the team (they must not appear or be
   heard).
4. **"100-kilometre shadows."** The brief's version of the opening said so; I have no source for
   that, so the script uses the arithmetic (38 km per kilometre of relief at 1.5°). Give me a source
   if you want it back.
5. **The Link figures** (49.9, 39.8 and 53.8 %) are on the page but have no published reference
   compared (S1-05h). The script does not say them. If you want them in the video, say "not yet
   checked" next to them.
6. **Not shown, on purpose:** any 3D terrain, scrubber, Evidence page, window finder or AI analyst:
   none is built.
