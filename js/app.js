/* B2A Playbook — core helpers, animator and the Plays tab. Other tabs live in their own files and hook into window.APP. */
(function () {
  'use strict';
  var E = window.B2A, D = E.DEF, ST = window.B2A_STORE;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 2800); }
  function copyText(txt, msg) {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { toast(msg); }, function () { prompt('Copy this:', txt); });
    else prompt('Copy this:', txt);
  }
  function b64e(s) { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function b64d(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return decodeURIComponent(escape(atob(s))); }
  function pct(x) { return x == null ? '—' : Math.round(x * 100) + '%'; }

  var CAT_NAME = {}; B2A_CATS.forEach(function (c) { CAT_NAME[c[0]] = c[1]; });
  var shared = null;

  /* ---------- play catalog ---------- */
  function offPlays() {
    var list = B2A_PLAYS.map(function (p, i) { var c = E.clone(p); c.num = i + 1; return c; });
    (ST.S.data.teamPlays || []).forEach(function (p, i) { var c = E.clone(p); c.custom = true; c.cat = c.cat || 'team'; c.num = 'T' + (i + 1); list.push(c); });
    if (shared) list.push(shared);
    return list;
  }
  function defPlays() { return B2A_DEF_PLAYS.map(function (p, i) { var c = E.clone(p); c.num = 'D' + (i + 1); c.side = 'def'; return c; }); }
  function findOff(id) { return offPlays().filter(function (p) { return p.id === id; })[0]; }
  function findDef(id) { return defPlays().filter(function (p) { return p.id === id; })[0]; }
  function findAny(id) { return findOff(id) || findDef(id); }
  function isRun(p) { return !(p.events || []).some(function (e) { return e.type === 'pass'; }); }
  function playName(id) { var p = findAny(id); return p ? p.name : id; }
  function playNum(id) { var p = findAny(id); return p ? p.num : '?'; }

  /* ---------- static diagrams ---------- */
  var thumbCache = {};
  function offSVG(p, crop, uid) { return E.staticPlaySVG(p, { crop: crop || [-7, 18], uid: uid }); }
  function defSVG(def, offId, crop, uid) {
    var off = findOff(offId || def.vs) || B2A_PLAYS[0];
    var sim = E.buildSim(off), ds = D.simulate(def, sim);
    uid = uid || ('d' + Math.random().toString(36).slice(2, 7));
    return '<svg viewBox="' + E.viewBox(crop || [-7, 18]) + '" xmlns="http://www.w3.org/2000/svg" class="field-svg">' + E.fieldSVG(sim.P, { uid: uid }) +
      D.assignmentsSVG(ds, sim) + '<g class="ghost-off">' + E.playersSVG(sim, sim.tStart, null, { showBall: false }) + '</g>' + D.defendersSVG(ds, sim.tStart) + '</svg>';
  }
  function thumb(p, crop) {
    var key = (p.side || 'off') + p.id + JSON.stringify(p).length + (crop || '');
    if (!thumbCache[key]) thumbCache[key] = p.side === 'def' ? defSVG(p, null, crop, 't' + Object.keys(thumbCache).length) : offSVG(p, crop, 't' + Object.keys(thumbCache).length);
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
      E.routesSVG(this.sim, { uid: this.uid, ghost: defMode }) + '<g class="dyn"></g>';
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
      self.draw();
      if (self.running) self.raf = requestAnimationFrame(loop);
    }
    this.raf = requestAnimationFrame(loop);
    this.draw();
  };
  Animator.prototype.stop = function () { this.running = false; cancelAnimationFrame(this.raf); };
  Animator.prototype.reset = function () { this.stop(); this.t = this.sim.tStart; this.draw(); };
  Animator.prototype.seek = function (f) { this.stop(); this.t = this.sim.tStart + f * (this.tEnd - this.sim.tStart); this.draw(); };

  /* ---------- tabs ---------- */
  var tabHooks = {};
  function showTab(name) {
    $$('.tab').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === name); });
    $$('.panel').forEach(function (p) { p.classList.toggle('active', p.id === 'tab-' + name); });
    if (tabHooks[name]) tabHooks[name]();
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
  var view = { side: 'off', id: B2A_PLAYS[0].id, defId: B2A_DEF_PLAYS[0].id, flip: false, cat: 'all', sort: 'book', q: '', vsOff: '', vsDef: {} };

  var OFF_FILTERS = [['all', 'All offense']].concat(B2A_CATS).concat([['team', 'Team plays (designed)'], ['t:pass', '— Pass plays'], ['t:run', '— Runs'], ['t:vs-blitz', '— vs blitz'], ['t:vs-man', '— vs man'], ['t:vs-zone', '— vs zone'], ['t:third-down', '— 3rd down'], ['t:short-yardage', '— Short yardage']]);
  var DEF_FILTERS = [['all', 'All defense'], ['t:man', 'Man'], ['t:zone', 'Zone'], ['t:pressure', 'Pressure / blitz'], ['t:no-blitz', 'No blitz'], ['t:third-down', '3rd down'], ['t:red-zone', 'Red zone / prevent']];
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

  function currentOff() { var p = findOff(view.id) || offPlays()[0]; return view.flip ? E.flipPlay(p) : p; }
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
    ST.entries({ side: side }).forEach(function (l) { if (l.play !== id) return; var o = byOpp[l.opp] || (byOpp[l.opp] = { n: 0, ok: 0 }); o.n++; if (ST.resultInfo(side, l.result).ok) o.ok++; });
    return '<div class="rec-big"><b>' + pct(all.ok / all.calls) + '</b><span>' + all.ok + ' of ' + all.calls + ' successful' + (all.ydsN ? ' · ' + (all.yds / all.ydsN).toFixed(1) + ' yds avg' : '') + (all.td ? ' · ' + all.td + ' TD' : '') + (all.to ? ' · ' + all.to + (side === 'off' ? ' TO' : ' INT') : '') + '</span></div>' +
      '<ul class="by-opp">' + Object.keys(byOpp).map(function (o) { return '<li><span>vs ' + esc(o) + '</span><b>' + byOpp[o].ok + '/' + byOpp[o].n + '</b></li>'; }).join('') + '</ul>';
  }

  function select(id) {
    var side = view.side;
    if (side === 'off') view.id = id; else view.defId = id;
    fillVsSelect();
    var base, info = '';
    if (side === 'off') {
      base = findOff(id); if (!base) { base = offPlays()[0]; view.id = base.id; }
      var p = currentOff();
      var def = view.vsOff ? findDef(view.vsOff) : null;
      if (def && view.flip) def = D.flipDefense(def);
      viewer.load(p, def, 'off');
      var f = E.FORMATIONS[p.formation] || {};
      $('#v-name').textContent = base.num + ' · ' + p.name;
      var where = p.ytg ? 'From the ' + p.ytg : (p.ytm ? p.ytm + ' yds from midfield' : 'Open field');
      $('#v-meta').textContent = (f.name || '') + (view.flip ? ' (flipped)' : '') + ' · ' + (isRun(p) ? 'Run' : 'Pass') + ' · ' + where + (CAT_NAME[p.cat] ? ' · ' + CAT_NAME[p.cat] : '');
      var res = E.validate(p);
      var lg = $('#v-legal'); lg.className = 'legal ' + (res.legal ? 'ok' : 'bad'); lg.textContent = res.legal ? '✓ LEGAL' : '✕ RULE ISSUE';
      info += '<div class="card"><h3>Progression</h3><ol class="reads">' + ((p.reads || []).map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') || '<li>—</li>') + '</ol></div>';
      info += '<div class="card"><h3>Coaching points</h3><p>' + esc(p.notes || '—') + '</p>' + (p.events.some(function (e) { return e.brk != null; }) ? '<p class="hint">● Yellow dot = where the QB lets it go (receiver’s break). Dotted tail = run after the catch.</p>' : '') + '</div>';
      info += '<div class="card"><h3>Our results</h3>' + recordHTML(id, 'off') + '</div>';
      info += '<div class="card"><h3>Rules check</h3><ul class="checks">' + res.issues.map(function (i) { return '<li class="' + i.level + '">' + esc(i.msg) + '</li>'; }).join('') + '</ul></div>';
    } else {
      base = findDef(id); if (!base) { base = defPlays()[0]; view.defId = base.id; }
      var d = currentDef();
      var offId = view.vsDef[view.defId] || base.vs;
      var off = findOff(offId) || B2A_PLAYS[0];
      viewer.load(view.flip ? E.flipPlay(off) : off, d, 'def');
      $('#v-name').textContent = base.num + ' · ' + d.name;
      $('#v-meta').textContent = d.front + ' · vs ' + off.name + (view.flip ? ' (flipped)' : '');
      var lg2 = $('#v-legal'); lg2.className = 'legal ok'; var nb = d.defenders.filter(function (x) { return x.job === 'blitz'; }).length; lg2.textContent = nb ? nb + ' BLITZER' + (nb > 1 ? 'S' : '') : 'NO BLITZ';
      info += '<div class="card"><h3>When to call it</h3><ul class="reads">' + d.when.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul></div>';
      info += '<div class="card"><h3>Coaching keys</h3><ul class="reads">' + d.keys.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul></div>';
      info += '<div class="card"><h3>Strengths / weaknesses</h3><p><b class="good">+</b> ' + esc(d.strengths) + '</p><p><b class="bad">−</b> ' + esc(d.weaknesses) + '</p></div>';
      info += '<div class="card"><h3>Our results</h3>' + recordHTML(id, 'def') + '</div>';
      var bl = d.defenders.filter(function (x) { return x.job === 'blitz'; });
      info += '<div class="card"><h3>Rules check</h3><ul class="checks">' + (bl.length ? bl.map(function (b) {
        var off = Math.abs(b.start[0] - 12.5), ok = off >= 1 && b.start[1] >= 7;
        return '<li class="' + (ok ? 'ok' : 'error') + '">' + esc(b.label) + ' lines up ' + b.start[1] + ' yds deep, ' + off.toFixed(1) + ' yds ' + (b.start[0] < 12.5 ? 'left' : 'right') + ' of the ball' + (ok ? ' — legal (7+ yds, 3+ ft off the ball)' : ' — must be 7+ yds deep and 3+ ft off the ball') + '</li>';
      }).join('') + '<li class="info">Blitz in a straight line at the QB. A receiver who moves into that path is impeding the blitzer (−5, loss of down on them).</li>' : '<li class="ok">No blitzer — nobody crosses the line until a handoff, pitch or pass.</li>') + (bl.length > 2 ? '<li class="error">Max 2 blitzers.</li>' : '') + '</ul></div>';
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
    var base = findOff(view.id), p = E.clone(view.flip ? E.flipPlay(base) : base);
    if (!base.custom) { delete p.id; p.name = p.name + ' (copy)'; }
    delete p.num; delete p.shared; delete p.flipped; delete p.custom;
    APP.openDesigner(p);
  });
  $('#v-del').addEventListener('click', function () {
    var base = findOff(view.id); if (!base || !base.custom) return;
    if (!confirm('Delete "' + base.name + '" from team plays?')) return;
    ST.S.data.teamPlays = ST.S.data.teamPlays.filter(function (p) { return p.id !== base.id; }); ST.save();
    select(B2A_PLAYS[0].id); toast('Deleted. Publish to remove it for the team.');
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
    $: $, $$: $$, esc: esc, toast: toast, copyText: copyText, pct: pct, E: E, D: D, ST: ST,
    Animator: Animator, offPlays: offPlays, defPlays: defPlays, findOff: findOff, findDef: findDef, findAny: findAny,
    isRun: isRun, thumb: thumb, offSVG: offSVG, defSVG: defSVG, playName: playName, playNum: playNum, CAT_NAME: CAT_NAME,
    showTab: showTab, tabHooks: tabHooks, activeGame: activeGame, inPlan: inPlan, togglePlan: togglePlan,
    openPlay: function (id, side) { showTab('plays'); if ((side || 'off') !== view.side) { view.side = side || 'off'; $$('#side-switch button').forEach(function (x) { x.classList.toggle('on', x.dataset.side === view.side); }); fillCatSelect(); } select(id); },
    refreshPlays: function () { thumbCache = {}; renderList(); select(view.side === 'off' ? view.id : view.defId); },
    bootPlays: boot
  };
})();
