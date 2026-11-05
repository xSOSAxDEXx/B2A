/* B2A cloud mode (Firebase): invite-only sign-in + live shared data.
   Active only when js/firebase-config.js has a config. The rest of the site keeps using B2A_STORE as before;
   this file swaps where the data comes from (Firestore snapshots) and where saves go (diffed writes).

   Firestore layout (teams/{team}):
     doc fields  : ownerUid, opponents, activeGame, updated
     members/{email} : role ('coach' | 'editor' | 'player'), playerId, name
     roster/{playerId}, games/{gameId} (without log), log/{entryId} (with game id),
     plays/{playId} (team plays, sorted by 'created'), ratings/{playId} ({ v: 1 | -1 })
   Before Nov 2026 team plays and ratings were fields on the team doc. Until the new firestore.rules are
   published the site keeps using those fields ("legacy layout"); once they are, the first coach/editor to
   open the site moves them into their own documents automatically.

   Offline: Firestore keeps a copy on the device, so the site opens and saves with no signal; changes
   queue up and sync when the connection comes back. Signing out wipes that copy. */
(function (root) {
  'use strict';
  var CFG = root.B2A_FIREBASE_CONFIG, TEAM = root.B2A_TEAM_ID || 'b2a';
  var VER = '10.14.1', SDK = ['app', 'auth', 'firestore'];
  var C = { enabled: !!(CFG && CFG.apiKey), user: null, member: null, role: null, members: [], ready: false };
  if (!C.enabled) { root.B2A_CLOUD = C; return; }

  var db, auth, teamRef, unsubs = [], last = {}, firstData = null, ST;
  var parts = { meta: null, roster: {}, games: {}, log: {}, plays: {}, ratings: {} };
  var layout = { known: { plays: false, ratings: false }, server: {}, split: true }, migrating = false;
  C.pending = 0;   // saves waiting for the server (more than 0 while offline)

  function loadScript(src) { return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { rej(new Error('Could not load ' + src)); }; document.head.appendChild(s); }); }
  function loadSDK() { return SDK.reduce(function (p, m) { return p.then(function () { return loadScript('https://www.gstatic.com/firebasejs/' + VER + '/firebase-' + m + '-compat.js'); }); }, Promise.resolve()); }
  var esc = root.B2A_ESC;
  function clean(o) { return JSON.parse(JSON.stringify(o, function (k, v) { return v === undefined ? null : v; })); }

  /* ---------------- sign-in gate ---------------- */
  var gate;
  function showGate(html) {
    if (!gate) { gate = document.createElement('div'); gate.id = 'gate'; document.body.appendChild(gate); }
    gate.innerHTML = '<div class="gate-card">' + (root.B2A_LOGO ? '<div class="gate-logo">' + root.B2A_LOGO() + '</div>' : '') + html + '</div>';
    gate.classList.remove('hidden'); document.body.classList.add('gated');
  }
  function hideGate() { if (gate) gate.classList.add('hidden'); document.body.classList.remove('gated'); }
  function signInScreen(msg) {
    showGate('<h2>Team sign-in</h2><p class="hint">The B2A playbook is invite-only. Sign in with the email your coach added.</p>' +
      (msg ? '<p class="gate-msg">' + msg + '</p>' : '') +
      '<button class="btn primary full" id="g-google">Sign in with Google</button>' +
      '<div class="gate-or"><span>or email</span></div>' +
      '<input id="g-email" type="email" placeholder="Email" autocomplete="email">' +
      '<input id="g-pass" type="password" placeholder="Password (6+ characters)" autocomplete="current-password">' +
      '<div class="gate-row"><button class="btn" id="g-in">Sign in</button><button class="btn ghost" id="g-up">Create account</button></div>' +
      '<button class="linkbtn" id="g-reset">Forgot password?</button>' +
      (standalone() ? '<p class="hint gate-note">Opened from your home-screen icon: Google sign-in often doesn’t work here on iPhone. Use <b>email + password</b>, or open the site in Safari to sign in with Google.</p>' : ''));
    var g = function (id) { return document.getElementById(id); };
    // Enter in the email/password boxes signs in
    ['g-email', 'g-pass'].forEach(function (id) { g(id).addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); g('g-in').click(); } }); });
    function fail(e) { signInScreen(esc(friendly(e))); }
    g('g-google').onclick = function () { auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(function (e) { if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') { try { sessionStorage.setItem('b2a.redirect', '1'); } catch (x) { } auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider()); } else fail(e); }); };
    g('g-in').onclick = function () { auth.signInWithEmailAndPassword(g('g-email').value.trim(), g('g-pass').value).catch(fail); };
    g('g-up').onclick = function () {
      auth.createUserWithEmailAndPassword(g('g-email').value.trim(), g('g-pass').value)
        .then(function (cr) { return cr.user.sendEmailVerification(); }).catch(fail);
    };
    g('g-reset').onclick = function () { var em = g('g-email').value.trim(); if (!em) { signInScreen('Enter your email first, then tap “Forgot password?”.'); return; } auth.sendPasswordResetEmail(em).then(function () { signInScreen('Password reset email sent to ' + esc(em) + '.'); }).catch(fail); };
  }
  function standalone() { try { return navigator.standalone === true || matchMedia('(display-mode: standalone)').matches; } catch (e) { return false; } }
  function friendly(e) {
    var m = { 'auth/invalid-credential': 'Wrong email or password.', 'auth/wrong-password': 'Wrong email or password.', 'auth/user-not-found': 'No account with that email — tap “Create account”.',
      'auth/email-already-in-use': 'That email already has an account — tap “Sign in”.', 'auth/weak-password': 'Use at least 6 characters.', 'auth/invalid-email': 'That email doesn’t look right.',
      'auth/popup-closed-by-user': 'Sign-in window was closed.', 'auth/cancelled-popup-request': 'Sign-in window was closed.', 'auth/missing-password': 'Enter your password.', 'auth/too-many-requests': 'Too many tries — wait a few minutes, or tap “Forgot password?”.', 'unavailable': 'Couldn’t connect to the team database (the connection looks weak or blocked).', 'auth/network-request-failed': 'No connection — check your signal or Wi-Fi and try again.', 'auth/unauthorized-domain': 'This site address isn’t on Firebase’s authorized domains list yet (Authentication → Settings).' };
    if (e && !m[e.code] && /client is offline/i.test(e.message || '')) return m.unavailable;
    return m[e && e.code] || (e && e.message) || 'Something went wrong.';
  }
  function verifyScreen(user) {
    showGate('<h2>Check your email</h2><p class="hint">We sent a verification link to <b>' + esc(user.email) + '</b>. Tap it, then come back here.</p>' +
      '<button class="btn primary full" id="g-done">I’ve verified — continue</button><div class="gate-row"><button class="btn" id="g-resend">Resend email</button><button class="btn ghost" id="g-out">Sign out</button></div>');
    document.getElementById('g-done').onclick = function () { user.reload().then(function () { return user.getIdToken(true); }).then(function () { onUser(auth.currentUser); }); };
    document.getElementById('g-resend').onclick = function () { user.sendEmailVerification().then(function () { root.APP && APP.toast('Sent again.'); }); };
    document.getElementById('g-out').onclick = function () { auth.signOut(); };
  }
  function notMemberScreen(user) {
    showGate('<h2>Not on the team list yet</h2><p class="hint"><b>' + esc(user.email) + '</b> isn’t on the B2A team list. Ask the coach to add this exact email, then tap “Try again”.</p>' +
      '<button class="btn primary full" id="g-retry">Try again</button><button class="btn ghost full" id="g-out">Use a different account</button>');
    document.getElementById('g-retry').onclick = function () { onUser(auth.currentUser); };
    document.getElementById('g-out').onclick = function () { auth.signOut(); };
  }
  function setupScreen(user) {
    showGate('<h2>Set up the team</h2><p class="hint">Nobody has claimed the B2A team yet. Signed in as <b>' + esc(user.email) + '</b> — you’ll become the coach and can then add everyone else.</p>' +
      '<button class="btn primary full" id="g-claim">Claim B2A as coach</button><button class="btn ghost full" id="g-out">Use a different account</button>');
    document.getElementById('g-claim').onclick = function () {
      var em = user.email.toLowerCase();
      teamRef.set({ ownerUid: user.uid, opponents: [], activeGame: null, ratings: {}, teamPlays: [], updated: new Date().toISOString() })
        .then(function () { return teamRef.collection('members').doc(em).set({ role: 'coach', name: user.displayName || '', addedAt: new Date().toISOString() }); })
        .then(function () { onUser(user); })
        .catch(function (e) { showGate('<h2>Setup failed</h2><p class="gate-msg">' + esc(friendly(e)) + '</p><p class="hint">Make sure the Firestore rules from <b>firestore.rules</b> are published.</p>'); });
    };
    document.getElementById('g-out').onclick = function () { auth.signOut(); };
  }

  /* ---------------- data sync ---------------- */
  function pad3(n) { return ('00' + n).slice(-3); }
  /* Firestore can't store lists inside lists, and every route is a list of [x, y] points — so a team play
     is stored as one JSON text field ('data') plus its name and creation time. */
  function packPlay(p, i) { var created = p.created || '0-' + pad3(i); return { name: p.name || 'Untitled play', created: created, data: JSON.stringify(Object.assign({}, p, { created: created })) }; }
  function unpackPlay(doc) {
    if (typeof doc.data !== 'string') return doc;   // already a plain play
    try { return Object.assign(JSON.parse(doc.data), { id: doc.id }); } catch (e) { return null; }
  }
  function units(d) {   // the team data cut into the documents it's stored in, each as a JSON string
    var u = {};
    if (layout.split) {
      u.meta = { opponents: d.opponents || [], activeGame: d.activeGame || null };
      (d.teamPlays || []).forEach(function (p, i) { u['plays/' + p.id] = packPlay(p, i); });
      Object.keys(d.ratings || {}).forEach(function (id) { u['ratings/' + id] = { v: d.ratings[id] }; });
    } else {
      u.meta = { opponents: d.opponents || [], activeGame: d.activeGame || null, ratings: d.ratings || {}, teamPlays: (d.teamPlays || []).map(function (p, i) { return Object.assign({ id: p.id }, packPlay(p, i)); }) };
    }
    (d.roster || []).forEach(function (p) { u['roster/' + p.id] = p; });
    (d.games || []).forEach(function (g) {
      var gg = {}; Object.keys(g).forEach(function (k) { if (k !== 'log') gg[k] = g[k]; });
      u['games/' + g.id] = gg;
      (g.log || []).forEach(function (l) { u['log/' + l.id] = Object.assign({}, l, { game: g.id }); });
    });
    var out = {}; Object.keys(u).forEach(function (k) { out[k] = JSON.stringify(clean(u[k])); });
    return out;
  }
  function refFor(key) { if (key === 'meta') return teamRef; var p = key.split('/'); return teamRef.collection(p[0]).doc(p[1]); }
  function saveFailed(e) {
    var msg = e && e.code === 'permission-denied' ? 'You don’t have permission to change that — ask the coach for editor access.' : 'Couldn’t save: ' + friendly(e);
    root.APP && APP.toast(msg);
    last = {}; rebuild();   // fall back to the server's copy so later saves aren't blocked
  }
  function writeAll(d, migrate) {
    try { return writeChanges(d, migrate); }
    catch (e) { console.error(e); saveFailed(e); return Promise.resolve(); }   // e.g. data Firestore can't store: say so instead of failing silently
  }
  function writeChanges(d, migrate) {   // write only what changed since the last snapshot
    var now = units(d), batch = db.batch(), n = 0, ops = [];
    if (migrate) {   // team plays + ratings now live in their own documents: clear the old fields
      var del = firebase.firestore.FieldValue.delete();
      batch.set(teamRef, { teamPlays: del, ratings: del }, { merge: true }); n++; ops.push('migrate');
    }
    Object.keys(now).forEach(function (k) {
      if (last[k] === now[k]) return;
      var val = JSON.parse(now[k]);
      if (k === 'meta') { val.updated = new Date().toISOString(); batch.set(teamRef, val, { merge: true }); }
      else if (k.indexOf('log/') === 0 && !last[k]) { val.by = C.user.uid; val.byName = val.byName || (C.member && C.member.name) || C.user.displayName || C.user.email; batch.set(refFor(k), val); }
      else batch.set(refFor(k), val);
      n++; ops.push(k);
    });
    Object.keys(last).forEach(function (k) { if (!now[k] && k !== 'meta') { batch.delete(refFor(k)); n++; ops.push('-' + k); } });
    if (!n) return Promise.resolve();
    Object.keys(now).forEach(function (k) { last[k] = now[k]; });
    Object.keys(last).forEach(function (k) { if (!now[k]) delete last[k]; });
    // with no signal this stays pending (the change is already kept on the device) until it reaches the server
    C.pending++; syncChanged();
    return batch.commit().then(function () {
      if (migrate) root.APP && APP.toast('Team plays and ratings moved to the new storage layout.');
    }, saveFailed).then(function () { C.pending = Math.max(0, C.pending - 1); syncChanged(); });
  }
  function syncChanged() { root.APP && APP.onSyncChange && APP.onSyncChange(); }
  var pending = false;
  function byCreated(a, b) { return (a.created || '').localeCompare(b.created || '') || String(a.id).localeCompare(String(b.id)); }
  function rebuild() {
    if (pending) return; pending = true;
    (root.requestAnimationFrame || setTimeout)(function () {
      pending = false;
      if (!parts.meta || !layout.known.plays || !layout.known.ratings) return;   // wait until we know which layout the rules allow
      var m = parts.meta;
      var d = { version: 1, updated: m.updated || null, opponents: m.opponents || [], activeGame: m.activeGame || null, roster: [], games: [], teamPlays: [], ratings: {} };
      Object.keys(parts.roster).forEach(function (id) { d.roster.push(parts.roster[id]); });
      var logs = {}; Object.keys(parts.log).forEach(function (id) { var l = parts.log[id]; (logs[l.game] = logs[l.game] || []).push(l); });
      Object.keys(parts.games).forEach(function (id) {
        var g = Object.assign({}, parts.games[id]);
        g.log = (logs[id] || []).sort(function (a, b) { return (a.ts || '').localeCompare(b.ts || ''); });
        d.games.push(g);
      });
      var legacyPlays = (m.teamPlays || []).map(function (p) { return unpackPlay(Object.assign({}, p)); }).filter(Boolean), legacyRatings = m.ratings || {}, hasLegacy = 'teamPlays' in m || 'ratings' in m;
      if (layout.split) {
        // what's really stored in the new documents — the diff for the next save starts from this
        d.teamPlays = Object.keys(parts.plays).map(function (id) { return unpackPlay(parts.plays[id]); }).filter(Boolean).sort(byCreated);
        Object.keys(parts.ratings).forEach(function (id) { d.ratings[id] = parts.ratings[id].v; });
        last = units(d);
        // anything still in the old fields is shown too (and moved over below when an editor is signed in)
        legacyPlays.forEach(function (p, i) { if (!parts.plays[p.id]) d.teamPlays.push(Object.assign({}, p, { created: p.created || '0-' + pad3(i) })); });
        d.teamPlays.sort(byCreated);
        Object.keys(legacyRatings).forEach(function (id) { if (!(id in d.ratings)) d.ratings[id] = legacyRatings[id]; });
      } else {
        d.teamPlays = legacyPlays; d.ratings = legacyRatings;
        last = units(d);
      }
      ST.replaceData(d);
      if (firstData) { var f = firstData; firstData = null; f(); }
      if (layout.split && layout.server.plays && layout.server.ratings && hasLegacy && C.can('edit') && !migrating) { migrating = true; writeAll(ST.S.data, true); }
    });
  }
  function listen() {
    unsubs.forEach(function (u) { u(); }); unsubs = [];
    parts = { meta: null, roster: {}, games: {}, log: {}, plays: {}, ratings: {} };
    layout = { known: { plays: false, ratings: false }, server: {}, split: true }; migrating = false;
    function coll(name, onErr) {
      unsubs.push(teamRef.collection(name).onSnapshot(function (snap) {
        snap.docChanges().forEach(function (ch) { if (ch.type === 'removed') delete parts[name][ch.doc.id]; else parts[name][ch.doc.id] = Object.assign({ id: ch.doc.id }, ch.doc.data()); });
        if (name in layout.known) {
          layout.known[name] = true;
          if (!(snap.metadata && snap.metadata.fromCache)) layout.server[name] = true;   // the server itself said yes, not just the copy on this device
        }
        rebuild();
      }, onErr || snapErr));
    }
    // plays + ratings: if the rules don't allow these yet, carry on with the old layout instead of locking people out
    function newLayoutErr(name) {
      return function (e) {
        if (e.code !== 'permission-denied') return snapErr(e);
        layout.split = false; layout.known[name] = true;
        if (C.role === 'coach' && !layout.warned) { layout.warned = true; root.APP && APP.toast('Coach: publish the new firestore.rules in the Firebase console (Firestore → Rules) to finish the update.'); }
        rebuild();
      };
    }
    coll('plays', newLayoutErr('plays')); coll('ratings', newLayoutErr('ratings'));
    unsubs.push(teamRef.onSnapshot(function (doc) { parts.meta = doc.data() || {}; rebuild(); }, snapErr));
    coll('roster'); coll('games'); coll('log');
    unsubs.push(teamRef.collection('members').onSnapshot(function (snap) {
      C.members = snap.docs.map(function (d) { return Object.assign({ email: d.id }, d.data()); });
      var me = C.members.filter(function (m) { return m.email === C.user.email.toLowerCase(); })[0];
      if (!me) { stop(); notMemberScreen(C.user); return; }
      C.member = me; C.role = me.role; applyRole();
      root.APP && APP.refreshAccess && APP.refreshAccess();
    }, snapErr));
  }
  function snapErr(e) { if (e.code === 'permission-denied') { stop(); notMemberScreen(C.user); } else root.APP && APP.toast('Sync problem: ' + friendly(e)); }
  function stop() { unsubs.forEach(function (u) { u(); }); unsubs = []; }

  function applyRole() {
    document.body.classList.remove('role-coach', 'role-editor', 'role-player');
    document.body.classList.add('role-' + (C.role || 'player'), 'cloud');
    var chip = document.getElementById('user-chip');
    if (chip) chip.innerHTML = '<span class="uc-name">' + esc((C.member && C.member.name) || C.user.displayName || C.user.email) + '</span><span class="uc-role">' + esc(C.role || '') + '</span><button class="linkbtn" id="uc-out">Sign out</button>';
    var out = document.getElementById('uc-out'); if (out) out.onclick = function () { if (confirm('Sign out of the B2A playbook? The team data saved on this device is removed too.')) signOutAndClear(); };
  }

  function signOutAndClear() {
    var go = function () { location.reload(); };
    auth.signOut().then(function () { return db.terminate(); }).then(function () { return db.clearPersistence(); }).then(go, go);
  }
  function isOffline(e) { return e && (e.code === 'unavailable' || /offline|network/i.test(e.message || '')); }
  function getRetry(ref, n, k) {   // retry with backoff while the connection warms up
    k = k || 0;
    return ref.get().catch(function (e) {
      if (!isOffline(e) || k >= n) throw e;
      showGate('<h2>Signing in…</h2><p class="hint">Weak connection — trying again (' + (k + 1) + '/' + n + ')…</p>');
      return new Promise(function (r) { setTimeout(r, 1500 * (k + 1)); }).then(function () { return getRetry(ref, n, k + 1); });
    });
  }
  function onUser(user) {
    stop(); C.user = user;
    if (!user) { C.member = null; C.role = null; signInScreen(); return; }
    var pw = user.providerData.some(function (p) { return p.providerId === 'password'; });
    if (pw && !user.emailVerified) { verifyScreen(user); return; }
    var em = user.email.toLowerCase();
    showGate('<h2>Signing in…</h2><p class="hint">' + esc(em) + '</p>');
    getRetry(teamRef.collection('members').doc(em), 4).then(function (doc) {
      if (doc.exists) {
        C.member = Object.assign({ email: em }, doc.data()); C.role = C.member.role;
        // fill in a display name the first time
        if (!C.member.name && user.displayName && C.role === 'coach') doc.ref.update({ name: user.displayName }).catch(function () { });
        firstData = function () { hideGate(); C.ready = true; applyRole(); if (C.resolveStart) { C.resolveStart(ST.S.data); C.resolveStart = null; } };
        listen();
        return;
      }
      // not on the list: if the team doesn't exist yet, this person can set it up; otherwise ask the coach
      return getRetry(teamRef, 2).then(function (t) { if (!t.exists) setupScreen(user); else notMemberScreen(user); })
        .catch(function () { notMemberScreen(user); });
    }).catch(function (e) {
      var off = isOffline(e);
      showGate('<h2>Can’t reach the team data</h2><p class="gate-msg">' + esc(friendly(e)) + '</p>' +
        (off ? '<p class="hint">You’re signed in fine — the connection to the team database just isn’t getting through. Try: <b>switch to Wi-Fi</b> (or move to better signal) · turn off any <b>ad blocker / VPN</b> · on Samsung/Android set <b>Settings → Connections → More connection settings → Private DNS</b> to <i>Automatic</i> · then tap Retry.</p>'
             : '<p class="hint">If this is the first setup, make sure the rules from <b>firestore.rules</b> are published.</p>') +
        '<button class="btn primary full" id="g-retry2">Retry</button><button class="btn ghost full" id="g-out2">Sign out</button>');
      document.getElementById('g-retry2').onclick = function () { onUser(auth.currentUser); };
      document.getElementById('g-out2').onclick = function () { auth.signOut(); };
    });
  }

  /* ---------------- public API ---------------- */
  C.start = function (store) {
    ST = store;
    showGate('<h2>Loading…</h2>');
    return new Promise(function (resolve) {
      C.resolveStart = resolve;
      loadSDK().then(function () {
        firebase.initializeApp(CFG);
        auth = firebase.auth(); db = firebase.firestore();
        // long polling instead of the streaming channel: much more reliable on weak mobile data, carrier proxies and ad-blocking DNS
        try { if (db.settings) db.settings({ experimentalForceLongPolling: true }); } catch (x) { }
        // keep a copy on this device so the site opens and saves with no signal (syncs when it's back)
        try { db.enablePersistence({ synchronizeTabs: true }).catch(function () { }); } catch (x) { }
        root.addEventListener('online', syncChanged); root.addEventListener('offline', function () { syncChanged(); root.APP && APP.toast('No signal — keep going, changes sync when you’re back online.'); });
        teamRef = db.collection('teams').doc(TEAM);
        var redirecting = false; try { redirecting = sessionStorage.getItem('b2a.redirect') === '1'; sessionStorage.removeItem('b2a.redirect'); } catch (x) { }
        if (redirecting) auth.getRedirectResult().catch(function (e) { signInScreen(esc(friendly(e))); });
        auth.onAuthStateChanged(onUser);
      }).catch(function (e) { showGate('<h2>Couldn’t load sign-in</h2><p class="gate-msg">' + esc(e.message) + '</p><p class="hint">Check your connection and reload.</p>'); });
    });
  };
  C.save = function (data) { if (C.ready && C.user) return writeAll(data); return Promise.resolve(); };
  C.can = function (what) {
    if (!C.enabled) return true;
    if (C.role === 'coach' || C.role === 'editor') return true;
    return what === 'log' || what === 'score';
  };
  /* team access (coach only) */
  C.addMember = function (email, role, playerId) {
    email = (email || '').trim().toLowerCase(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return Promise.reject(new Error('Enter a valid email.'));
    var p = (ST.S.data.roster || []).filter(function (x) { return x.id === playerId; })[0];
    return teamRef.collection('members').doc(email).set({ role: role || 'player', playerId: playerId || null, name: p ? p.name : '', addedAt: new Date().toISOString(), addedBy: C.user.email });
  };
  C.updateMember = function (email, fields) {
    if (fields.playerId !== undefined) { var p = (ST.S.data.roster || []).filter(function (x) { return x.id === fields.playerId; })[0]; fields.name = p ? p.name : ''; }
    return teamRef.collection('members').doc(email).update(fields);
  };
  C.removeMember = function (email) { return teamRef.collection('members').doc(email).delete(); };
  root.B2A_CLOUD = C;
})(window);
