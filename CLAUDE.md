# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Personal portfolio for Sachin Jangir (.NET full-stack engineer with a security-engineering specialty), styled as a vintage broadsheet newspaper: "The Jangir Chronicle". Plain static site — `index.html`, `styles.css`, `script.js`, `avatar.js` — no framework, no build step. External dependencies: Google Fonts, and three.js 0.170 from jsDelivr (via the import map in `index.html`, only for the 3D portrait).

## Running

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

There are no tests, linter, or build. Verify changes visually at desktop (~1280px) and mobile (<640px) widths, in all three editions (`?edition=morning|security|night`), and with `prefers-reduced-motion` enabled.

## Content source of truth: `portfolio content brief.md`

All copy on the site must come from this brief. It is fact-checked, and its constraints are hard rules, not suggestions:

- Never invent a number, date, skill, or years-of-experience claim. If something is missing, it's listed in the brief's §11 "Open items" — ask Sachin instead of filling it in. §13 records his later answers and confirmed additions; it overrides §11.
- Use only the metrics in §8 exactly as written (no rounding up). Estimates flagged there (e.g. ~2 weeks → ~1 week) must be presented as estimates.
- Never list anything in §9 "Confirmed gaps" (e.g. Node.js, GraphQL, Go, Java, Kubernetes, AWS, MongoDB) as a skill. Respect the depth labels (e.g. Python and SQL are secondary).
- Titles must be exact: Lead Solution Analyst (Aug 2026–present), Solution Analyst (Aug 2024–Aug 2026), Programmer Analyst (May 2022–Aug 2024), all at Argusoft Ind Ltd.
- No people-management claims beyond: mentoring 6 juniors, delegating to 1 dedicated junior, and *leading* (not solely owning) shared CI/CD work.
- The agentic security assistant and Fight Club are in progress. Never present them as shipped.
- Disclose AI-assisted development where the brief says it applies.
- Don't claim shared or other people's work (Chakra plugins, ClamAV integration, mTLS infra, etc.), and don't feature the GitHub repos listed in §7.
- No LeetCode numbers and no LeetCode profile link.
- Don't mention React anywhere on the site (§13): AI writes most of his React code. Position him as a .NET full-stack engineer.
- Don't feature Bartan Turn (§13): too domestic for the positioning. The Workshop shows Fight Club, the DWP theme and Jerry.
- Location is Gandhinagar, Gujarat. The site should lead with the full-stack story, with a clearly signposted security section and a visible AI/LLM section (§1).

## Architecture

The page is one long "edition": a masthead (edition switcher, blackletter title, sticky section nav), then `<main class="edition">` holding `<section id>` blocks that each act as a numbered newspaper page (`.section-head__page`). Nav links in `.sections` must point at `#<section id>`.

**Editions.** `<html data-edition>` is `morning` (default), `security` or `night`. An inline script in `<head>` picks it before first paint (URL `?edition=`, then `localStorage`, otherwise Morning — deliberately not `prefers-color-scheme`, so every first visit sees the broadsheet). Each edition overrides the tokens in `:root` in `styles.css`. `script.js`'s `editions` map sets the section order per edition: it moves the `<section>`s and nav links in the DOM, renumbers the page labels, and fills `.js-page-of` spans ("Continue on page N"). Content that belongs to only some editions uses `data-for="morning night"` (space-separated). Security leads with the security story and page; night is the morning layout in the DWP Zed theme palette.

`script.js` is coupled to the markup through class names, so keep these in sync when editing HTML:
- `.editions button[data-edition]` → switch editions (ink "reprint" wipe via `.press-roll`), `aria-pressed` reflects the current one; a `editionchange` event fires on `document`. There are two switchers: `.editions--masthead` (desktop) and `.editions--footer` (phones, under 640px, with a note on what each edition is). Switching from the footer returns to the top of the page. Because the buttons carry `data-edition`, edition rules in `styles.css` must be scoped to `:root[data-edition=…]`.
- `.sections a` → gets `.is-active` when the `section[id]` matching its hash is mid-viewport; on mobile the nav scrolls sideways to keep it visible.
- `.timeline` → JS sets the CSS var `--progress` (0–1), and `.timeline::before` uses `scaleY` to draw the career line.
- `#dateline` and `#year` are filled in at runtime.

**3D portrait.** `avatar.js` loads `assets/avatar.glb` (Avaturn model, compressed with gltf-transform from the original `assets/sachin.glb`), plays its idle animation, turns the head slightly towards the cursor, and prints it through a halftone shader using the current edition's `--paper`/`--ink` (light ink prints highlights). It only loads when motion is allowed, WebGL2 exists and Save-Data is off; otherwise `assets/portrait.webp` (a plain render) stays in `#portrait`. It pauses when off-screen.

Design tokens: paper, ink, `--accent`, `--desk` (the table behind the paper), rules, and four font roles: UnifrakturMaguntia (masthead only), Playfair Display (headlines), Playfair Display SC (labels, nav, datelines — real small caps instead of uppercase), Libre Baskerville (body). Reuse them rather than adding new colours or fonts. Numbered markers are only for real sequences (the page numbers, the RAG pipeline steps).

Images go inside a `.halftone` container as an `<img>`; CSS applies the edition's newsprint filter and a fine dot screen.

Motion: the load animation (`.press-roll` + `.paper` unfold), the edition reprint wipe, the timeline line, the 3D portrait, and hover feedback on buttons and nav are the only motion. All of it is off under `prefers-reduced-motion` (CSS media query; `script.js` checks it before animating or loading the avatar). Any new animation must respect that too.
