# B2A Flag Playbook

Interactive 5-on-5 flag football playbook for B2A — adult 18+ league on NFL FLAG / USA Flag rules with our house rules: **3 downs**, 25-yd field, no-run zones 5 yds before midfield and each goal line, 1 timeout per half, turnover on downs = ball at their own 5.

**Live:** https://xsosaxdex.github.io/B2A/

## Tabs
- **Plays** — Offense/Defense switch. 30 offensive plays in 8 sections (quick game, dropback, man beaters, center plays, trick, runs, midfield no-run, red zone & PAT) and 9 defensive calls (Cover 0/1/Robber/2/3, 3-1, Diamond, Double Blitz, Cover 4). Run any of our plays against any of our coverages: QBs throw on the receiver's break, receivers run after the catch, defenders react and pull flags, and the result (separation at the catch, gain, sack, TD) is shown. Thumbs up/down, add to the game plan, rules check, our logged results per play.
- **Game Day** — create the week's game (opponent + date), build the offensive/defensive game plan, scoreboard, 3-down series tracker, play-call suggestions (game plan + situation + our success rates + ratings), and a one-tap results log.
- **Stats** — record, matchups, success rate by play, by down, and takeaways — filter by opponent and offense/defense.
- **Quiz** — pick a position (QB, C, X, Y, Z, defender, blitzer); questions come from this week's game plan: which route you run, who's the target, when the ball comes out, who's open vs a coverage, which call stops their play, your job in a coverage, and league rules.
- **Designer** — draw plays, set the throw on a receiver's break, live rules check, save to team plays.
- **Guide** — strategy (what wins 5v5, QB play, using the center, design principles, 3-down situations, defense, rushing & flag pulling), coverage cheat sheet, league rules & penalties.

## Sharing game plans & stats with the team
Changes (game plans, results, ratings, team plays) save on the device that made them. The coach taps **Publish to team** in Game Day → Coach tools, which commits `data/season.json` to this repo; GitHub Pages redeploys and everyone sees it about a minute later.
One-time setup on the coach's phone: create a fine-grained GitHub token (github.com → Settings → Developer settings → Fine-grained tokens) with access to only the B2A repo and **Contents: Read and write**, then paste it into Coach tools. It's stored only in that browser.

## Files
- `js/engine.js` play model, timing (throw on the break, run after catch), rules checker, drawing
- `js/defense.js` coverage simulation (blitz / man / zone / spy), flag pulls, sacks
- `js/plays.js`, `js/defense-plays.js` the playbook data
- `js/store.js` season data + publish; `data/season.json` the team's published data
- `js/app.js` (Plays), `gameday.js`, `stats.js`, `quiz.js`, `designer.js`, `guide-ui.js`, `rules.js`, `guide.js`

No build step — plain HTML/CSS/JS.
