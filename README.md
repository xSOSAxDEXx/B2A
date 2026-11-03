# B2A Flag Playbook

Interactive 5-on-5 flag football playbook for B2A — adult 18+ league on NFL FLAG / USA Flag rules with our house rules: **3 downs**, 25-yd field, no-run zones 5 yds before midfield and each goal line, 1 timeout per half, turnover on downs = ball at their own 5.

**Live:** https://xsosaxdexx.github.io/B2A/

## Tabs
- **Plays** — Offense/Defense switch. 30 offensive plays in 8 sections (quick game, dropback, man beaters, center plays, trick, runs, midfield no-run, red zone & PAT) and 9 defensive calls (Cover 0/1/Robber/2/3, 3-1, Diamond, Double Blitz, Cover 4). Run any of our plays against any of our coverages: QBs throw on the receiver's break, receivers run after the catch, defenders react and pull flags, and the result (separation at the catch, gain, sack, TD) is shown. Thumbs up/down, add to the game plan, rules check, our logged results per play.
- **Game Day** — create the week's game (opponent + date), build the offensive/defensive game plan, scoreboard, 3-down series tracker, play-call suggestions (game plan + situation + our success rates + ratings), and a one-tap results log.
- **Stats** — record, matchups, success rate by play, by down, and takeaways — filter by opponent and offense/defense.
- **Quiz** — **Quiz me on my spots**: a player picks their name and is quizzed on exactly the spots they’re assigned in this week’s plan. Or pick a position (QB, C, X, Y, Z, defender, blitzer); questions come from this week's game plan: which route you run, who's the target, when the ball comes out, who's open vs a coverage, which call stops their play, your job in a coverage, and league rules.
- **Roster** — players (name, number, primary offense / defense position, strengths & weaknesses) and an assignment board for every play in the week’s game plan. Each spot’s demands are read from the play (target, deep route, thrower, ball carrier, blitz / man / zone) and the coach is warned about weakness matches, out-of-position players and double-assigned players. Auto-assign picks the best fits.
- **Designer** — draw plays, set the throw on a receiver's break, live rules check, save to team plays.
- **Guide** — strategy (what wins 5v5, QB play, using the center, design principles, 3-down situations, defense, blitzing & flag pulling), coverage cheat sheet, league rules & penalties.

## Sharing with the team — logins (Firebase)
The site supports invite-only team logins with live shared data (roster, game plans, assignments, results, ratings, team plays).
Setup is a one-time ~15 minute job in the free Firebase console — see **[SETUP-FIREBASE.md](SETUP-FIREBASE.md)**.
- `js/firebase-config.js` — paste the Firebase web config here (`null` = no logins, old local/GitHub-publish mode)
- `firestore.rules` — paste into Firestore → Rules. Roles: coach (everything + access list), editor (everything else), player (view, log results, scoreboard, own profile)

Until the config is added, the site works as before: changes save on the device and the coach publishes `data/season.json` with a GitHub token from Game Day → Coach tools.

## Files
- `js/engine.js` play model, timing (throw on the break, run after catch), rules checker, drawing
- `js/defense.js` coverage simulation (blitz / man / zone / spy), flag pulls, sacks
- `js/plays.js`, `js/defense-plays.js` the playbook data
- `js/store.js` season data; `js/cloud.js` Firebase sign-in + live sync; `data/season.json` legacy published data
- `js/app.js` (Plays), `gameday.js`, `stats.js`, `quiz.js`, `designer.js`, `guide-ui.js`, `rules.js`, `guide.js`

No build step — plain HTML/CSS/JS.
