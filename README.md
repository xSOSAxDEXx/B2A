# B2A Playbook — browser tests

This branch holds only tests. It never touches the live site (GitHub Pages serves `main`).

## Run them (Claude Code cloud session)
```
git fetch origin tests
git worktree add ../B2A-tests tests        # first time only
node ../B2A-tests/run-all.js .             # from the B2A folder (on main or your branch)
```
Every check prints PASS or FAIL; the last line says whether everything passed. Run it before every push to main.

## What it checks
1. Every tab loads with no script errors and no sideways scrolling, desktop (1366px) and phone (390px); every script/stylesheet carries the same `?v=` version.
2. Every play passes the rules check (flipped too); every blitzer is 7+ yds deep and 1+ yd off the ball; the simulated outcome mix across all plays × coverages stays sane (interceptions 3–15%, incompletions 20–50%); no "rush/rusher" wording.
3. Plays tab: rating a play doesn't restart the animation.
4. Game Day: downs, midfield, 3 downs to score, turnover on downs, TD + PAT scoring, "Gave up TD", scouting notes, removing a logged play, Stats TD count, reload keeps the tab.
5. Designer: save, open and delete a team play.
6. Quiz: a full quiz builds and finishes for every position.
7. Logins + live sync against a fake, in-memory Firebase (`mockfb.js`) — never the real team data: sign-in screen, Enter to sign in, player role, logged play saved with the roster name, downs sync, live updates don't restart the animation, players can't remove roster entries.

When a feature changes on purpose, update the matching check here in the same session.
