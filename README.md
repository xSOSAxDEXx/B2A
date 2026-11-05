# B2A Flag Playbook

Interactive 5-on-5 flag football playbook for B2A — adult 18+ league on NFL FLAG / USA Flag rules with our house rules: **3 downs** to cross midfield and 3 to score, 25-yd field, no-run zones 5 yds before midfield and each goal line, 1 timeout per half, turnover on downs = ball at their own 5, blitzers (max 2) 7+ yds deep and at least 3 ft left or right of the ball.

**Live:** https://xsosaxdexx.github.io/B2A/ — invite-only team logins (Firebase).

## Tabs
- **Plays** — Offense/Defense switch. 30 offensive plays in 8 sections (quick game, dropback, man beaters, center plays, trick, runs, midfield no-run, red zone & PAT) and 9 defensive calls (Cover 0/1/Robber/2/3, 3-1, Diamond, Double Blitz, Cover 4).
  - **Against defense** runs a simulated coverage: QBs throw on the receiver's break, receivers run after the catch, defenders react and pull flags; the result (separation, gain, sack, incompletion, interception, TD) is shown.
  - **QB throws to** any receiver, or **Best read vs [defense]**. **QB after the snap**: drop back or roll out left/right.
  - **✎ Adjust routes & catch spot**: drag route dots and slide the 📍 pin along the target's route. View-only until **Edit copy** (opens it in the Designer); **Reset changes** undoes it.
  - Thumbs up/down, add to the game plan, rules check, our logged results, who's assigned to each spot, share link, flip, print call sheet.
- **Game Day** — the week's game (opponent + date), offensive/defensive game plan, scouting notes, scoreboard, 3-down series tracker, suggested calls (game plan + situation + our success rates + ratings), and a one-tap results log that advances downs and scores automatically.
- **Stats** — record, matchups, success rate by play, by down, and takeaways — filter by opponent and offense/defense.
- **Quiz** — **Quiz me on my spots** (by player name, from this week's assignments) or by position (QB, C, X, Y, Z, defender, blitzer): routes, targets, timing, who's open vs a coverage, which call stops their play, your coverage job, league rules.
- **Roster** — players (name, number, primary + extra offense/defense positions, strengths & weaknesses), game-plan assignments with fit warnings and auto-assign, and **Team access** (coach only).
- **Designer** — draw plays, set the throw on a receiver's break or a pinned catch spot, live rules check, save to team plays.
- **Guide** — strategy, coverage cheat sheet, league rules & penalties.
- **Help** — how to use the site.

## Logins and shared data (Firebase)
- Project `b2a-playbook` on the free Spark plan; setup steps in **[SETUP-FIREBASE.md](SETUP-FIREBASE.md)**.
- `js/firebase-config.js` — the Firebase web config (safe to commit; access is controlled by the rules and the team list).
- `firestore.rules` — paste into Firebase console → Firestore → Rules → Publish after any change. Roles: **coach** (everything + access list), **editor** (all data), **player** (view, log results, scoreboard/downs, own roster profile).
- Teammates are added in Roster → Team access; data lives in `teams/b2a` (+ `members`, `roster`, `games`, `log`, `plays`, `ratings`). Team plays are stored packed as JSON text (Firestore can't store the lists-inside-lists that routes use).
- Offline: Firestore keeps a copy on each device, so the site opens and saves with no signal and syncs later (header shows “Offline · N to sync”). Signing out wipes that copy.
- With the config set to `null` the site runs in **test mode**: no logins, nothing saved, yellow banner at the bottom. Only for automated tests — never deploy it that way.

## Files
- `index.html`, `css/styles.css`
- `js/util.js` shared helpers (loaded first)
- `js/engine.js` play model, movement and throw timing, run after catch, rules checker, drawing
- `js/defense.js` coverage simulation (blitz / man / zone / spy), flag pulls, sacks, incompletions, interceptions; `scoreResult()` ranks outcomes for "Best read" and the quiz
- `js/plays.js`, `js/defense-plays.js` the playbook data
- `js/store.js` season data; `js/cloud.js` Firebase sign-in + live sync
- `js/app.js` (Plays tab + shared helpers), `gameday.js`, `stats.js`, `quiz.js`, `roster.js`, `designer.js`, `guide.js`, `guide-ui.js`, `rules.js`, `help.js`, `icons.js`, `boot.js`

## Testing
Browser tests live on the `tests` branch (never served by GitHub Pages): `git worktree add ../B2A-tests tests`, then `node ../B2A-tests/run-all.js .` from this folder. Run them before every push to `main`. After changing `firestore.rules`, also run the security-rules tests in the Firestore emulator (`npm run rules` on that branch).

## Deploying
No build step — plain HTML/CSS/JS on GitHub Pages; every push to `main` redeploys in about a minute.
**Bump the `?v=` value** on the script and stylesheet links in `index.html` with each deploy (one value for all of them, e.g. `?v=20261105a`), so phones load the new files instead of a cached mix of old and new.
