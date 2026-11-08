/* B2A season data: games, game plans, play results log, play ratings, team plays, roster, opponent scouting.
   The team's copy lives in Firebase (see cloud.js): every save goes straight to the whole team.
   With no Firebase config (js/firebase-config.js = null) the site runs in TEST MODE: data lives only in
   this browser tab and is gone on reload. That mode exists for automated tests and is flagged with a banner. */
(function (root) {
  'use strict';
  var LEGACY_TOKEN_KEY = 'b2a.ghtoken';   // GitHub token from the old "Publish" mode — removed from devices on load

  var OFF_RESULTS = [
    { k: 'td', label: 'Touchdown', ok: true },
    { k: 'first', label: '1st down', ok: true },
    { k: 'gain', label: 'Good gain', ok: true },
    { k: 'short', label: 'Short / no gain', ok: false },
    { k: 'inc', label: 'Incomplete', ok: false },
    { k: 'loss', label: 'Sack / loss', ok: false },
    { k: 'to', label: 'INT / turnover', ok: false },
    { k: 'pen', label: 'Penalty on us', ok: false }
  ];
  var DEF_RESULTS = [
    { k: 'stop', label: 'Stop / incomplete', ok: true },
    { k: 'held', label: 'Held short', ok: true },
    { k: 'sack', label: 'Sack', ok: true },
    { k: 'int', label: 'INT / turnover', ok: true },
    { k: 'first', label: 'Gave up 1st down', ok: false },
    { k: 'td', label: 'Gave up TD', ok: false },
    { k: 'pen', label: 'Penalty on us', ok: false }
  ];
  function resultInfo(side, k) {
    var list = side === 'def' ? DEF_RESULTS : OFF_RESULTS;
    return list.filter(function (r) { return r.k === k; })[0] || { label: k, ok: false };
  }

  function empty() { return { version: 1, updated: null, teamPlays: [], ratings: {}, opponents: [], games: [], activeGame: null, roster: [], scout: [] }; }
  function uid(p) { return (p || 'g') + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  // today's date where you are (toISOString gives tomorrow's date on US evenings)
  function localDate(d) { d = d || new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function cloud() { var CL = root.B2A_CLOUD; return CL && CL.enabled ? CL : null; }

  var S = { data: empty(), listeners: [], loaded: false };

  /* fill in anything missing so the rest of the site can rely on every field existing */
  function normalize(d) {
    var e = empty(); d = d || {};
    Object.keys(e).forEach(function (k) { if (d[k] == null) d[k] = e[k]; });
    d.games.forEach(function (g) {
      g.plan = g.plan || { off: [], def: [] };
      g.log = g.log || [];
      g.us = g.us || 0; g.them = g.them || 0;
      g.assign = g.assign || { off: {}, def: {} };
    });
    return d;
  }

  function load() {
    try { localStorage.removeItem(LEGACY_TOKEN_KEY); } catch (e) { }
    var CL = cloud();
    if (CL) return CL.start(root.B2A_STORE);
    // test mode
    document.body.classList.add('test-mode');
    S.data = normalize(empty()); S.loaded = true; emit();
    return Promise.resolve(S.data);
  }
  function save(silent) {
    S.data.updated = new Date().toISOString();
    if (!silent) emit();
    var CL = cloud();
    if (CL) CL.save(S.data);
  }
  function replaceData(d) { S.data = normalize(d); S.loaded = true; emit(); }   // called by cloud.js on every live update
  function on(fn) { S.listeners.push(fn); }
  function emit() { S.listeners.forEach(function (fn) { try { fn(S.data); } catch (e) { console.error(e); } }); }

  /* backup: the whole season as one JSON file */
  function download() {
    var blob = new Blob([JSON.stringify(S.data, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'b2a-backup-' + localDate() + '.json'; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  /* ---- games ---- */
  function game(id) {
    id = id || S.data.activeGame;
    return S.data.games.filter(function (g) { return g.id === id; })[0] || null;
  }
  function newGame(opp, date) {
    opp = (opp || '').trim() || 'Opponent';
    // same team typed differently ("sharks" vs "Sharks"): use the spelling we already have
    var known = S.data.opponents.concat((S.data.scout || []).map(function (o) { return o.name; }))
      .filter(function (n) { return n && n.toLowerCase() === opp.toLowerCase(); })[0];
    if (known) opp = known;
    if (S.data.opponents.indexOf(opp) < 0) S.data.opponents.push(opp);
    var prev = S.data.games.slice().reverse().filter(function (g) { return g.opp === opp; })[0];
    var g = {
      id: uid('g'), opp: opp, date: date || localDate(), us: 0, them: 0, notes: '', log: [],
      plan: { off: [], def: [] }, assign: { off: {}, def: {} },
      series: { down: 1, sit: 'own' }, half: 1, to: { 1: false, 2: false }
    };
    if (prev) {   // start from the last plan vs this team
      g.plan = JSON.parse(JSON.stringify(prev.plan));
      g.assign = JSON.parse(JSON.stringify(prev.assign || { off: {}, def: {} }));
    }
    S.data.games.push(g); S.data.activeGame = g.id; save();
    return g;
  }
  function deleteGame(id) {
    S.data.games = S.data.games.filter(function (g) { return g.id !== id; });
    if (S.data.activeGame === id) S.data.activeGame = S.data.games.length ? S.data.games[S.data.games.length - 1].id : null;
    save();
  }
  function logPlay(entry) {
    var g = game(); if (!g) return null;
    entry.id = uid('l'); entry.ts = new Date().toISOString();
    var CL = cloud();
    if (CL && CL.user) { entry.by = CL.user.uid; entry.byName = (CL.member && CL.member.name) || CL.user.displayName || CL.user.email; }
    g.log.push(entry); save();
    return entry;
  }

  /* ---- ratings ---- */
  function rating(id) { return S.data.ratings[id] || 0; }
  function rate(id, v) { if (S.data.ratings[id] === v) delete S.data.ratings[id]; else S.data.ratings[id] = v; save(); }

  /* ---- stats ---- */
  function entries(filter) {
    filter = filter || {};
    var out = [];
    S.data.games.forEach(function (g) {
      if (filter.opp && g.opp !== filter.opp) return;
      if (filter.game && g.id !== filter.game) return;
      g.log.forEach(function (l) { if (!filter.side || l.side === filter.side) out.push(Object.assign({ game: g.id, opp: g.opp }, l)); });
    });
    return out;
  }
  function playStats(filter) {
    var m = {};
    entries(filter).forEach(function (l) {
      var key = l.play; if (!key) return;
      var s = m[key] || (m[key] = { play: key, side: l.side, calls: 0, ok: 0, yds: 0, ydsN: 0, td: 0, to: 0 });
      s.calls++;
      if (resultInfo(l.side, l.result).ok) s.ok++;
      if (l.yds != null && l.yds !== '') { s.yds += +l.yds; s.ydsN++; }
      if (l.side === 'off' && l.result === 'td') s.td++;
      if ((l.side === 'off' && l.result === 'to') || (l.side === 'def' && l.result === 'int')) s.to++;
    });
    return m;
  }

  root.B2A_STORE = {
    S: S, OFF_RESULTS: OFF_RESULTS, DEF_RESULTS: DEF_RESULTS, resultInfo: resultInfo,
    load: load, save: save, on: on, replaceData: replaceData, download: download,
    game: game, newGame: newGame, deleteGame: deleteGame, logPlay: logPlay, rating: rating, rate: rate,
    entries: entries, playStats: playStats, uid: uid, localDate: localDate
  };
})(window);
