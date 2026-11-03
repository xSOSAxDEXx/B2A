# Turning on team logins (Firebase)

About 15 minutes, one time. Everything here is on Firebase's free **Spark** plan — no credit card.

When you're done, the site will:
- Show a sign-in screen to everyone. Only emails **you** add can get in.
- Save every change instantly for the whole team (no GitHub token, no Publish button).
- Give each person a role: **Coach** (you — everything + who has access), **Editor** (edits plays, plans, roster, results), **Player** (views everything, logs results, runs the scoreboard, edits their own profile).

---

## 1. Create the Firebase project
1. Go to https://console.firebase.google.com and sign in with your Google account.
2. **Create a project** → name it `b2a-playbook` (any name works).
3. Google Analytics: **turn it off** (not needed) → **Create project**.

## 2. Add a web app and copy its config
1. On the project home page click the **`</>` (Web)** icon.
2. App nickname: `B2A site`. Leave "Firebase Hosting" **unchecked** → **Register app**.
3. Firebase shows a block of code with `const firebaseConfig = { apiKey: ..., authDomain: ..., ... }`.
   Copy just the `{ ... }` part. **Send it to me** (it's safe to share — it isn't a password) or paste it into `js/firebase-config.js` yourself, replacing `null`:
   ```js
   window.B2A_FIREBASE_CONFIG = { apiKey: "...", authDomain: "...", projectId: "...", storageBucket: "...", messagingSenderId: "...", appId: "..." };
   ```

## 3. Turn on sign-in methods
1. Left menu → **Build → Authentication** → **Get started**.
2. **Sign-in method** tab:
   - **Google** → Enable → pick your support email → Save.
   - **Email/Password** → Enable (first switch only) → Save.
3. **Settings** tab → **Authorized domains** → **Add domain** → `xsosaxdexx.github.io` → Add.

## 4. Create the database
1. Left menu → **Build → Firestore Database** → **Create database**.
2. Location: pick one near you (e.g. `us-east1` or `nam5`). **This can't be changed later.**
3. Start in **production mode** → Create.

## 5. Paste the security rules
1. In Firestore, open the **Rules** tab.
2. Delete everything there and paste the full contents of **`firestore.rules`** from the repo.
3. **Publish**.

## 6. Claim the team (first sign-in)
1. Once the config is in the site (step 2), open https://xsosaxdexx.github.io/B2A/ and hard-refresh.
2. **Sign in with Google** using your account.
3. You'll see **"Set up the team"** → **Claim B2A as coach**.
4. It will offer to bring over any existing data (games, roster, results, team plays) — say **OK**.

## 7. Invite the team
1. **Roster** tab → **Team access**.
2. For each person: their **email** (the one they'll sign in with), a **role**, and the **roster player** they are → **Add**.
3. Send them the site link. They sign in with Google, or "Create account" with that email + a password (they'll get a verification email to confirm first).
4. Remove someone any time with the ✕ — they lose access immediately.

---

### Good to know
- **Free plan limits** are far above what a team uses (tens of thousands of reads/writes per day).
- **The config key in `firebase-config.js` is not a secret.** What protects the data is the security rules + your team list.
- **Backups:** Game Day → Coach tools → *Download backup (season.json)*.
- **Making the repo private** later: GitHub Pages needs a public repo on a free account. The team data is protected by the logins either way; if you also want the code private, the site can move to Cloudflare Pages (free) — ask and it can be set up.
- **Something not working?** Send a screenshot of the message on the sign-in screen; most first-time issues are a missing authorized domain (step 3.3) or rules not published (step 5).
