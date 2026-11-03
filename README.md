# B2A Flag Playbook

Interactive 5-on-5 flag football playbook for B2A (adult 18+ league, NFL FLAG / USA Flag rules, **3 downs** instead of 4).

**Live site:** https://xsosaxdex.github.io/B2A/ (after GitHub Pages is enabled — see below)

## What's in it
- **Plays** – 18 animated plays (quick game, dropback, trick, runs, red zone, PAT-1, PAT-2). Run/pause/scrub, flip left/right, overlay a demo defense (1 blitzer from 7 yds + man coverage), QB 7-second clock, progression reads, coaching points, and an automatic rules check.
- **Game Day** – scoreboard, timeouts, down & situation tracker (3-down series, no-run zone, PATs, vs. blitz). Recommends the best calls for the situation and never suggests a run where runs are illegal.
- **Designer** – draw routes on the field, drag players, set handoffs/pitches/passes and timing, pre-snap motion. Live rules check (QB can't run, 7-sec rule, center can't take handoffs, passes thrown behind / caught beyond the LOS, backward pitches only behind the LOS, motion rules, no-run zone). Save to "My plays" (stored in your browser), share a play by link, export/import JSON.
- **Rules** – cheat sheet summarized from the NFL FLAG rules page and the USA Flag 5's Rulebook v2026.1, with our 3-down house rule and the spots where the two sources disagree.
- **Print** – call sheet / wristband with every play diagram.

## Adding a play to the team playbook
1. Build it in the **Designer** tab.
2. Click **Copy JSON**.
3. Paste it into the `B2A_PLAYS` list in `js/plays.js` and commit.

## Turning on GitHub Pages
Repo **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)` → Save.**

## Files
- `index.html`, `css/styles.css` – the site
- `js/engine.js` – field model, play animation, defense overlay, rules checker, SVG drawing
- `js/plays.js` – the playbook data
- `js/rules.js` – rules & penalties cheat sheet
- `js/app.js` – UI

No build step, no dependencies — plain HTML/CSS/JS.
