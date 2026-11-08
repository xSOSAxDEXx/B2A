/* B2A Playbook — core helpers, animator and the Plays tab. Other tabs live in their own files and hook into window.APP. */
(function () {
  'use strict';
  var E = window.B2A, D = E.DEF, ST = window.B2A_STORE;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = window.B2A_ESC;
  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 2800); }
  function copyText(txt, msg) {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { toast(msg); }, function () { prompt('Copy this:', txt); });
    else prompt('Copy this:', txt);
  }
  function b64e(s) { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function b64d(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return decodeURIComponent(escape(atob(s))); }
  function isLive() { var C = window.B2A_CLOUD; return !!(C && C.enabled); }
  function pct(x) { return x == null ? '—' : Math.round(x * 100) + '%'; }

  var CAT_NAME = {}; B2A_CATS.forEach(function (c) { CAT_NAME[c[0]] = c[1]; });
  var shared = null;

  /* ---------- play catalog ----------
     Built once and re-used until the team plays change (it used to be re-cloned on every lookup).
     Callers only read these objects; anything that edits a play clones it first. */
  var cat = { key: null, off: [], offById: {}, def: null, defById: {} };
  function buildOff() {
    var tp = ST.S.data.teamPlays || [], key = JSON.stringify(tp) + (shared ? '|shared' : '');
    if (cat.key === key) return;
    var list = B2A_PLAYS.map(function (p, i) { var c = E.clone(p); c.num = i + 1; return c; });
    tp.forEach(function (p, i) { var c = E.clone(p); c.custom = true; c.cat = c.cat || 'team'; c.num = 'T' + (i + 1); list.push(c); });
    if (shared) list.push(shared);
    cat.key = key; cat.off = list; cat.offById = {};
    list.forEach(function (p) { if (!cat.offById[p.id]) cat.offById[p.id] = p; });
  }
  function buildDef() {
    if (cat.def) return;
    cat.def = B2A_DEF_PLAYS.map(function (p, i) { var c = E.clone(p); c.num = 'D' + (i + 1); c.side = 'def'; return c; });
    cat.def.forEach(function (d) { cat.defById[d.id] = d; });
  }
  function offPlays() { buildOff(); return cat.off.slice(); }
  function defPlays() { buildDef(); return cat.def.slice(); }
  function findOff(id) { buildOff(); return cat.offById[id]; }
  function findDef(id) { buildDef(); return cat.defById[id]; }
  function findAny(id) { return findOff(id) || findDef(id); }
  function isRun(p) { return !(p.events || []).some(function (e) { return e.type === 'pass'; }); }
  function playName(id) { var p = findAny(id); return p ? p.name : id; }
  function playNum(id) { var p = findAny(id); return p ? p.num : '?'; }

  /* ---------- static diagrams ---------- */
  var thumbCache = {}, thumbN = 0;
  function offSVG(p, crop, uid) { return E.staticPlaySVG(p, { crop: crop || [-7, 18], uid: uid }); }
  function defSVG(def, offId, crop, uid) {
    var off = findOff(offId || def.vs) || B2A_PLAYS[0];
    var sim = E.buildSim(off), ds = D.simulate(def, sim);
    uid = uid || ('d' + Math.random().toString(36).slice(2, 7));
    return '<svg viewBox="' + E.viewBox(crop || [-7, 18]) + '" xmlns="http://www.w3.org/2000/svg" class="field-svg">' + E.fieldSVG(sim.P, { uid: uid }) +
      D.assignmentsSVG(ds, sim) + '<g class="ghost-off">' + E.playersSVG(sim, sim.tStart, null, { showBall: false }) + '</g>' + D.defendersSVG(ds, sim.tStart) + '</svg>';
  }
  function thumb(p, crop) {
    var key = (p.side || 'off') + JSON.stringify(p) + (crop || '');
    if (!thumbCache[key]) thumbCache[key] = p.side === 'def' ? defSVG(p, null, crop, 't' + (thumbN++)) : offSVG(p, crop, 't' + (thumbN++));
    return thumbCache[key];
  }

  /* ---------- Animator: offense play + optional defense ---------- */
  function Animator(svg, onTick) {
    this.svg = svg; this.onTick = onTick; this.speed = 0.6; this.running = false; this.t = 0;
    this.uid = 'a' + Math.random().toString(36).slice(2, 6);
  }
  Animator.prototype.load = function (off, def, mode) {
    this.stop();
    this.mode = mode || 'off';
    this.sim = E.buildSim(off);
    this.dsim = def ? D.simulate(def, this.sim) : null;
    this.tEnd = this.dsim ? Math.min(this.sim.tEnd, this.dsim.result.t + 0.8) : this.sim.tEnd;
    var defMode = this.mode === 'def';
    this.svg.setAttribute('viewBox', E.viewBox());
    this.svg.innerHTML = E.fieldSVG(this.sim.P, { uid: this.uid }) +
      (this.dsim ? D.assignmentsSVG(this.dsim, this.sim, { faint: !defMode }) : '') +
      E.routesSVG(this.sim, { uid: this.uid, ghost: defMode }) + '<g class="dyn"></g>' +
      (this.overlay ? '<g class="edit-layer">' + this.overlay(this) + '</g>' : '');
    this.dyn = this.svg.querySelector('.dyn');
    this.t = this.sim.tStart;
    this.draw();
  };
  Animator.prototype.draw = function () {
    var defMode = this.mode === 'def', t = this.dsim ? Math.min(this.t, this.dsim.result.t) : this.t, s = '';
    if (this.dsim && !defMode) s += D.defendersSVG(this.dsim, t, { marks: true });
    s += (defMode ? '<g class="ghost-off">' : '') + E.playersSVG(this.sim, t, null) + (defMode ? '</g>' : '');
    if (this.dsim && defMode) s += D.defendersSVG(this.dsim, t);
    if (this.dsim) s += D.resultSVG(this.dsim.result, this.t);
    this.dyn.innerHTML = s;
    if (this.onTick) this.onTick(t, this);
  };
  Animator.prototype.start = function () {
    var self = this;
    if (this.t >= this.tEnd - 0.01) this.t = this.sim.tStart;
    this.running = true;
    var last = performance.now();
    function loop(now) {
      if (!self.running) return;
      self.t += Math.min(0.1, (now - last) / 1000) * self.speed; last = now;
      if (self.t >= self.tEnd) { self.t = self.tEnd; self.running = false; }
      self.svg.classList.toggle('running', self.running);
      self.draw();
      if (self.running) self.raf = requestAnimationFrame(loop);
    }
    this.raf = requestAnimationFrame(loop);
    this.draw();
  };
  Animator.prototype.stop = function () { this.running = false; this.svg.classList.remove('running'); cancelAnimationFrame(this.raf); };
  Animator.prototype.reset = function () { this.stop(); this.t = this.sim.tStart; this.draw(); };
  Animator.prototype.seek = function (f) { this.stop(); this.t = this.sim.tStart + f * (this.tEnd - this.sim.tStart); this.draw(); };

  /* ---------- tabs ---------- */
  var tabHooks = {};
  function showTab(name) {
    $$('.tab').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === name); });
    $$('.panel').forEach(function (p) { p.classList.toggle('active', p.id === 'tab-' + name); });
    if (tabHooks[name]) tabHooks[name]();
    try { sessionStorage.setItem('b2a.tab', name); } catch (e) { }   // a reload comes back to the same tab
    window.scrollTo({ top: 0 });
  }
  $$('.tab').forEach(function (b) { b.addEventListener('click', function () { showTab(b.dataset.tab); }); });

  /* ---------- game plan helpers (used by several tabs) ---------- */
  function activeGame() { return ST.game(); }
  function inPlan(id, side) { var g = activeGame(); return !!(g && g.plan[side].indexOf(id) >= 0); }
  function togglePlan(id, side) {
    var g = activeGame();
    if (!g) { toast('Create this week’s game in Game Day first.'); showTab('gameday'); return false; }
    var a = g.plan[side], i = a.indexOf(id);
    if (i >= 0) a.splice(i, 1); else a.push(id);
    ST.save(); toast(i >= 0 ? 'Removed from the game plan.' : 'Added to the ' + g.opp + ' game plan.');
    return true;
  }

  /* ================= PLAYS TAB ================= */
  var view = { side: 'off', id: B2A_PLAYS[0].id, defId: B2A_DEF_PLAYS[0].id, flip: false, cat: 'all', sort: 'book', q: '', vsOff: '', vsDef: {}, throwTo: {}, mods: {}, adjust: false, opp: null };

  /* Category dropdown: [value, label]. 't:' = filter by tag */
  var OFF_FILTERS = [['all', 'All offense']].concat(B2A_CATS).concat([
    ['team', 'Team plays (designed)'], ['t:pass', '— Pass plays'], ['t:run', '— Runs'],
    ['t:vs-blitz', '— vs blitz'], ['t:vs-man', '— vs man'], ['t:vs-zone', '— vs zone'],
    ['t:third-down', '— 3rd down'], ['t:short-yardage', '— Short yardage']
  ]);
  var DEF_FILTERS = [
    ['all', 'All defense'], ['t:man', 'Man'], ['t:zone', 'Zone'], ['t:pressure', 'Pressure / blitz'],
    ['t:no-blitz', 'No blitz'], ['t:third-down', '3rd down'], ['t:red-zone', 'Red zone / prevent']
  ];
  function fillCatSelect() {
    var opts = view.side === 'off' ? OFF_FILTERS : DEF_FILTERS;
    $('#f-cat').innerHTML = opts.map(function (o) { return '<option value="' + o[0] + '">' + esc(o[1]) + '</option>'; }).join('');
    $('#f-cat').value = view.cat;
  }
  $('#side-switch').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    setSide(b.dataset.side);
  });
  function setSide(side) {
    view.side = side; view.cat = 'all';
    $$('#side-switch button').forEach(function (x) { x.classList.toggle('on', x.dataset.side === side); });
    fillCatSelect(); renderList(); select(side === 'off' ? view.id : view.defId);
  }
  $('#f-cat').addEventListener('change', function (e) { view.cat = e.target.value; renderList(); });
  $('#f-sort').addEventListener('change', function (e) { view.sort = e.target.value; renderList(); });
  $('#search').addEventListener('input', function (e) { view.q = e.target.value.toLowerCase(); renderList(); });

  function matches(p) {
    var c = view.cat, tags = p.tags || [];
    if (view.q && (p.name + ' ' + tags.join(' ') + ' ' + (p.front || '')).toLowerCase().indexOf(view.q) < 0) return false;
    if (c === 'all') return true;
    if (c === 'team') return !!p.custom;
    if (c === 't:run') return isRun(p);
    if (c === 't:pass') return !isRun(p);
    if (c.indexOf('t:') === 0) return tags.indexOf(c.slice(2)) >= 0;
    return p.cat === c;
  }
  function sortList(list, side) {
    if (view.sort === 'book') return list;
    var stats = ST.playStats({ side: side });
    var key = {
      success: function (p) { var s = stats[p.id]; return s && s.calls ? s.ok / s.calls + s.calls / 1000 : -1; },
      rating: function (p) { return ST.rating(p.id); },
      plan: function (p) { return inPlan(p.id, side) ? 1 : 0; }
    }[view.sort];
    return list.map(function (p, i) { return { p: p, k: key(p), i: i }; }).sort(function (a, b) { return b.k - a.k || a.i - b.i; }).map(function (x) { return x.p; });
  }
  function tagHTML(p) {
    var out = '';
    if (p.custom) out += '<span class="tag custom">team</span>';
    if (inPlan(p.id, p.side === 'def' ? 'def' : 'off')) out += '<span class="tag plan">plan</span>';
    var r = ST.rating(p.id); if (r) out += '<span class="tag ' + (r > 0 ? 'up' : 'down') + '">' + ICON(r > 0 ? 'up' : 'down') + '</span>';
    var s = ST.playStats({ side: p.side === 'def' ? 'def' : 'off' })[p.id];
    if (s && s.calls) out += '<span class="tag stat">' + s.ok + '/' + s.calls + '</span>';
    return out + (p.tags || []).slice(0, 2).map(function (t) { return '<span class="tag ' + t + '">' + t.replace(/-/g, ' ') + '</span>'; }).join('');
  }
  function renderList() {
    var side = view.side;
    var list = sortList((side === 'off' ? offPlays() : defPlays()).filter(matches), side);
    var html = '', last = null, cur = side === 'off' ? view.id : view.defId;
    list.forEach(function (p) {
      var g = view.sort !== 'book' ? '' : side === 'def' ? 'Defensive calls' : p.shared ? 'Shared with you' : p.custom ? 'Team plays' : CAT_NAME[p.cat] || 'Other';
      if (g && g !== last) { html += '<div class="group-label">' + esc(g) + '</div>'; last = g; }
      html += '<button class="pcard' + (p.id === cur ? ' active' : '') + '" data-id="' + esc(p.id) + '"><div class="thumb">' + thumb(p) + '</div><div><div class="pname"><span class="num">' + esc(p.num) + '</span>' + esc(p.name) + '</div>' +
        (p.front ? '<div class="front">' + esc(p.front) + '</div>' : '') + '<div class="tagrow">' + tagHTML(p) + '</div></div></button>';
    });
    $('#play-list').innerHTML = html || '<p class="hint">No plays match.</p>';
  }
  $('#play-list').addEventListener('click', function (e) {
    var b = e.target.closest('.pcard'); if (!b) return;
    select(b.dataset.id);
    if (window.innerWidth < 980) $('.viewer').scrollIntoView({ behavior: 'smooth' });
  });

  var viewer = new Animator($('#field'), function (t, a) {
    $('#v-time').textContent = Math.max(0, t).toFixed(1) + 's';
    var sim = a.sim, pc = $('#v-pclock').parentNode, fx = sim.firstExchange;
    var clockT = t <= 0 ? 0 : (fx != null ? Math.min(t, fx) : t);
    pc.classList.remove('warn', 'over', 'off');
    if (fx != null && t >= fx && sim.P.events[0].type !== 'pass') { $('#v-pclock').textContent = 'OFF'; pc.classList.add('off'); }
    else { $('#v-pclock').textContent = clockT.toFixed(1) + ' / 7'; if (clockT > 7) pc.classList.add('over'); else if (clockT > 4.5) pc.classList.add('warn'); }
    $('#v-pressure').classList.toggle('hidden', !(a.dsim && a.dsim.pressure(t)));
    var sc = $('#v-scrub'); if (!sc._drag) sc.value = Math.round(1000 * (t - sim.tStart) / (a.tEnd - sim.tStart));
    $('#v-play').textContent = a.running ? '❚❚ Pause' : '▶ Run play';
    var r = a.dsim && t >= a.dsim.result.t ? a.dsim.result : null;
    $('#v-result').innerHTML = a.dsim ? (r ? '<b>' + esc(D.describe(r)) + '</b>' : 'Run it to see how this matchup plays out') + ' <span class="muted">· simplified simulation</span>' : '';
  });

  /* ---- "QB throws to": re-target a straight QB pass play without opening the designer ---- */
  function canRetarget(p) { return p.events.length === 1 && p.events[0].type === 'pass' && p.events[0].from === 'QB'; }
  function brkFor(p, r) { var pts = p.players[r] && p.players[r].route && p.players[r].route.pts; return pts && pts.length > 1 && pts[0][1] < 1 ? 1 : 0; }
  function retarget(p, r) {
    if (!r || r === p.events[0].to) return p;
    var q = E.clone(p); q.events = [{ type: 'pass', from: 'QB', to: r, brk: brkFor(p, r) }]; return q;
  }
  function throwTargets(p) {   // receivers who run a route that can legally be caught past the LOS
    return ['X', 'Y', 'Z', 'C'].filter(function (r) {
      var pts = p.players[r] && p.players[r].route && p.players[r].route.pts; if (!pts || !pts.length) return false;
      var ev = E.buildSim(retarget(p, r)).P.events[0]; return ev.catchPt && ev.catchPt[1] > 0.5;
    });
  }
  function bestTarget(p, def) {
    var best = null;
    throwTargets(p).forEach(function (r) { var s = D.scoreResult(D.simulate(def, E.buildSim(retarget(p, r))).result); if (!best || s > best.s) best = { r: r, s: s }; });
    return best && best.r;
  }
  /* their QB's decision making (scouting, -2 … +2): a poor decision maker sometimes throws to the receiver our
     defense has covered best; a good one more often finds the open man. Picked from the play + defense names,
     so a matchup always plays out the same way. */
  function chance(key) { var h = 2166136261; for (var i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 1000) / 1000; }
  function qbRead(p, def, dec, key) {
    if (!dec || !def || !canRetarget(p)) return { p: p };
    var drawn = p.events[0].to, ranked = throwTargets(p).map(function (r) {
      return { r: r, s: D.scoreResult(D.simulate(def, E.buildSim(retarget(p, r))).result) };
    }).sort(function (a, b) { return b.s - a.s; });
    if (ranked.length < 2) return { p: p };
    var roll = chance(key), pick = drawn, why = '';
    if (dec < 0 && roll < 0.35 * -dec) { pick = ranked[ranked.length - 1].r; why = 'misread it'; }
    else if (dec > 0 && roll < 0.45 * dec) { pick = ranked[0].r; why = 'found the open man'; }
    if (pick === drawn) return { p: p };
    return { p: retarget(p, pick), note: 'Their QB ' + why + ': threw to ' + pick + ' instead of ' + drawn + '.' };
  }
  function vsDefense() { var d = view.vsOff ? findDef(view.vsOff) : null; return tunedDef(d && view.flip ? D.flipDefense(d) : d); }

  /* ---- "Their players": run the sim at a scouted opponent's speed (scout.js). Defaults to this week's opponent. ---- */
  function scouted() { var S = window.APP && APP.scout; return S ? S.list().filter(function (o) { return (o.players || []).length; }) : []; }
  function oppId() {
    if (view.opp != null) return view.opp;
    var g = activeGame(), o = g && window.APP && APP.scout && APP.scout.forName(g.opp);
    return o && (o.players || []).length ? o.id : '';
  }
  function tunedDef(d) { var id = oppId(); return d && id ? APP.scout.tuneDef(d, id) : d; }
  function tunedOff(p) { var id = oppId(); return p && id ? APP.scout.tuneOff(p, id) : p; }
  function fillOppSelect() {
    var list = scouted(), wrap = $('#v-opp-wrap'), on = list.length && (view.side === 'def' || !!view.vsOff);
    wrap.classList.toggle('hidden', !on);
    var note = $('#v-opp-note'), o = on && oppId() ? APP.scout.find(oppId()) : null;
    note.classList.toggle('hidden', !o);
    if (o) note.innerHTML = '<b>' + esc(o.name) + '</b>: ' + esc(APP.scout.summary(o, view.side === 'off' ? 'def' : 'off')) + ' — the simulation runs at their speed.';
    if (!on) return;
    var sel = $('#v-opp');
    sel.innerHTML = '<option value="">League average</option>' + list.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.name) + '</option>'; }).join('');
    sel.value = oppId();
  }
  $('#v-opp').addEventListener('change', function (e) { view.opp = e.target.value; select(view.side === 'off' ? view.id : view.defId); });
  function throwChoice(p) {
    var c = view.throwTo[view.id] || '';
    if (c === 'best') { var d = vsDefense(); return d ? bestTarget(p, d) : ''; }
    return c;
  }
  /* view-only tweaks per play: dragged route points (stored unflipped), pinned catch spot, QB rollout */
  function mods(id) { id = id || view.id; return view.mods[id] || (view.mods[id] = { pts: {}, at: null, atFor: null, roll: '' }); }
  function hasMods(id) { var m = view.mods[id || view.id]; return !!(m && (Object.keys(m.pts).length || m.at != null || m.roll)); }
  function rollQB(p, dir) {
    var qb = p.players.QB, s0 = qb.start, k = dir === 'L' ? -1 : 1, W = E.FIELD.W;
    function cx(x) { return Math.max(1.5, Math.min(W - 1.5, x)); }
    qb.route = { sit: false, delay: 0.35, speed: 5.5, pts: [[cx(s0[0] + k * 1.5), s0[1] - 1.2], [cx(s0[0] + k * 7.5), s0[1] + 0.3], [cx(s0[0] + k * 10), Math.min(-1.5, s0[1] + 2)]] };
  }
  function moddedOff() {   // routes + flip + rollout, before choosing the throw target
    var base = findOff(view.id) || offPlays()[0], p = E.normalizePlay(base), m = view.mods[base.id];
    if (m) Object.keys(m.pts).forEach(function (r) { p.players[r].route.pts = E.clone(m.pts[r]); });
    if (view.flip) p = E.flipPlay(p);
    if (m && m.roll && canRetarget(p)) rollQB(p, m.roll);
    return p;
  }
  function fillThrowSelect(p) {
    var wrap = $('#v-throw-wrap'), sel = $('#v-throw');
    var ok = view.side === 'off' && canRetarget(p), tg = ok ? throwTargets(p) : [];
    wrap.classList.toggle('hidden', !ok || tg.length < 2);
    $('#v-tweak').classList.toggle('hidden', view.side !== 'off');
    $('#v-roll-wrap').classList.toggle('hidden', !ok);
    if (!ok) return;
    var drawn = p.events[0].to, d = vsDefense(), c = view.throwTo[view.id] || '';
    if (c === 'best' && !d) c = '';
    sel.innerHTML = '<option value="">' + drawn + ' — as drawn</option>' +
      tg.filter(function (r) { return r !== drawn; }).map(function (r) { return '<option value="' + r + '">' + r + ' — ' + esc(E.ROLE_NAMES[r] || r) + '</option>'; }).join('') +
      (d ? '<option value="best">Best read vs ' + esc(d.name) + ' → ' + bestTarget(p, d) + '</option>' : '');
    sel.value = c;
  }
  $('#v-throw').addEventListener('change', function (e) { view.throwTo[view.id] = e.target.value; var m = mods(); m.at = null; m.atFor = null; select(view.id); });
  $('#v-roll').addEventListener('change', function (e) { mods().roll = e.target.value; select(view.id); });
  $('#v-adjust').addEventListener('click', function () { view.adjust = !view.adjust; select(view.id); });
  $('#v-tweak-reset').addEventListener('click', function () { delete view.mods[view.id]; view.throwTo[view.id] = ''; select(view.id); });

  function currentOff() {
    var p = moddedOff(); if (!canRetarget(p)) return p;
    p = retarget(p, throwChoice(p));
    var m = view.mods[view.id];
    if (m && m.at != null && m.atFor === p.events[0].to) { p = E.clone(p); p.events[0].at = m.at; }
    return p;
  }

  /* ---- Adjust mode: drag route points; slide the 📍 catch pin along the target's route ---- */
  function fieldPt(e) {
    var svg = $('#field'), pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    var l = pt.matrixTransform(svg.getScreenCTM().inverse());
    return [l.x / E.FIELD.S, E.FIELD.YMAX - l.y / E.FIELD.S];
  }
  function pinInfo(sim) {
    var ev = sim.P.events[0];
    if (!ev || ev.type !== 'pass' || ev.from !== 'QB' || !sim.P.players[ev.to].route.pts.length) return null;
    var poly = [sim.routeStart(ev.to)].concat(sim.P.players[ev.to].route.pts);
    var L = E.plen(poly), min = Math.min(L, Math.max(0.5, ev.pinMin || 0.5));
    var at = ev.pinned ? Math.max(min, Math.min(L, ev.at)) : E.alongPoly(poly, ev.catchPt);
    return { r: ev.to, poly: poly, L: L, min: min, at: at, pt: ev.pinPt || ev.catchPt, ev: ev };
  }
  function polyPiece(poly, d0, d1) {   // the stretch of a route between two distances along it
    var out = [E.polyAt(poly, d0)], run = 0;
    for (var i = 1; i < poly.length; i++) { run += E.dist(poly[i - 1], poly[i]); if (run > d0 && run < d1) out.push(poly[i]); }
    out.push(E.polyAt(poly, d1));
    return out;
  }
  viewer.overlay = function (a) {
    if (view.side !== 'off' || !view.adjust) return '';
    var sim = a.sim, s = '', sx = E.sx, sy = E.sy;
    ['X', 'Y', 'Z', 'C'].forEach(function (r) {
      sim.P.players[r].route.pts.forEach(function (q) { s += '<circle cx="' + sx(q[0]) + '" cy="' + sy(q[1]) + '" r="7" class="rt-handle" stroke="' + E.COLORS[r] + '"/>'; });
    });
    var pi = pinInfo(sim);
    if (pi) {
      var line = function (pts, cls) { return '<polyline points="' + pts.map(function (q) { return sx(q[0]) + ',' + sy(q[1]); }).join(' ') + '" class="' + cls + '"/>'; };
      if (pi.min > 0.5) s += line(polyPiece(pi.poly, 0, pi.min), 'pin-track too-early');   // the ball can't get there that soon
      s += line(polyPiece(pi.poly, pi.min, pi.L), 'pin-track');
      var x = sx(pi.pt[0]), y = sy(pi.pt[1]);
      s += '<g class="pin-handle"><circle cx="' + x + '" cy="' + y + '" r="16" class="pin-hit"/><path d="M' + x + ',' + y + ' l-7,-15 a8,8 0 1,1 14,0 z" class="pin-body"/><circle cx="' + x + '" cy="' + (y - 18) + '" r="3" class="pin-dot"/></g>';
    }
    return s;
  };
  var drag = null;
  $('#field').addEventListener('pointerdown', function (e) {
    if (view.side !== 'off' || !view.adjust || !viewer.sim) return;
    viewer.stop(); if (viewer.t !== viewer.sim.tStart) { viewer.t = viewer.sim.tStart; viewer.draw(); }
    var pt = fieldPt(e), sim = viewer.sim, pi = pinInfo(sim);
    var pinDrag = pi && { kind: 'pin', r: pi.r, poly: pi.poly, min: pi.min, L: pi.L, at: pi.at, off: [0, 0] };
    if (pi && E.dist(pt, [pi.pt[0], pi.pt[1] + 0.8]) < 2.2) {   // the pin (its head sits just above the spot)
      drag = pinDrag; drag.off = [pt[0] - pi.pt[0], pt[1] - pi.pt[1]];   // keep the pin under the finger where it was grabbed
    }
    else {
      var bd = 1.4;
      ['X', 'Y', 'Z', 'C'].forEach(function (r) { sim.P.players[r].route.pts.forEach(function (q, i) { var d = E.dist(q, pt); if (d < bd) { bd = d; drag = { kind: 'pt', r: r, i: i }; } }); });
      // a tap on the target's route (not on a dot) moves the pin there
      if (!drag && pi && E.dist(pt, E.polyAt(pi.poly, E.alongPoly(pi.poly, pt))) < 1.2) { drag = pinDrag; drag.at = null; movePin(pt); }
    }
    if (!drag) return;
    e.preventDefault(); $('#field').setPointerCapture(e.pointerId);
  });
  /* rebuilding the field + defense on every finger movement made dragging stutter on phones:
     changes are collected and redrawn at most once per screen frame */
  var dragFrame = 0;
  function redrawSoon() {
    if (dragFrame) return;
    dragFrame = requestAnimationFrame(function () { dragFrame = 0; viewer.key = null; viewer.load(currentOff(), vsDefense(), 'off'); adjustHint(); });
  }
  function movePin(pt) {
    var m = mods(), at = E.alongPoly(drag.poly, pt, drag.at);
    at = Math.max(drag.min, Math.min(drag.L, Math.round(at * 2) / 2));
    drag.at = at;
    if (at === m.at && m.atFor === drag.r) return;
    m.at = at; m.atFor = drag.r; redrawSoon();
  }
  $('#field').addEventListener('pointermove', function (e) {
    if (!drag) return;
    var pt = fieldPt(e), m = mods();
    if (drag.kind === 'pin') { movePin([pt[0] - drag.off[0], pt[1] - drag.off[1]]); return; }
    else {
      var x = Math.max(0, Math.min(E.FIELD.W, Math.round(pt[0] * 2) / 2)), y = Math.max(-1, Math.min(E.FIELD.YMAX - 0.5, Math.round(pt[1] * 2) / 2));
      if (view.flip) x = E.FIELD.W - x;
      if (!m.pts[drag.r]) m.pts[drag.r] = E.clone(E.normalizePlay(findOff(view.id)).players[drag.r].route.pts);
      var cur = m.pts[drag.r][drag.i]; if (cur[0] === x && cur[1] === y) return;
      m.pts[drag.r][drag.i] = [x, y];
    }
    redrawSoon();
  });
  function endDrag() {
    if (!drag) return;
    drag = null;
    if (dragFrame) { cancelAnimationFrame(dragFrame); dragFrame = 0; }
    select(view.id);
  }
  $('#field').addEventListener('pointerup', endDrag); $('#field').addEventListener('pointercancel', endDrag);
  function adjustHint() {
    var h = $('#v-adjust-hint'), on = view.side === 'off' && view.adjust;
    h.classList.toggle('hidden', !on); if (!on) return;
    var pi = viewer.sim && pinInfo(viewer.sim), r = viewer.dsim && viewer.dsim.result;
    h.innerHTML = (pi ? 'Drag the <b>📍 pin</b> (or tap ' + pi.r + '’s route) to set where he <b>catches</b> it — the QB times his throw to meet him there.' +
      (pi.min > 0.5 ? ' The dim start of the route is too early: the ball can’t get there that soon after the snap.' : '') + ' ' : '') +
      'Drag the <b>dots</b> to reshape routes. View-only — <b>Edit copy</b> saves it as a team play.' +
      (r ? '<br><b class="adj-res">→ ' + esc(D.describe(r)) + '</b>' : '');
  }

  /* reload the field only when something about the matchup changed, so live updates from teammates
     (a rating, a logged play) don't restart the animation you're watching */
  function loadViewer(off, def, mode, keep) {
    var key = JSON.stringify([off, def, mode, view.adjust]);
    if (keep && viewer.key === key && viewer.sim) { viewer.draw(); return; }
    viewer.key = key; viewer.load(off, def, mode);
  }

  function currentDef() { var d = findDef(view.defId) || defPlays()[0]; return view.flip ? D.flipDefense(d) : d; }

  function fillVsSelect() {
    var sel = $('#v-vs');
    if (view.side === 'off') {
      $('#v-vs-label').textContent = 'Against defense';
      sel.innerHTML = '<option value="">No defense</option>' + defPlays().map(function (d) { return '<option value="' + d.id + '">' + esc(d.name) + ' — ' + esc(d.front) + '</option>'; }).join('');
      sel.value = view.vsOff;
    } else {
      $('#v-vs-label').textContent = 'Against offense';
      var groups = {};
      offPlays().forEach(function (p) { var g = p.custom ? 'Team plays' : CAT_NAME[p.cat] || 'Other'; (groups[g] = groups[g] || []).push(p); });
      sel.innerHTML = Object.keys(groups).map(function (g) { return '<optgroup label="' + esc(g) + '">' + groups[g].map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>'; }).join('') + '</optgroup>'; }).join('');
      var d = findDef(view.defId); sel.value = view.vsDef[view.defId] || (d && d.vs) || B2A_PLAYS[0].id;
    }
  }
  $('#v-vs').addEventListener('change', function (e) {
    if (view.side === 'off') view.vsOff = e.target.value; else view.vsDef[view.defId] = e.target.value;
    select(view.side === 'off' ? view.id : view.defId);
  });

  function recordHTML(id, side) {
    var all = ST.playStats({ side: side })[id];
    if (!all || !all.calls) return '<p class="hint">No results logged yet. Log plays from Game Day and they’ll show up here.</p>';
    var byOpp = {};
    ST.entries({ side: side }).forEach(function (l) {
      if (l.play !== id) return;
      var o = byOpp[l.opp] || (byOpp[l.opp] = { n: 0, ok: 0 });
      o.n++; if (ST.resultInfo(side, l.result).ok) o.ok++;
    });
    var extra = (all.ydsN ? ' · ' + (all.yds / all.ydsN).toFixed(1) + ' yds avg' : '') + (all.td ? ' · ' + all.td + ' TD' : '') +
      (all.to ? ' · ' + all.to + (side === 'off' ? ' TO' : ' INT') : '');
    var opps = Object.keys(byOpp).map(function (o) { return '<li><span>vs ' + esc(o) + '</span><b>' + byOpp[o].ok + '/' + byOpp[o].n + '</b></li>'; }).join('');
    return '<div class="rec-big"><b>' + pct(all.ok / all.calls) + '</b><span>' + all.ok + ' of ' + all.calls + ' successful' + extra + '</span></div>' +
      '<ul class="by-opp">' + opps + '</ul>';
  }

  function select(id, keep) {
    var side = view.side;
    if (side === 'off') view.id = id; else view.defId = id;
    fillVsSelect(); fillOppSelect();
    var base, info = '';
    if (side === 'off') {
      base = findOff(id); if (!base) { base = offPlays()[0]; view.id = base.id; }
      fillThrowSelect(moddedOff());
      var p = currentOff();
      $('#v-roll').value = (view.mods[view.id] && view.mods[view.id].roll) || '';
      $('#v-adjust').classList.toggle('on', view.adjust);
      $('#v-tweak-reset').classList.toggle('hidden', !hasMods() && !view.throwTo[view.id]);
      $('#field').classList.toggle('adjusting', view.adjust);
      var def = vsDefense();
      loadViewer(p, def, 'off', keep); adjustHint();
      var f = E.FORMATIONS[p.formation] || {};
      $('#v-name').textContent = base.num + ' · ' + p.name;
      var where = p.ytg ? 'From the ' + p.ytg : (p.ytm ? p.ytm + ' yds from midfield' : 'Open field');
      $('#v-meta').textContent = (f.name || '') + (view.flip ? ' (flipped)' : '') + ' · ' + (isRun(p) ? 'Run' : 'Pass') + ' · ' + where + (CAT_NAME[p.cat] ? ' · ' + CAT_NAME[p.cat] : '');
      var res = E.validate(p);
      var lg = $('#v-legal'); lg.className = 'legal ' + (res.legal ? 'ok' : 'bad'); lg.textContent = res.legal ? '✓ LEGAL' : '✕ RULE ISSUE';
      info += adjustedNote(p) + retargetNote(p, base);
      var reads = (p.reads || []).map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') || '<li>—</li>';
      info += '<div class="card"><h3>Progression</h3><ol class="reads">' + reads + '</ol></div>';
      var dotHint = p.events.some(function (e) { return e.brk != null; }) ? '<p class="hint">● Yellow dot = where the QB lets it go (receiver’s break). Dotted tail = run after the catch.</p>' : '';
      info += '<div class="card"><h3>Coaching points</h3><p>' + esc(p.notes || '—') + '</p>' + dotHint + '</div>';
      info += '<div class="card"><h3>Our results</h3>' + recordHTML(id, 'off') + '</div>';
      if (window.APP && APP.assignmentCardHTML) info += APP.assignmentCardHTML(id, 'off');
      info += '<div class="card"><h3>Rules check</h3><ul class="checks">' + res.issues.map(function (i) { return '<li class="' + i.level + '">' + esc(i.msg) + '</li>'; }).join('') + '</ul></div>';
    } else {
      base = findDef(id); if (!base) { base = defPlays()[0]; view.defId = base.id; }
      var d = currentDef();
      var offId = view.vsDef[view.defId] || base.vs;
      var off = findOff(offId) || B2A_PLAYS[0], offRun = tunedOff(view.flip ? E.flipPlay(off) : off);
      var oid = oppId(), dec = oid ? APP.scout.profile(APP.scout.find(oid)).dec : 0, read = qbRead(offRun, d, dec, off.id + '|' + d.id + '|' + oid);
      offRun = read.p;
      if (read.note) { $('#v-opp-note').insertAdjacentHTML('beforeend', ' <b class="opp-read">' + esc(read.note) + '</b>'); }
      $('#v-throw-wrap').classList.add('hidden'); $('#v-tweak').classList.add('hidden'); $('#v-adjust-hint').classList.add('hidden'); $('#field').classList.remove('adjusting');
      loadViewer(offRun, d, 'def', keep);
      $('#v-name').textContent = base.num + ' · ' + d.name;
      $('#v-meta').textContent = d.front + ' · vs ' + off.name + (view.flip ? ' (flipped)' : '');
      var lg2 = $('#v-legal'); lg2.className = 'legal ok'; var nb = d.defenders.filter(function (x) { return x.job === 'blitz'; }).length; lg2.textContent = nb ? nb + ' BLITZER' + (nb > 1 ? 'S' : '') : 'NO BLITZ';
      info += '<div class="card"><h3>When to call it</h3><ul class="reads">' + d.when.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul></div>';
      info += '<div class="card"><h3>Coaching keys</h3><ul class="reads">' + d.keys.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul></div>';
      info += '<div class="card"><h3>Strengths / weaknesses</h3><p><b class="good">+</b> ' + esc(d.strengths) + '</p><p><b class="bad">−</b> ' + esc(d.weaknesses) + '</p></div>';
      info += '<div class="card"><h3>Our results</h3>' + recordHTML(id, 'def') + '</div>';
      if (window.APP && APP.assignmentCardHTML) info += APP.assignmentCardHTML(id, 'def');
      info += '<div class="card"><h3>Rules check</h3><ul class="checks">' + blitzChecks(d) + '</ul></div>';
      info += '<div class="card span2 legend">' + D.legendHTML() + '<span class="muted">Offense is faded — pick any of our plays above to test the coverage against it.</span></div>';
    }
    $('#v-info').innerHTML = info;
    $('#v-del').classList.toggle('hidden', !(side === 'off' && base.custom));
    $('#v-edit').classList.toggle('hidden', side !== 'off');
    $('#v-edit').textContent = base.custom ? '✎ Edit' : '✎ Edit copy';
    $('#v-share').classList.toggle('hidden', side !== 'off');
    updateRateAndPlan();
    renderList();
    try { if (!base.shared) history.replaceState(null, '', '#' + (side === 'off' ? 'play' : 'def') + '=' + encodeURIComponent(id)); } catch (e) { }
  }
  /* "Adjusted: routes reshaped (X) · catch spot pinned … · QB rolls left" — only when something was tweaked */
  function adjustedNote(p) {
    if (!hasMods()) return '';
    var mm = view.mods[view.id], bits = [];
    if (Object.keys(mm.pts).length) bits.push('routes reshaped (' + Object.keys(mm.pts).join(', ') + ')');
    if (mm.at != null && p.events[0] && p.events[0].at != null) bits.push('catch spot pinned ' + mm.at.toFixed(1) + ' yds along ' + mm.atFor + '’s route');
    if (mm.roll && canRetarget(p)) bits.push('QB rolls ' + (mm.roll === 'L' ? 'left' : 'right'));
    if (!bits.length) return '';
    return '<div class="card span2 throw-note">' + ICON('pen') + ' <span>Adjusted: ' + bits.join(' · ') +
      '. View-only — tap <b>Edit copy</b> to save it as a team play, or <b>Reset changes</b>.</span></div>';
  }
  /* shown when "QB throws to" picked someone other than the drawn target */
  function retargetNote(p, base) {
    if (!p.events[0] || !base.events[0] || p.events[0].to === base.events[0].to) return '';
    return '<div class="card span2 throw-note">' + ICON('target') + ' <span>Showing the throw to <b>' + p.events[0].to + '</b> instead of ' + base.events[0].to +
      ' (as drawn). This only changes the view — the saved play is unchanged.</span></div>';
  }
  /* defense rules check: every blitzer 7+ yds deep and 3+ ft (1 yd) off the ball, max 2 */
  function blitzChecks(d) {
    var bl = d.defenders.filter(function (x) { return x.job === 'blitz'; });
    if (!bl.length) return '<li class="ok">No blitzer — nobody crosses the line until a handoff, pitch or pass.</li>';
    var rows = bl.map(function (b) {
      var off = Math.abs(b.start[0] - 12.5), ok = off >= 1 && b.start[1] >= 7;
      var side = b.start[0] < 12.5 ? 'left' : 'right';
      var verdict = ok ? ' — legal (7+ yds, 3+ ft off the ball)' : ' — must be 7+ yds deep and 3+ ft off the ball';
      return '<li class="' + (ok ? 'ok' : 'error') + '">' + esc(b.label) + ' lines up ' + b.start[1] + ' yds deep, ' + off.toFixed(1) + ' yds ' + side + ' of the ball' + verdict + '</li>';
    }).join('');
    return rows + '<li class="info">Blitz in a straight line at the QB. A receiver who moves into that path is impeding the blitzer (−5, loss of down on them).</li>' +
      (bl.length > 2 ? '<li class="error">Max 2 blitzers.</li>' : '');
  }

  function updateRateAndPlan() {
    var id = view.side === 'off' ? view.id : view.defId, r = ST.rating(id);
    $$('#v-rate button').forEach(function (b) { b.classList.toggle('on', +b.dataset.r === r); });
    var planned = inPlan(id, view.side);
    $('#v-plan').textContent = planned ? '✓ In game plan' : '＋ Game plan';
    $('#v-plan').classList.toggle('on', planned);
  }
  $('#v-rate').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    ST.rate(view.side === 'off' ? view.id : view.defId, +b.dataset.r); updateRateAndPlan(); renderList();
  });
  $('#v-plan').addEventListener('click', function () { if (togglePlan(view.side === 'off' ? view.id : view.defId, view.side)) { updateRateAndPlan(); renderList(); } });
  $('#v-play').addEventListener('click', function () { if (viewer.running) { viewer.stop(); viewer.draw(); } else viewer.start(); });
  $('#v-reset').addEventListener('click', function () { viewer.reset(); });
  $('#v-speed').addEventListener('change', function (e) { viewer.speed = +e.target.value; });
  var scrub = $('#v-scrub');
  scrub.addEventListener('input', function () { scrub._drag = true; viewer.seek(scrub.value / 1000); scrub._drag = false; });
  $('#v-flip').addEventListener('click', function (e) { view.flip = !view.flip; e.currentTarget.classList.toggle('on', view.flip); select(view.side === 'off' ? view.id : view.defId); });
  $('#v-edit').addEventListener('click', function () {
    var base = findOff(view.id), p = E.clone(currentOff());   // keeps the flip and the chosen throw target
    if (!base.custom) { delete p.id; p.name = p.name + ' (copy)'; }
    delete p.num; delete p.shared; delete p.flipped; delete p.custom;
    APP.openDesigner(p);
  });
  $('#v-del').addEventListener('click', function () {
    var base = findOff(view.id); if (!base || !base.custom) return;
    if (!confirm('Delete "' + base.name + '" from team plays?')) return;
    ST.S.data.teamPlays = ST.S.data.teamPlays.filter(function (p) { return p.id !== base.id; }); ST.save();
    select(B2A_PLAYS[0].id); toast('Deleted for the whole team.');
  });
  $('#v-share').addEventListener('click', function () {
    var p = E.clone(currentOff()); delete p.num; delete p.custom; delete p.shared;
    copyText(location.origin + location.pathname + '#p=' + b64e(JSON.stringify(p)), 'Share link copied.');
  });

  $('#print-btn').addEventListener('click', function () {
    var plan = activeGame();
    var offs = offPlays().filter(function (p) { return !p.shared; });
    if (plan && plan.plan.off.length && confirm('Print only this week’s game plan (' + plan.plan.off.length + ' offense, ' + plan.plan.def.length + ' defense)? Cancel prints the whole book.')) {
      offs = offs.filter(function (p) { return plan.plan.off.indexOf(p.id) >= 0; });
      var defs = defPlays().filter(function (d) { return plan.plan.def.indexOf(d.id) >= 0; });
    } else defs = defPlays();
    var cells = offs.map(function (p) { return '<div class="cell"><b>' + esc(p.num) + ' · ' + esc(p.name) + '</b>' + offSVG(p, [-7, 18], 'pr' + p.num) + '</div>'; }).join('') +
      defs.map(function (d) { return '<div class="cell"><b>' + esc(d.num) + ' · ' + esc(d.name) + '</b>' + defSVG(d, null, [-7, 18], 'pr' + d.num) + '</div>'; }).join('');
    $('#print-sheet').innerHTML = '<div class="sheet-title">B2A Call Sheet' + (plan ? ' — vs ' + esc(plan.opp) : '') + '</div><div class="sheet">' + cells + '</div>';
    window.print();
  });

  function boot() {
    var h = location.hash;
    fillCatSelect();
    var lastTab = null; try { lastTab = sessionStorage.getItem('b2a.tab'); } catch (e) { }
    if (lastTab && lastTab !== 'plays' && h.indexOf('#p=') !== 0 && $('#tab-' + lastTab)) setTimeout(function () { showTab(lastTab); }, 0);
    if (h.indexOf('#p=') === 0) {
      try {
        shared = JSON.parse(b64d(h.slice(3))); shared.id = 'shared'; shared.shared = true; shared.num = 'S';
        select('shared'); toast('Shared play opened — tap “Edit copy” then Save to keep it.'); return;
      } catch (e) { toast('That share link is broken.'); }
    }
    var m = h.match(/^#(play|def)=(.+)$/);
    if (m && m[1] === 'def') { view.defId = decodeURIComponent(m[2]); setSide('def'); return; }
    select(m && findOff(decodeURIComponent(m[2])) ? decodeURIComponent(m[2]) : B2A_PLAYS[0].id);
  }

  window.APP = {
    $: $, $$: $$, esc: esc, toast: toast, isLive: isLive, copyText: copyText, pct: pct, E: E, D: D, ST: ST,
    Animator: Animator, offPlays: offPlays, defPlays: defPlays, findOff: findOff, findDef: findDef, findAny: findAny,
    isRun: isRun, thumb: thumb, offSVG: offSVG, defSVG: defSVG, playName: playName, playNum: playNum, CAT_NAME: CAT_NAME,
    showTab: showTab, tabHooks: tabHooks, activeGame: activeGame, inPlan: inPlan, togglePlan: togglePlan,
    openPlay: function (id, side) { showTab('plays'); if ((side || 'off') !== view.side) { view.side = side || 'off'; $$('#side-switch button').forEach(function (x) { x.classList.toggle('on', x.dataset.side === view.side); }); fillCatSelect(); } select(id); },
    qbRead: qbRead,
    refreshPlays: function () { select(view.side === 'off' ? view.id : view.defId, true); },   // keep: don't restart a running animation if the play didn't change
    bootPlays: boot
  };
})();
