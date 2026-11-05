# B2A Playbook

Interactive playbook site for B2A, my flag football team.

## Project
- Repo: github.com/xSOSAxDEXx/B2A, hosted on GitHub Pages
- Access: only selected people, each with an individual login through Firebase Authentication (free Spark plan)
- The repo may be made private later, so don't rely on it staying public

## League rules (the plays must follow these)
- Adult 18+ league using NFL FLAG / USA Flag 5v5 rules, except **3 downs instead of 4**
- Field is 25 yds wide
- No-run zones 5 yds before midfield and 5 yds before each goal line
- 1 timeout per half
- A turnover on downs gives the other team the ball at its own 5
- The blitzer must line up at least 3 ft left or right of the ball
- A receiver who interferes with a blitzer running straight at the QB commits an offensive penalty

## Terminology
- Use "blitz/blitzer", never "rush/rusher"

## How to work with me
- I'm a mechanical engineer, not a software engineer. Explain steps in plain language.
- Give complete files or complete code blocks I can paste, not partial snippets.
- Tell me exactly what to click or run for anything outside the code (GitHub, Firebase console).

## Deploying
- Every push to main redeploys GitHub Pages in about a minute.
- Bump the `?v=` value on all the script/stylesheet links in index.html with every deploy (same value for all, e.g. `?v=20261105b`) so phones don't run a cached mix of old and new files.

## Testing
- Browser tests are on the `tests` branch (not served by GitHub Pages): `git fetch origin tests && git worktree add ../B2A-tests tests`, then `node ../B2A-tests/run-all.js .` from the repo folder. Run them before every push to main; update a check in the same session when a feature changes on purpose.
- With `window.B2A_FIREBASE_CONFIG` set to null (e.g. Playwright addInitScript) the site runs in test mode: no logins, data only in memory, yellow banner. Login flows are tested against an in-memory fake Firebase (`mockfb.js` on the tests branch).
- After changing firestore.rules, also run the rules tests in the Firestore emulator (`cd ../B2A-tests && npm install && npm run rules`), then tell me to re-publish the rules in the Firebase console.
- Firestore can't store lists inside lists (route points are [[x, y], …]) — team plays are stored packed as JSON text for that reason.
- Don't commit screenshots or test files to main.
