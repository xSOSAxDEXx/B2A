# B2A Playbook — browser tests

This branch holds only tests. It never touches the live site (GitHub Pages serves `main`).

## Run them (Claude Code cloud session)
```
git fetch origin tests
git worktree add ../B2A-tests tests        # first time only
node ../B2A-tests/run-all.js .             # from the B2A folder (on main or your branch)
```
Every check prints PASS or FAIL; the last line says whether everything passed. Run it before every push to main.

## Security-rules tests (whenever `firestore.rules` changes)
Runs `firestore.rules` in Google's local Firestore emulator (needs Java; never touches the real project):
```
cd ../B2A-tests && npm install          # first time only (downloads the emulator tools)
npm run rules                           # expects the site checked out at ../B2A
```
It tries every save the site makes as coach / editor / player / outsider, with good and bad data (51 checks).

## What it checks
1. Every tab loads with no script errors and no sideways scrolling, desktop (1366px) and phone (390px); every script/stylesheet carries the same `?v=` version.
2. Every play passes the rules check (flipped too); every blitzer is 7+ yds deep and 1+ yd off the ball; the simulated outcome mix across all plays × coverages stays sane (interceptions 3–15%, incompletions 20–50%); no "rush/rusher" wording.
3. Plays tab: rating a play doesn't restart the animation.
4. Game Day: test-mode banner and no old Publish controls, downs, midfield, 3 downs to score, turnover on downs, TD + PAT scoring, "Gave up TD", scouting notes, removing a logged play, Stats TD count, reload keeps the tab.
5. Designer: save, open and delete a team play.
6. Quiz: a full quiz builds and finishes for every position.
7. Old GitHub token wiped from devices; no test banner when signed in. Logins + live sync against a fake, in-memory Firebase (`mockfb.js`) — never the real team data: sign-in screen, Enter to sign in, player role, logged play saved with the roster name, downs sync, live updates don't restart the animation, players can't remove roster entries.

When a feature changes on purpose, update the matching check here in the same session.
8. Team plays + ratings in their own documents: the site keeps working on the old rules, the coach's first visit after the new rules moves the data, team plays with real routes save (Firestore can't store lists inside lists — the fake rejects them just like the real one), a refused save shows a message and doesn't block the next one, offline badge, offline cache on, sign-out wipes the device copy.

## Style comparison (for CSS cleanups)
`node style-compare.js <old-site> <new-site>` renders about 58 screens in both copies (every tab at desktop, tablet and phone width, print, signed-in views) and lists every element whose computed style differs. Make the old copy with `git worktree add --detach ../B2A-old origin/main`. "IDENTICAL" means nobody will see a change. Small position differences inside a quiz answer animation are timing noise.
