/* B2A season data: games, game plans, play results log, play ratings, team plays.
   The team-wide copy lives in data/season.json in the repo (served by GitHub Pages).
   The coach edits a working copy in this browser and taps Publish, which commits data/season.json
   through the GitHub API using a personal access token stored only on the coach's device. */
(function (root) {
  'use strict';
  var CFG = { owner: 'xSOSAxDEXx', repo: 'B2A', branch: 'main', path: 'data/season.json' };
  var LS_LOCAL = 'b2a.season.local.v1', LS_TOKEN = 'b2a.ghtoken', LS_OLD_CUSTOM = 'b2a.custom.v1';

  var OFF_RESULTS = [
    { k: 'td', label: 'Touchdown', ok: true }, { k: 'first', label: '1st down', ok: true }, { k: 'gain', label: 'Good gain', ok: true },
    { k: 'short', label: 'Short / no gain', ok: false }, { k: 'inc', label: 'Incomplete', ok: false }, { k: 'loss', label: 'Sack / loss', ok: false },
    { k: 'to', label: 'INT / turnover', ok: false }, { k: 'pen', label: 'Penalty on us', ok: false }
  ];
  var DEF_RESULTS = [
    { k: 'stop', label: 'Stop / incomplete', ok: true }, { k: 'held', label: 'Held short', ok: true }, { k: 'sack', label: 'Sack', ok: true },
    { k: 'int', label: 'INT / turnover', ok: true }, { k: 'first', label: 'Gave up 1st down', ok: false }, { k: 'td', label: 'Gave up TD', ok: false },
    { k: 'pen', label: 'Penalty on us', ok: false }
  ];
  function resultInfo(side, k) { return (side === 'def' ? DEF_RESULTS : OFF_RESULTS).filter(function (r) { return r.k === k; })[0] || { label: k, ok: false }; }

  function empty() { return { version: 1, updated: null, teamPlays: [], ratings: {}, opponents: [], games: [], activeGame: null, roster: [] }; }
  function uid(p) { return (p || 'g') + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
  function loadLS(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function saveLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

  var S = { data: empty(), remote: null, dirty: false, listeners: [], loaded: false };

  function normalize(d) {
    var e = empty(); d = d || {};
    Object.keys(e).forEach(function (k) { if (d[k] == null) d[k] = e[k]; });
    d.games.forEach(function (g) { g.plan = g.plan || { off: [], def: [] }; g.log = g.log || []; g.us = g.us || 0; g.them = g.them || 0; g.assign = g.assign || { off: {}, def: {} }; });
    return d;
  }

  function load() {
    var local = loadLS(LS_LOCAL, null);
    var url = CFG.path + '?v=' + Date.now();
    return fetch(url, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (remote) {
      S.remote = remote ? normalize(remote) : null;
      if (local && (!S.remote || (local.updated || '') > (S.remote.updated || '')) && local._dirty) { S.data = normalize(local); S.dirty = true; }
      else { S.data = normalize(remote ? JSON.parse(JSON.stringify(remote)) : (local || empty())); S.dirty = false; }
      // migrate plays saved by the first version of the site
      var old = loadLS(LS_OLD_CUSTOM, null);
      if (old && old.length) {
        old.forEach(function (p) { if (!S.data.teamPlays.some(function (q) { return q.id === p.id; })) S.data.teamPlays.push(p); });
        try { localStorage.removeItem(LS_OLD_CUSTOM); } catch (e) { }
        save(true);
      }
      S.loaded = true; emit();
      return S.data;
    });
  }
  function save(silent) {
    S.data.updated = new Date().toISOString();
    S.dirty = true;
    var copy = JSON.parse(JSON.stringify(S.data)); copy._dirty = true;
    saveLS(LS_LOCAL, copy);
    if (!silent) emit();
  }
  function discardLocal() {
    try { localStorage.removeItem(LS_LOCAL); } catch (e) { }
    S.data = normalize(S.remote ? JSON.parse(JSON.stringify(S.remote)) : empty()); S.dirty = false; emit();
  }
  function on(fn) { S.listeners.push(fn); }
  function emit() { S.listeners.forEach(function (fn) { try { fn(S.data); } catch (e) { console.error(e); } }); }

  /* ---- publish to GitHub ---- */
  function token(v) { if (v !== undefined) { if (v) saveLS(LS_TOKEN, v); else try { localStorage.removeItem(LS_TOKEN); } catch (e) { } } return loadLS(LS_TOKEN, ''); }
  function b64(str) { return btoa(unescape(encodeURIComponent(str))); }
  function publish() {
    var tk = token(); if (!tk) return Promise.reject(new Error('Add your GitHub token in Coach tools first.'));
    var api = 'https://api.github.com/repos/' + CFG.owner + '/' + CFG.repo + '/contents/' + CFG.path;
    var headers = { Authorization: 'Bearer ' + tk, Accept: 'application/vnd.github+json' };
    var out = JSON.parse(JSON.stringify(S.data)); delete out._dirty; out.updated = new Date().toISOString();
    return fetch(api + '?ref=' + CFG.branch, { headers: headers, cache: 'no-store' }).then(function (r) {
      if (r.status === 404) return null;
      if (!r.ok) throw new Error('GitHub said ' + r.status + (r.status === 401 ? ' — the token is invalid or expired.' : ''));
      return r.json();
    }).then(function (cur) {
      var body = { message: 'Update season data (game plans, results, ratings)', content: b64(JSON.stringify(out, null, 2) + '\n'), branch: CFG.branch };
      if (cur && cur.sha) body.sha = cur.sha;
      return fetch(api, { method: 'PUT', headers: headers, body: JSON.stringify(body) });
    }).then(function (r) {
      if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) { throw new Error('Publish failed (' + r.status + '): ' + (j.message || '')); });
      S.data.updated = out.updated; S.remote = JSON.parse(JSON.stringify(out)); S.dirty = false;
      try { localStorage.removeItem(LS_LOCAL); } catch (e) { }
      emit();
    });
  }
  function download() {
    var out = JSON.parse(JSON.stringify(S.data)); delete out._dirty;
    var blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'season.json'; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  /* ---- games ---- */
  function game(id) { id = id || S.data.activeGame; return S.data.games.filter(function (g) { return g.id === id; })[0] || null; }
  function newGame(opp, date) {
    opp = (opp || '').trim() || 'Opponent';
    if (S.data.opponents.indexOf(opp) < 0) S.data.opponents.push(opp);
    var prev = S.data.games.slice().reverse().filter(function (g) { return g.opp === opp; })[0];
    var g = { id: uid('g'), opp: opp, date: date || new Date().toISOString().slice(0, 10), us: 0, them: 0, plan: { off: [], def: [] }, assign: { off: {}, def: {} }, notes: '', log: [], series: { down: 1, sit: 'own' }, half: 1, to: { 1: false, 2: false } };
    if (prev) { g.plan = JSON.parse(JSON.stringify(prev.plan)); g.assign = JSON.parse(JSON.stringify(prev.assign || { off: {}, def: {} })); }   // start from last plan vs this team
    S.data.games.push(g); S.data.activeGame = g.id; save();
    return g;
  }
  function deleteGame(id) { S.data.games = S.data.games.filter(function (g) { return g.id !== id; }); if (S.data.activeGame === id) S.data.activeGame = S.data.games.length ? S.data.games[S.data.games.length - 1].id : null; save(); }
  function logPlay(entry) {
    var g = game(); if (!g) return null;
    entry.id = uid('l'); entry.ts = new Date().toISOString();
    g.log.push(entry); save(); return entry;
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
      s.calls++; if (resultInfo(l.side, l.result).ok) s.ok++;
      if (l.yds != null && l.yds !== '') { s.yds += +l.yds; s.ydsN++; }
      if ((l.side === 'off' && l.result === 'td')) s.td++;
      if ((l.side === 'off' && l.result === 'to') || (l.side === 'def' && l.result === 'int')) s.to++;
    });
    return m;
  }
  function successRate(id, filter) { var s = playStats(filter)[id]; return s && s.calls ? s.ok / s.calls : null; }

  root.B2A_STORE = {
    CFG: CFG, S: S, OFF_RESULTS: OFF_RESULTS, DEF_RESULTS: DEF_RESULTS, resultInfo: resultInfo,
    load: load, save: save, on: on, discardLocal: discardLocal, publish: publish, download: download, token: token,
    game: game, newGame: newGame, deleteGame: deleteGame, logPlay: logPlay, rating: rating, rate: rate,
    entries: entries, playStats: playStats, successRate: successRate, uid: uid
  };
})(window);
