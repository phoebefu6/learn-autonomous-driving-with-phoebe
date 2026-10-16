# Agent brief - shared by every fan-out page of learn-autonomous-driving-with-phoebe

Filled from `~/.claude/skills/course-builder/references/agent-brief.template.md` on 2026-10-16, plus the
emrg family rule for a5/a6 (`course-estate-audit/briefs/two-track-emrg-overrides.md`). Internal build
document: never linked from an audience page.

You are writing ONE static HTML session page. No servers, no npm. **If your target file already
exists on disk, do not write it; report that and stop.** Write the file, return its path and one
line of coverage. No HTML in your reply.

Repo: `/Users/phoebe.fu/Documents/claude_work/github_repo/learn-autonomous-driving-with-phoebe`

## Read first, in this order

1. The template page for YOUR track. Copy its structure, classes, SVG grammar and quiz markup
   EXACTLY, including 3 options per question:
   - Leader track (a2-a6): `<repo>/courses/a1-the-car-is-a-data-pipeline.html`
   - Practitioner track (p2-p9): `<repo>/courses/p1-anatomy-of-a-drive-log.html`
   - Pages that use the engine (p7, p8, and a3 if it adds the miles calculator): also read
     `<repo>/courses/p10-the-prove-it-safe-bench.html` for the widget pattern and `<repo>/assets/av-live.js`
     for the API (`AV.ladder(opts)`, `AV.poissonUpper(k, conf)`, `AV.ffUpper`, `AV.rareEstimate`,
     `AV.selfTestResult`). Load order: `../assets/av-live.js?v=1` then `../assets/app.js?v=1`.
2. The source map: every verified number, its evidence tier, per-session coverage, the seams, the canon.
   Use ONLY its numbers; never invent a statistic; if a fact is missing, teach the uncertainty.
   `<repo>/materials/official-course-map.md`
3. The stylesheet `:root` block for the palette tokens: `<repo>/assets/style.css` (first 30 lines).

## Page skeleton (keep every component, in the order the template page has them)

toolbar (crumb EXACTLY `<a href="../index.html">learn-autonomous-driving-with-phoebe</a> / Leader session N of 6`
or `/ Practitioner session N of 10`, #toggle-all, #zoom-toggle) · masthead (eyebrow
"Learn Autonomous Driving with Phoebe · Leader session N of 6" or "· Practitioner session N of 10", h1 with
one `<span class="accent">`, .sub, .chip-row with the level chip (🟢 Foundations / 🟡 Working depth /
🟠 Advanced / 🔴 Hardest as in the difficulty table below), two .chip.audience, .chip.time "45 min",
.agenda a1-a4 spans flex-weighted) · main.wrap · section#intro (Part 0: kicker, .lede, .legend pills,
.callout.win "★ What you walk out with tonight") · Parts 1-2 as `section.section#part-N` with
section-kicker (klabel "Part N · covers ...", h2, `.tag.concept "N min live"`), a `.lede`, at least ONE
figure, `details.card` accordions (summary: `.mode.live` or `.mode.self`, title, `.mini`, `.caret ▶`), at
least one `.callout.example` with `span.ex-pill` "Real world" on the page · Part 3 build-along
(`.tag.build "17 min hands on"`, .lede, ONE figure, `.steps > .step > div > h4 + p`, a `.callout.tip`
"The habit to keep") · section#quiz (3 x `.quiz-q data-answer="0-based"`, `p.qtext`, three `button.qopt`
"A · ...", "B · ...", "C · ...", `p.qwhy`; ONE `div.quiz-score` after the last) · section#homework
(`.steps`, 2-3 items) · section#official, h2 "What this session covers", `.covered > .covered-row`
(pill solid ✓ / inkpill ◐ / light ○ + name + note; at least one ○ row linking a seam sibling or naming
what is out of scope) · section#cheatsheet (h2 "Cheat sheet", `.cheat` of eight `.cheat-item`) ·
footer.pagefoot · `<script src="../assets/app.js?v=1">`.

Head: the template's social meta block with this page's own title/description/url (og:image stays
`https://phoebefu6.github.io/learn-autonomous-driving-with-phoebe/assets/og-cover.png`, the main thread
generates it); `<title>Leader session N · <Title> - learn autonomous driving with phoebe</title>` (or
`Practitioner session N · ...`); `<link rel="stylesheet" href="../assets/style.css?v=1">`. Nothing else
external.

First `details.card` in Part 1 is `open` (the intro's first card too, as in the template); no other.
Sentence case headings. Warm practitioner voice, concrete, never dry. Inside prompt-boxes escape `&` `<`
`>`. 450 to 650 lines is guidance about depth, never a target.

## Hard rules (a violation is rework)

- NEVER an em dash or en dash, anywhere (prose, code, aria-labels, comments). Hyphen only.
- No meta text: never "this course", "in this course", "the course teaches". State the norm directly.
  "session 5" cross-references are fine.
- Attribution "by Phoebe Fu". Never "built with" a tool.
- Every number comes from the map or is labelled constructed. For constructed data print "your numbers
  will differ", never invented outputs as if run.
- Contested or missing evidence: teach the disagreement (when Level 4 is broadly available; whether a
  telemetry-rich fleet's crash count is comparable with police-reported human crashes; disengagement as a
  metric). Never resolve it, never give a date.
- Citations in the exact form of the map's appendix; anything marked reported is "reported".
- NEVER "lottery" or "lotteries"; say the mechanism ("decided by a random draw", "arbitrary").
- Default to the English word; no Chinese terms are needed on these pages.
- Titles, widget ids and class names must not collide with siblings. Prefix EVERYTHING you invent with
  `lh` + page id (`lha2a` for the first figure of a2, widget ids `lha2-...`). The `av`, `avw`, `ad`,
  `ia`, `ip` prefixes are taken elsewhere in the estate.
- **Course-specific refusals:** no company, vendor, product, fleet, operator, city or brand names; no named
  crashes, incidents, recalls or investigations; no stock, market, investment, purchasing or valuation
  talk. Public datasets (nuScenes, KITTI, Waymo Open Dataset, Argoverse) are named ONLY in a6 as
  self-study readings, stated as datasets, never promoted; elsewhere say "a public multi-sensor research
  dataset". Regulators (NHTSA, the California DMV regulation), SAE, ISO, UL and RAND are sources, not
  vendors: name them.
- **Lanehart is constructed** and every page that uses it says so in the masthead .sub or the intro lede
  ("Lanehart, a constructed robotaxi pilot fleet in a fictional city"). Never Phoebe's own work.
- Yellow `#F2C230` is a FILL ONLY, always under dark ink text; never yellow text, never white text on it.
  Warm text uses `#6B5200`.
- Light surfaces only. Never a dark background panel.

## Figure grammar (hand-drawn, every figure)

Palette, ONLY these hexes (no invented greys): `#2F3A42` (accent, axis captions) · `#1C2328` (deep, values)
· `#8C979F` (mid) · `#CED4D9` (soft) · `#F1F3F4` (50-tint fill) · `#1A1F23` (ink) · `#525C64` (muted) ·
`#C8CED3` (faint) · `#E2E6E9` (hairline) · `#F2C230` (lane yellow, fill only, the ONE thing the figure is
about) · `#FDF6DA` (yellow tint) · `#6B5200` (warm text) · `#FAFAF8` (paper) · `#F4F6F7` (hover) ·
`#FFFFFF` · universal reds `#991B1B` `#FEF2F2` `#FCA5A5` only for a wrong-way panel.

- `<figure class="zoomable">` > `<svg viewBox="0 0 880 H" xmlns="http://www.w3.org/2000/svg" role="img"
  aria-label="the data, not the shape">` > `<defs>` + `<style>` + content, then
  `<figcaption>🔍 Click to zoom - takeaway</figcaption>`. Grow H, never W.
- Prefix unique per figure, used for every class and id: `lh` + page id + figure letter (`lha2a`, `lha2b`).
- `<defs>` holds three things with the figure prefix P: a wobble filter `id="PSk"`
  (`feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="<int>"` +
  `feDisplacementMap scale="2.4" xChannelSelector="R" yChannelSelector="G"`, `x="-3%" y="-3%"
  width="106%" height="106%"`), a hachure pattern `id="PHc"` (7x7 userSpaceOnUse, rotate(-38), one
  `#2F3A42` line, opacity .5), an open arrowhead `id="PAr"` (path `M1 1 L9 5 L1 9`, fill none, stroke
  `#1A1F23` 1.6). ALL shapes sit inside ONE `<g filter="url(#PSk)" fill="none" stroke="#1A1F23"
  stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`; rects carry a tiny rotation (-4 to 4
  degrees for hand-placed items, under 1 for panels). Fills: white, `#F1F3F4`, the hachure for "the pile"
  or "the data", and `#F2C230` ONLY for the one thing the figure is about. One doodle anchor per figure
  (a lane line, a wheel, a cone), simple strokes, never a mascot.
- Text classes (in the figure's own `<style>`): `.PH` 800 12px `#1A1F23` heading · `.PL` 600 12px
  `#1A1F23` label · `.PS` 400 11px `#525C64` · `.PB` 800 11px `#6B5200` · `.PV` 800 16-20px `#1C2328`
  value · `.PA` 700 11px `#2F3A42` axis caption · `.PN` 400 12px `#525C64` note. Font
  `Inter, sans-serif`.
- ALL `<text>` outside any filtered group, never below 10.5px.
- Fit (owner: `diagram-kit.md`): max chars ≈ (box width - 20) / 7 at 12px, 6.4px/char at 11px; full-width
  note under 110 chars; 40px between neighbouring point labels; bottom note 22px below the last row, H
  clears it by 8px. When in doubt, shorten. A path must never cross a label (the gate flags
  `line-through-text`); hand-stacked rects must not overlap.
- Floor: one figure per Part plus one in the build-along. Draw the MECHANISM (a camera exposure fired as the
  lidar sweeps past it; an encounter rate times a failure probability; a bound sliding as miles grow; a
  takeover threshold cutting a severity line; a query that filters frames), never a metaphor literally,
  never decoration.

## Voice and honesty

Every Part gets a real-world story from the map's facts (NHTSA tables, the RAND arithmetic, the SGO's
"not normalized" sentence, the disengagement regulation, the dataset's sync design). Lanehart stories say
"constructed". Every Lanehart number is either from the map's canon table or printed live by the engine.
Not investment advice belongs on the landing page and a1 only; do not repeat it elsewhere unless money
comes up.

## The two family sessions (emrg rule)

- **a5 "Why the warehouse playbook breaks here"**: one Part per mechanism, each drawn as a before-after
  figure (warehouse row vs drive-log frame), never a slogan: (1) the source - a row someone meant vs a
  frame from many sensors on their own clocks (F9); (2) the identity - a customer id vs a scene, an actor
  track, a context; (3) the ground truth - a label that arrives with the transaction vs a label bought by
  the frame, and a crash that arrives once in millions of miles (F1, F2); (4) the feedback loop - a
  dashboard that refreshes vs a fleet whose own policy changes what gets logged (F6, shadow mode); (5) the
  cost of being wrong - a refund vs a safety case (F8 reported). Three Parts may group them (1-2, 3, 4-5).
- **a6 "From warehouse to autonomous driving: the transfer map"**: three columns CARRIES OVER / MUST
  LEARN / MUST UNLEARN, concrete (skill, method, tool class, reading), drawn as a three-column figure plus
  prose. Close with a 90-day self-study ladder, free and official sources only, each marked official or
  not: SAE J3016 chart (official, free), NHTSA crash summary (official), NHTSA SGO page and data
  (official), California 13 CCR 227.50 (official), RAND RR-1478 (free research report), nuScenes /
  KITTI / Waymo Open Dataset / Argoverse papers (free, datasets named as datasets only), Zhao et al. 2017
  arXiv 1605.04965 (free preprint). UL 4600 and ISO 26262 / 21448 are paid standards: say so.
- The landing page already carries the 3 x 4 "If you come from a data team" block; a6 must agree with it.

## Cross-links (absolute URLs, only these are live siblings)

- Label noise and cleaning: https://phoebefu6.github.io/learn-data-centric-ai-with-phoebe/courses/02-when-labellers-disagree.html
- General evaluation metrics: https://phoebefu6.github.io/learn-model-evaluation-with-phoebe/courses/a1-why-one-number-lies.html
- Sensor drift and time series: https://phoebefu6.github.io/learn-iot-data-with-phoebe/courses/a1-the-sensor-is-the-source-of-truth.html
- Beta-binomial: https://phoebefu6.github.io/learn-bayesian-with-phoebe/courses/p1-beta-binomial-by-hand.html
- Generic detectors: https://phoebefu6.github.io/learn-anomaly-detection-with-phoebe/courses/b2-statistical-detectors.html
- A/B tests and power: https://phoebefu6.github.io/learn-experimentation-with-phoebe/courses/b2-power-and-sample-size.html
- Confidence intervals: https://phoebefu6.github.io/learn-statistics-with-phoebe/courses/b7-confidence-intervals.html
- Hub: https://phoebefu6.github.io/learn-with-phoebe/

## Files, titles, difficulty, footer chains

| File | Title (h1 text; one accent span) | Level chip |
|---|---|---|
| a1-the-car-is-a-data-pipeline.html | The car is a data pipeline on wheels | 🟢 Foundations |
| a2-the-long-tail.html | The long tail: where the work actually is | 🟡 Working depth |
| a3-how-many-miles-prove-a-car-is-safe.html | How many miles prove a car is safe? | 🟡 Working depth |
| a4-reading-a-safety-claim.html | Reading a safety claim | 🟠 Advanced |
| a5-why-the-warehouse-playbook-breaks-here.html | Why the warehouse playbook breaks here | 🟠 Advanced |
| a6-from-warehouse-to-autonomous-driving.html | From warehouse to autonomous driving: the transfer map | 🟠 Advanced |
| p1-anatomy-of-a-drive-log.html | Anatomy of a drive log | 🟢 Foundations |
| p2-labels-cost-by-the-frame.html | Labels cost by the frame | 🟢 Foundations |
| p3-scenario-mining.html | Scenario mining: querying the fleet for rare events | 🟡 Working depth |
| p4-curating-for-the-tail.html | Curating for the tail | 🟡 Working depth |
| p5-perception-metrics-that-hide-failures.html | Perception metrics that hide failures | 🟡 Working depth |
| p6-simulation-against-real-miles.html | Simulation against real miles | 🟠 Advanced |
| p7-rare-event-statistics.html | Rare-event statistics | 🟠 Advanced |
| p8-importance-sampling-for-rare-scenarios.html | Importance sampling for rare scenarios | 🟠 Advanced |
| p9-the-fleet-feedback-loop.html | The fleet feedback loop | 🟠 Advanced |
| p10-the-prove-it-safe-bench.html | The prove-it-safe bench | 🔴 Hardest |

Footer: `<p>Leader session N of 6 · learn-autonomous-driving-with-phoebe · by Phoebe Fu</p>` then
`<nav class="pagenav">` with "← Leader session N-1 · <Title>" and "Leader session N+1 · <Title> →"
(a1: "← All sessions"; a6: "All sessions →"; same pattern for p1..p10). Leader chain a1 -> a6,
Practitioner chain p1 -> p10. The last card of each track points onward (a6 `.callout.next` to p1).

## Per-page outlines (one line each; the map's section 4 owns the facts)

- a2: the tail as encounter rate x failure probability; the four constructed classes (12 + 6 + 10 + 18 = 46
  per 100M); why logged miles under-sample them (MC saw 1 failure in 2,000 tries for the occluded
  pedestrian); F7 acceleration as "the authors report"; RAND's "cannot drive their way" conclusion.
- a3: RAND's three questions with Table 1 numbers (275M / 8.8B / 11B), the 2022 rate giving 225.2M,
  Lanehart's 0 fatal crashes in 150M miles bounded at 2.00 vs 1.33; optional live calculator with
  `AV.poissonUpper`.
- a4: the SGO "not normalized" sentence; rural vs urban exposure (41% of deaths on 32% of miles); the
  canon exposure match (120.00 -> 147.74; at 60M miles the verdict flips); disengagements measure policy
  (canon anti-lever numbers); a five-question claim checklist.
- a5, a6: the family rules above.
- p2: annotation economics with a constructed calculator (frames x keyframe rate x cost; 2 Hz keyframes,
  F9); auto-labelling and label QA as sampling; seam to data-centric-ai.
- p3: a scenario query over a constructed drive-log table (filters on actor type, distance, occlusion,
  time to collision); precision of the mined set; seam to anomaly detection.
- p4: training balance vs evaluation slices; why the tail slices must stay in evaluation (the break
  button: 192.24 worse vs 147.74 falsely proven).
- p5: one headline recall vs recall by distance band and scenario (constructed table; F9 lidar range
  50-150 m); seam to model-evaluation.
- p6: log replay vs synthetic scenarios; sim-to-real gap; F2 conclusion; F7.
- p7: exact Poisson bounds, rule of three (reported citation), miles needed, the Fay-Feuer matched bound;
  canon numbers incl. 90% / 99% variants; live calculator with the engine.
- p8: IS vs MC at equal budget (SD 7.251 vs 1.404 at 2,000; 13.495 vs 2.848 at 500 with zero failures in
  some class in 35% of runs); unbiasedness (mean 46.05 vs 46); the weight formula; live widget.
- p9: shadow mode, triggers, the data flywheel, drift across cities; the SGO's 30-second window and what it
  does and does not capture; seam to experimentation.

## After fan-out (main thread)

Re-run `python3 ~/.claude/skills/course-builder/scripts/pre-publish.py learn-autonomous-driving-with-phoebe --fix-journey`
from inside `~/Documents/claude_work/github_repo` so the LEADER/BUILDER arrays list all 16 pages
(TOTAL_SESSIONS is already 16), then gate (expect "34 page-widths"), contrast probe, browser checks.
