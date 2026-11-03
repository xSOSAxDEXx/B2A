/* B2A Playbook UI */
(function () {
  'use strict';
  var E = window.B2A;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  var LS_CUSTOM = 'b2a.custom.v1', LS_GAME = 'b2a.game.v1';
  var TAGS = ['pass', 'run', 'midfield', 'quick', 'intermediate', 'deep', 'trick', 'vs-blitz', 'vs-man', 'vs-zone', 'third-down', 'short-yardage', 'red-zone', 'pat1', 'pat2', 'rollout', 'misdirection', 'perimeter', 'sideline'];
  var FORM_ORDER = Object.keys(E.FORMATIONS);

  function load(key, def) { try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
  function store(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { toast('Could not save — browser storage is blocked.'); } }
  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 2600); }
  function b64e(s) { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function b64d(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return decodeURIComponent(escape(atob(s))); }

  var custom = load(LS_CUSTOM, []);
  var shared = null;
  function allPlays() {
    var list = B2A_PLAYS.map(function (p, i) { var c = E.clone(p); c.num = i + 1; return c; });
    custom.forEach(function (p, i) { var c = E.clone(p); c.custom = true; c.num = 'M' + (i + 1); list.push(c); });
    if (shared) list.push(shared);
    return list;
  }
  function findPlay(id) { return allPlays().filter(function (p) { return p.id === id; })[0]; }
  function isRun(p) { return !(p.events || []).some(function (e) { return e.type === 'pass'; }); }

  /* ---------------- Animator ---------------- */
  function Animator(svg, onTick) {
    this.svg = svg; this.onTick = onTick; this.speed = 0.6; this.defOn = false; this.running = false; this.t = 0;
    this.uid = 'a' + Math.random().toString(36).slice(2, 6);
  }
  Animator.prototype.load = function (play) {
    this.stop();
    this.play = play;
    this.sim = E.buildSim(play);
    this.defense = E.buildDefense(this.sim);
    this.svg.setAttribute('viewBox', E.viewBox());
    this.svg.innerHTML = E.fieldSVG(this.sim.P, { uid: this.uid }) + E.routesSVG(this.sim, { uid: this.uid }) + '<g class="dyn"></g>';
    this.dyn = this.svg.querySelector('.dyn');
    this.t = this.sim.tStart;
    this.draw();
  };
  Animator.prototype.draw = function () {
    this.dyn.innerHTML = E.playersSVG(this.sim, this.t, this.defOn ? this.defense : null);
    if (this.onTick) this.onTick(this.t, this.sim, this);
  };
  Animator.prototype.start = function () {
    var self = this;
    if (this.t >= this.sim.tEnd - 0.01) this.t = this.sim.tStart;
    this.running = true;
    var last = performance.now();
    function loop(now) {
      if (!self.running) return;
      self.t += Math.min(0.1, (now - last) / 1000) * self.speed;
      last = now;
      if (self.t >= self.sim.tEnd) { self.t = self.sim.tEnd; self.running = false; }
      self.draw();
      if (self.running) self.raf = requestAnimationFrame(loop);
    }
    this.raf = requestAnimationFrame(loop);
    if (this.onTick) this.onTick(this.t, this.sim, this);
  };
  Animator.prototype.stop = function () { this.running = false; cancelAnimationFrame(this.raf); };
  Animator.prototype.reset = function () { this.stop(); this.t = this.sim.tStart; this.draw(); };
  Animator.prototype.seek = function (frac) { this.stop(); this.t = this.sim.tStart + frac * (this.sim.tEnd - this.sim.tStart); this.draw(); };

  /* ---------------- Tabs ---------------- */
  function showTab(name) {
    $$('.tab').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === name); });
    $$('.panel').forEach(function (p) { p.classList.toggle('active', p.id === 'tab-' + name); });
    if (name === 'designer') renderDesigner();
    if (name === 'gameday') renderGame();
    window.scrollTo({ top: 0 });
  }
  $$('.tab').forEach(function (b) { b.addEventListener('click', function () { showTab(b.dataset.tab); }); });

  /* ---------------- Plays tab ---------------- */
  var FILTERS = [['all', 'All'], ['pass', 'Pass'], ['run', 'Run'], ['quick', 'Quick'], ['deep', 'Deep'], ['trick', 'Trick'], ['red', 'Red zone / PAT'], ['midfield', 'Midfield'], ['vs-blitz', 'vs Blitz'], ['mine', 'My plays']];
  var view = { id: B2A_PLAYS[0].id, flip: false, filter: 'all', q: '' };

  $('#filter-chips').innerHTML = FILTERS.map(function (f) { return '<button class="chip' + (f[0] === 'all' ? ' on' : '') + '" data-f="' + f[0] + '">' + f[1] + '</button>'; }).join('');
  $('#filter-chips').addEventListener('click', function (e) {
    var b = e.target.closest('.chip'); if (!b) return;
    view.filter = b.dataset.f;
    $$('.chip', $('#filter-chips')).forEach(function (c) { c.classList.toggle('on', c === b); });
    renderList();
  });
  $('#search').addEventListener('input', function (e) { view.q = e.target.value.toLowerCase(); renderList(); });

  function matches(p) {
    var f = view.filter, tags = p.tags || [];
    if (view.q && (p.name + ' ' + tags.join(' ') + ' ' + (E.FORMATIONS[p.formation] || {}).name).toLowerCase().indexOf(view.q) < 0) return false;
    if (f === 'all') return true;
    if (f === 'mine') return !!p.custom;
    if (f === 'run') return isRun(p);
    if (f === 'pass') return !isRun(p);
    if (f === 'red') return tags.some(function (t) { return t === 'red-zone' || t === 'pat1' || t === 'pat2'; });
    return tags.indexOf(f) >= 0;
  }
  var thumbCache = {};
  function thumb(p, crop) {
    var key = p.id + JSON.stringify(p).length + (crop || '');
    if (!thumbCache[key]) thumbCache[key] = E.staticPlaySVG(p, { crop: crop || [-7, 18], uid: 't' + Object.keys(thumbCache).length });
    return thumbCache[key];
  }
  function tagHTML(p) {
    var tags = (p.tags || []).slice(0, 3);
    return (p.custom ? '<span class="tag custom">mine</span>' : '') + tags.map(function (t) { return '<span class="tag ' + t + '">' + t.replace('-', ' ') + '</span>'; }).join('');
  }
  function renderList() {
    var list = allPlays().filter(matches), html = '', lastGroup = null;
    list.forEach(function (p) {
      var g = p.custom ? 'My plays' : (p.shared ? 'Shared with you' : 'Playbook');
      if (g !== lastGroup) { html += '<div class="group-label">' + g + '</div>'; lastGroup = g; }
      html += '<button class="pcard' + (p.id === view.id ? ' active' : '') + '" data-id="' + esc(p.id) + '">' +
        '<div class="thumb">' + thumb(p) + '</div><div><div class="pname"><span class="num">' + esc(p.num) + '</span>' + esc(p.name) + '</div>' +
        '<div class="tagrow">' + tagHTML(p) + '</div></div></button>';
    });
    $('#play-list').innerHTML = html || '<p class="hint">No plays match.</p>';
  }
  $('#play-list').addEventListener('click', function (e) {
    var b = e.target.closest('.pcard'); if (!b) return;
    selectPlay(b.dataset.id);
    if (window.innerWidth < 980) $('.viewer').scrollIntoView({ behavior: 'smooth' });
  });

  var viewer = new Animator($('#field'), function (t, sim, a) {
    $('#v-time').textContent = Math.max(0, t).toFixed(1) + 's';
    var pc = $('#v-pclock').parentNode, fx = sim.firstExchange;
    var clockT = t <= 0 ? 0 : (fx != null ? Math.min(t, fx) : t);
    pc.classList.remove('warn', 'over', 'off');
    if (fx != null && t >= fx && sim.P.events[0].type !== 'pass') { $('#v-pclock').textContent = 'OFF'; pc.classList.add('off'); }
    else {
      $('#v-pclock').textContent = clockT.toFixed(1) + ' / 7';
      if (clockT > 7) pc.classList.add('over'); else if (clockT > 4.5) pc.classList.add('warn');
    }
    if (!$('#v-scrub')._drag) $('#v-scrub').value = Math.round(1000 * (t - sim.tStart) / (sim.tEnd - sim.tStart));
    $('#v-play').textContent = a.running ? '❚❚ Pause' : '▶ Run play';
  });

  function currentPlay() {
    var p = findPlay(view.id) || allPlays()[0];
    return view.flip ? E.flipPlay(p) : p;
  }
  function checksHTML(res) {
    return res.issues.map(function (i) { return '<li class="' + i.level + '">' + esc(i.msg) + '</li>'; }).join('');
  }
  function selectPlay(id) {
    view.id = id;
    var base = findPlay(id); if (!base) return;
    var p = currentPlay();
    viewer.load(p);
    var f = E.FORMATIONS[p.formation] || {};
    $('#v-name').textContent = (base.num ? base.num + ' · ' : '') + p.name;
    var where = p.ytg ? 'From the ' + p.ytg : (p.ytm ? p.ytm + ' yds from midfield' : 'Open field');
    $('#v-meta').textContent = (f.name || '') + (view.flip ? ' (flipped)' : '') + ' · ' + (isRun(p) ? 'Run' : 'Pass') + ' · ' + where;
    $('#v-reads').innerHTML = (p.reads || []).map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') || '<li>—</li>';
    $('#v-notes').textContent = p.notes || '—';
    var res = E.validate(p);
    $('#v-checks').innerHTML = checksHTML(res);
    var lg = $('#v-legal'); lg.className = 'legal ' + (res.legal ? 'ok' : 'bad'); lg.textContent = res.legal ? '✓ LEGAL' : '✕ RULE ISSUE';
    $('#v-del').classList.toggle('hidden', !base.custom);
    $('#v-edit').textContent = base.custom ? '✎ Edit' : '✎ Edit copy';
    renderList();
    try { history.replaceState(null, '', base.shared ? location.hash : '#play=' + encodeURIComponent(id)); } catch (e) { }
  }

  $('#v-play').addEventListener('click', function () { if (viewer.running) viewer.stop(), viewer.draw(); else viewer.start(); });
  $('#v-reset').addEventListener('click', function () { viewer.reset(); });
  $('#v-speed').addEventListener('change', function (e) { viewer.speed = +e.target.value; });
  var scrub = $('#v-scrub');
  scrub.addEventListener('input', function () { scrub._drag = true; viewer.seek(scrub.value / 1000); scrub._drag = false; });
  $('#v-flip').addEventListener('click', function (e) { view.flip = !view.flip; e.currentTarget.classList.toggle('on', view.flip); selectPlay(view.id); });
  $('#v-def').addEventListener('click', function (e) { viewer.defOn = !viewer.defOn; e.currentTarget.classList.toggle('on', viewer.defOn); viewer.draw(); });
  $('#v-edit').addEventListener('click', function () {
    var base = findPlay(view.id), p = E.clone(view.flip ? E.flipPlay(base) : base);
    if (!base.custom) { delete p.id; p.name = p.name + ' (copy)'; }
    delete p.num; delete p.shared; delete p.flipped;
    openDesigner(p);
  });
  $('#v-del').addEventListener('click', function () {
    var base = findPlay(view.id); if (!base || !base.custom) return;
    if (!confirm('Delete "' + base.name + '" from your plays?')) return;
    custom = custom.filter(function (p) { return p.id !== base.id; }); store(LS_CUSTOM, custom);
    selectPlay(B2A_PLAYS[0].id); toast('Deleted.');
  });
  $('#v-share').addEventListener('click', function () {
    var p = E.clone(currentPlay()); delete p.num; delete p.custom; delete p.shared;
    var url = location.origin + location.pathname + '#p=' + b64e(JSON.stringify(p));
    copyText(url, 'Share link copied — anyone on the team can open it.');
  });
  function copyText(txt, msg) {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { toast(msg); }, function () { prompt('Copy this:', txt); });
    else prompt('Copy this:', txt);
  }

  $('#print-btn').addEventListener('click', function () {
    var cells = allPlays().filter(function (p) { return !p.shared; }).map(function (p) {
      return '<div class="cell"><b>' + esc(p.num) + ' · ' + esc(p.name) + '</b>' + E.staticPlaySVG(p, { crop: [-7, 18], uid: 'pr' + p.num }) + '</div>';
    }).join('');
    $('#print-sheet').innerHTML = '<div class="sheet-title">B2A Call Sheet</div><div class="sheet">' + cells + '</div>';
    window.print();
  });

  /* ---------------- Game Day ---------------- */
  var game = load(LS_GAME, null) || { us: 0, them: 0, half: 1, to: { 1: [false], 2: [false] }, down: 1, sit: 'own', blitz: false };
  game.to = { 1: [!!(game.to && game.to[1] && game.to[1][0])], 2: [!!(game.to && game.to[2] && game.to[2][0])] };
  function saveGame() { store(LS_GAME, game); }
  var ORD = ['', '1st', '2nd', '3rd'];

  function recommend() {
    var g = game, out = [];
    allPlays().forEach(function (p) {
      var tags = p.tags || [], run = isRun(p), score = 0, why = [];
      var has = function (t) { return tags.indexOf(t) >= 0; };
      if ((g.sit === 'nrz' || g.sit === 'nrzmid' || g.sit === 'pat1') && run) return;
      if (!E.validate(p).legal) return;
      if (g.sit === 'nrzmid') { if (p.ytg) score -= 3; if (has('midfield')) { score += 6; why.push('midfield design'); } if (has('quick')) { score += 2; why.push('short pass to midfield'); } if (has('short-yardage')) { score += 2; why.push('short yardage'); } if (has('third-down') && g.down === 3) { score += 3; why.push('3rd-down call'); } if (has('deep')) score -= 1; }
      if (g.sit === 'own' || g.sit === 'past') {
        if (p.ytg || p.ytm) score -= 3;
        if (g.down === 1) { if (has('deep')) { score += 2; why.push('shot play on 1st'); } if (has('trick')) score += 1; if (run) { score += 1; why.push('keeps D honest'); } if (has('intermediate')) score += 1; }
        if (g.down === 2) { if (has('intermediate')) { score += 2; why.push('chunk gain'); } if (run) score += 1; if (has('quick')) score += 1; }
        if (g.down === 3) {
          if (has('third-down')) { score += 4; why.push('3rd-down call'); }
          if (has('quick')) { score += 2; why.push('high %'); }
          if (has('short-yardage')) score += 1;
          if (has('trick')) score -= 2;
          if (has('deep') && g.sit === 'own') score -= 1;
        }
      }
      if (g.sit === 'nrz') { if (has('red-zone')) { score += 5; why.push('red-zone design'); } if (has('deep')) score -= 3; if (has('quick')) score += 1; }
      if (g.sit === 'pat1') { if (has('pat1')) { score += 6; why.push('1-pt package'); } if (has('red-zone')) score += 3; if (has('quick')) score += 1; if (has('deep')) score -= 3; }
      if (g.sit === 'pat2') { if (has('pat2')) { score += 6; why.push('2-pt package'); } if (has('red-zone')) score += 2; if (has('intermediate')) score += 1; if (has('deep')) score -= 2; }
      if (g.blitz) {
        if (has('vs-blitz')) { score += 4; why.push('beats the blitz'); }
        if (has('quick')) { score += 2; if (why.indexOf('high %') < 0) why.push('ball out fast'); }
        if (has('rollout')) { score += 1; why.push('moves the pocket'); }
        if (has('deep') && !has('trick')) score -= 2;
      }
      if (p.custom) score += 0.5;
      out.push({ p: p, score: score, why: why.slice(0, 2) });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out.slice(0, 6);
  }

  function renderGame() {
    $('#sc-us').textContent = game.us; $('#sc-them').textContent = game.them;
    $$('#half-seg button').forEach(function (b) { b.classList.toggle('on', +b.dataset.half === game.half); });
    $('#to-dots').innerHTML = game.to[game.half].map(function (u, i) { return '<span class="to-dot' + (u ? ' used' : '') + '" data-i="' + i + '" title="Tap to use/restore"></span>'; }).join('');
    var isPat = game.sit === 'pat1' || game.sit === 'pat2';
    $$('#downs button').forEach(function (b) { var d = +b.dataset.down; b.classList.toggle('on', d === game.down && !isPat); b.classList.toggle('last', d === 3); b.disabled = isPat; });
    $$('#sit-seg button').forEach(function (b) { b.classList.toggle('on', b.dataset.sit === game.sit); });
    $('#gd-blitz').checked = game.blitz;
    var left = 3 - game.down + 1, hint;
    if (game.sit === 'nrzmid') hint = ORD[game.down] + ' down inside 5 of midfield — NO-RUN ZONE: pass plays only. ' + left + ' play' + (left > 1 ? 's' : '') + ' left to reach midfield.';
    else if (game.sit === 'own') hint = ORD[game.down] + ' down — ' + left + ' play' + (left > 1 ? 's' : '') + ' left to cross midfield.' + (game.down === 3 ? ' Last chance: miss it and it’s a turnover on downs.' : '');
    else if (game.sit === 'past') hint = ORD[game.down] + ' down — ' + left + ' play' + (left > 1 ? 's' : '') + ' left to score.' + (game.down === 3 ? ' Score or turn it over.' : '');
    else if (game.sit === 'nrz') hint = ORD[game.down] + ' down inside the 5 — NO-RUN ZONE: pass plays only, even after a handoff.';
    else if (game.sit === 'pat1') hint = '1-point try from the 5 — pass only (no-run zone). Declare it before the snap.';
    else hint = '2-point try from the 10 — run or pass. Declare it before the snap.';
    $('#gd-hint').textContent = hint;
    $('#gd-sub').textContent = isPat ? '' : '· ' + ORD[game.down] + ' down' + (game.blitz ? ' · vs blitz' : '');
    $('#gd-recs').innerHTML = recommend().map(function (r, i) {
      return '<button class="rec" data-id="' + esc(r.p.id) + '"><div class="thumb">' + thumb(r.p, [-6, 16]) + '</div><div class="rb"><span class="rank">#' + esc(r.p.num) + '</span><b>' + esc(r.p.name) + '</b>' +
        '<div class="why">' + esc(r.why.join(' · ') || (isRun(r.p) ? 'run' : 'pass')) + '</div></div></button>';
    }).join('');
  }
  $('#gd-recs').addEventListener('click', function (e) { var b = e.target.closest('.rec'); if (!b) return; showTab('plays'); selectPlay(b.dataset.id); });
  $$('.mini button').forEach(function (b) { b.addEventListener('click', function () { game[b.dataset.sc] = Math.max(0, game[b.dataset.sc] + +b.dataset.v); saveGame(); renderGame(); }); });
  $('#half-seg').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; game.half = +b.dataset.half; saveGame(); renderGame(); });
  $('#to-dots').addEventListener('click', function (e) { var d = e.target.closest('.to-dot'); if (!d) return; var a = game.to[game.half]; a[+d.dataset.i] = !a[+d.dataset.i]; saveGame(); renderGame(); });
  $('#downs').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; game.down = +b.dataset.down; saveGame(); renderGame(); });
  $('#sit-seg').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; game.sit = b.dataset.sit; if (game.sit === 'pat1' || game.sit === 'pat2') game.down = 1; saveGame(); renderGame(); });
  $('#gd-blitz').addEventListener('change', function (e) { game.blitz = e.target.checked; saveGame(); renderGame(); });
  $('#gd-next').addEventListener('click', function () {
    if (game.sit === 'pat1' || game.sit === 'pat2') { game.sit = 'own'; game.down = 1; toast('Try over — defense next.'); }
    else if (game.down >= 3) { game.down = 1; game.sit = 'own'; toast('Turnover on downs — they start at their own 5. Switch to defense.'); }
    else game.down++;
    saveGame(); renderGame();
  });
  $('#gd-mid').addEventListener('click', function () { game.sit = 'past'; game.down = 1; saveGame(); renderGame(); toast('New set of 3 downs to score.'); });
  $('#gd-td').addEventListener('click', function () { game.us += 6; game.sit = 'pat1'; game.down = 1; saveGame(); renderGame(); toast('Touchdown! Pick the 1-pt or 2-pt try.'); });
  $('#gd-new').addEventListener('click', function () { game.sit = 'own'; game.down = 1; saveGame(); renderGame(); });
  $('#gd-reset').addEventListener('click', function () { if (!confirm('Reset score, timeouts and series?')) return; game = { us: 0, them: 0, half: 1, to: { 1: [false], 2: [false] }, down: 1, sit: 'own', blitz: false }; saveGame(); renderGame(); });

  /* ---------------- Designer ---------------- */
  var D = { play: null, sel: 'QB', mode: 'draw', drag: null, anim: null };
  function blankPlay(form) {
    return { name: '', formation: form || 'spread', tags: ['pass'], players: { QB: { route: { pts: [[12.5, -6]] } } }, events: [{ t: 2.0, type: 'pass', from: 'QB', to: 'X' }], reads: [], notes: '' };
  }
  function openDesigner(p) {
    D.play = E.normalizePlay(p);
    D.play.reads = p.reads || []; D.play.notes = p.notes || '';
    D.sel = 'X';
    fillDesignerForm();
    showTab('designer');
  }
  $('#d-form').innerHTML = FORM_ORDER.map(function (k) { return '<option value="' + k + '">' + E.FORMATIONS[k].name + '</option>'; }).join('');
  $('#d-roles').innerHTML = E.ROLES.map(function (r) { return '<button class="role-chip" data-role="' + r + '" style="background:' + E.COLORS[r] + '">' + r + '</button>'; }).join('');
  $('#d-tags').innerHTML = TAGS.map(function (t) { return '<button class="chip" data-tag="' + t + '">' + t + '</button>'; }).join('');

  function fillDesignerForm() {
    var p = D.play;
    $('#d-name').value = p.name || '';
    $('#d-form').value = p.formation || 'spread';
    $('#d-ytg').value = p.ytg ? String(p.ytg) : (p.ytm ? 'm' + p.ytm : '');
    $('#d-reads').value = (p.reads || []).join('\n');
    $('#d-notes').value = p.notes || '';
    $$('#d-tags .chip').forEach(function (c) { c.classList.toggle('on', (p.tags || []).indexOf(c.dataset.tag) >= 0); });
    renderEvents();
  }

  var dfield = $('#dfield');
  function renderDesigner() {
    if (!D.play) { D.play = E.normalizePlay(blankPlay()); D.play.reads = []; D.play.notes = ''; D.sel = 'X'; fillDesignerForm(); }
    if (D.anim) { D.anim.stop(); D.anim = null; }
    var sim = E.buildSim(D.play);
    dfield.setAttribute('viewBox', E.viewBox());
    var dots = '';
    var r = D.play.players[D.sel];
    r.route.pts.forEach(function (pt, i) { dots += '<circle class="pt-dot" cx="' + E.sx(pt[0]) + '" cy="' + E.sy(pt[1]) + '" r="' + (i === r.route.pts.length - 1 ? 6 : 4.5) + '"/>'; });
    if (D.play.motion && D.play.motion.player === D.sel) D.play.motion.pts.forEach(function (pt) { dots += '<circle class="pt-dot" cx="' + E.sx(pt[0]) + '" cy="' + E.sy(pt[1]) + '" r="4.5"/>'; });
    dfield.innerHTML = E.fieldSVG(sim.P, { uid: 'd' }) + E.routesSVG(sim, { uid: 'd' }) + dots + E.playersSVG(sim, sim.tStart, null, { selected: D.sel, showBall: false });
    $('#d-time').textContent = 'pre-snap';
    $$('#d-roles .role-chip').forEach(function (c) { c.classList.toggle('on', c.dataset.role === D.sel); });
    $$('#d-mode button').forEach(function (b) { b.classList.toggle('on', b.dataset.mode === D.mode); });
    $('#d-sel-name').textContent = E.ROLE_NAMES[D.sel] + ' (' + D.sel + ')';
    $('#d-delay').value = r.route.delay; $('#d-speed').value = r.route.speed;
    $('#d-hint').textContent = D.mode === 'draw' ? 'Tap a player to select, then tap the field to add route points for ' + D.sel + '. Points snap to ½ yd.' : 'Drag players to set their alignment, or drag the white dots to reshape a route.';
    $('#d-checks').innerHTML = checksHTML(E.validate(D.play));
  }

  function fieldPoint(e) {
    var pt = dfield.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    var l = pt.matrixTransform(dfield.getScreenCTM().inverse());
    var x = Math.round(l.x / E.FIELD.S * 2) / 2, y = Math.round((E.FIELD.YMAX - l.y / E.FIELD.S) * 2) / 2;
    return [Math.max(0, Math.min(E.FIELD.W, x)), Math.max(E.FIELD.YMIN + 0.5, Math.min(E.FIELD.YMAX - 0.5, y))];
  }
  function nearestPlayer(pt, maxd) {
    var best = null, bd = maxd;
    E.ROLES.forEach(function (r) { var d = E.dist(pt, D.play.players[r].start); if (d < bd) { bd = d; best = r; } });
    return best;
  }
  dfield.addEventListener('pointerdown', function (e) {
    if (D.anim) { renderDesigner(); return; }
    var pt = fieldPoint(e), hit = nearestPlayer(pt, 1.2);
    if (D.mode === 'draw') {
      if (hit) { D.sel = hit; renderDesigner(); return; }
      D.play.players[D.sel].route.pts.push(pt);
      renderDesigner(); return;
    }
    // move mode: route dots of selected first, then players
    var pts = D.play.players[D.sel].route.pts, bi = -1, bd = 1;
    pts.forEach(function (p, i) { var d = E.dist(p, pt); if (d < bd) { bd = d; bi = i; } });
    if (bi >= 0) D.drag = { kind: 'pt', i: bi };
    else if (hit) { D.sel = hit; D.drag = { kind: 'start', role: hit }; }
    else return;
    dfield.setPointerCapture(e.pointerId);
    renderDesigner();
  });
  dfield.addEventListener('pointermove', function (e) {
    if (!D.drag) return;
    var pt = fieldPoint(e);
    if (D.drag.kind === 'pt') D.play.players[D.sel].route.pts[D.drag.i] = pt;
    else {
      var r = D.drag.role;
      if (r === 'C') pt[1] = 0; else pt[1] = Math.min(pt[1], 0);
      D.play.players[r].start = pt;
      if (D.play.motion && D.play.motion.player === r) D.play.motion.pts = D.play.motion.pts.map(function (m) { return [m[0], pt[1]]; });
    }
    renderDesigner();
  });
  function endDrag() { D.drag = null; }
  dfield.addEventListener('pointerup', endDrag);
  dfield.addEventListener('pointercancel', endDrag);

  $('#d-roles').addEventListener('click', function (e) { var b = e.target.closest('.role-chip'); if (!b) return; D.sel = b.dataset.role; renderDesigner(); });
  $('#d-mode').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; D.mode = b.dataset.mode; renderDesigner(); });
  $('#d-undo').addEventListener('click', function () { D.play.players[D.sel].route.pts.pop(); renderDesigner(); });
  $('#d-clear').addEventListener('click', function () {
    D.play.players[D.sel].route.pts = [];
    if (D.play.motion && D.play.motion.player === D.sel) delete D.play.motion;
    renderDesigner();
  });
  $('#d-motion').addEventListener('click', function () {
    var r = D.sel, pl = D.play.players[r];
    if (r === 'C' || r === 'QB') { toast('Only receivers can go in motion.'); return; }
    if (!pl.route.pts.length) { toast('Draw the motion path first (1 point sideways), then tap “Set as motion”.'); return; }
    if (pl.start[1] > -1) pl.start = [pl.start[0], -1];
    var first = pl.route.pts.shift();
    D.play.motion = { player: r, pts: [[first[0], pl.start[1]]] };
    toast(r + ' now motions pre-snap. Remaining points are the route after the snap.');
    renderDesigner();
  });
  $('#d-preview').addEventListener('click', function () {
    if (D.anim) { renderDesigner(); return; }
    D.anim = new Animator(dfield, function (t, sim, a) {
      $('#d-time').textContent = Math.max(0, t).toFixed(1) + 's';
      if (!a.running && t >= sim.tEnd) $('#d-preview').textContent = '▶ Preview';
    });
    D.anim.speed = +$('#v-speed').value;
    D.anim.load(D.play); D.anim.start();
    $('#d-hint').textContent = 'Previewing… tap the field to go back to editing.';
  });
  $('#d-delay').addEventListener('change', function (e) { D.play.players[D.sel].route.delay = Math.max(0, +e.target.value || 0); renderDesigner(); });
  $('#d-speed').addEventListener('change', function (e) { D.play.players[D.sel].route.speed = Math.max(1, +e.target.value || 6); renderDesigner(); });
  $('#d-name').addEventListener('input', function (e) { D.play.name = e.target.value; });
  $('#d-reads').addEventListener('input', function (e) { D.play.reads = e.target.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean); });
  $('#d-notes').addEventListener('input', function (e) { D.play.notes = e.target.value; });
  $('#d-ytg').addEventListener('change', function (e) { var v = e.target.value; delete D.play.ytg; delete D.play.ytm; if (v.charAt(0) === 'm') D.play.ytm = +v.slice(1); else if (v) D.play.ytg = +v; renderDesigner(); });
  $('#d-form').addEventListener('change', function (e) {
    var f = E.FORMATIONS[e.target.value];
    D.play.formation = e.target.value;
    E.ROLES.forEach(function (r) {
      var pl = D.play.players[r], dx = f[r][0] - pl.start[0], dy = f[r][1] - pl.start[1];
      pl.start = f[r].slice();
      pl.route.pts = pl.route.pts.map(function (p) { return [p[0] + dx, p[1] + dy]; });
    });
    delete D.play.motion;
    renderDesigner();
  });
  $('#d-tags').addEventListener('click', function (e) {
    var c = e.target.closest('.chip'); if (!c) return;
    var t = c.dataset.tag, tags = D.play.tags = D.play.tags || [], i = tags.indexOf(t);
    if (i >= 0) tags.splice(i, 1); else tags.push(t);
    c.classList.toggle('on', i < 0);
  });

  function renderEvents() {
    var ev = D.play.events;
    var opt = function (list, v) { return list.map(function (x) { return '<option' + (x === v ? ' selected' : '') + '>' + x + '</option>'; }).join(''); };
    $('#d-events').innerHTML = (ev.length ? '<div class="ev-head"><span>Type</span><span>From</span><span>To</span><span>At (s)</span></div>' : '<p class="hint">No exchanges yet — the QB has to hand off or throw.</p>') +
      ev.map(function (e, i) {
        return '<div class="ev-row" data-i="' + i + '"><select data-k="type">' + opt(['handoff', 'pitch', 'pass'], e.type) + '</select><select data-k="from">' + opt(E.ROLES, e.from) + '</select><select data-k="to">' + opt(E.ROLES, e.to) + '</select>' +
          '<input data-k="t" type="number" step="0.05" min="0.35" max="7" value="' + e.t + '"><button data-del="' + i + '" title="Remove">✕</button></div>';
      }).join('');
  }
  $('#d-events').addEventListener('change', function (e) {
    var row = e.target.closest('.ev-row'); if (!row) return;
    var ev = D.play.events[+row.dataset.i], k = e.target.dataset.k;
    ev[k] = k === 't' ? Math.max(0.35, +e.target.value || 0.35) : e.target.value;
    D.play.events.sort(function (a, b) { return a.t - b.t; });
    renderEvents(); renderDesigner();
  });
  $('#d-events').addEventListener('click', function (e) {
    var b = e.target.closest('[data-del]'); if (!b) return;
    D.play.events.splice(+b.dataset.del, 1); renderEvents(); renderDesigner();
  });
  $('#d-add-ev').addEventListener('click', function () {
    var ev = D.play.events, last = ev[ev.length - 1];
    var holder = last ? last.to : 'QB';
    var hasPass = ev.some(function (e) { return e.type === 'pass'; });
    ev.push({ t: last ? +(last.t + 0.8).toFixed(2) : 2.0, type: hasPass ? 'pitch' : 'pass', from: holder, to: D.sel !== holder ? D.sel : (holder === 'X' ? 'Z' : 'X') });
    renderEvents(); renderDesigner();
  });

  function cleanDraft() {
    var p = E.clone(D.play);
    p.name = (p.name || '').trim() || 'Untitled play';
    E.ROLES.forEach(function (r) { var rt = p.players[r].route; rt.pts = rt.pts.map(function (q) { return [+q[0].toFixed(1), +q[1].toFixed(1)]; }); });
    delete p.flipped; delete p.custom; delete p.num;
    return p;
  }
  $('#d-save').addEventListener('click', function () {
    var p = cleanDraft();
    var res = E.validate(p);
    if (!res.legal && !confirm('This play has rule issues. Save anyway?')) return;
    if (!p.id || !custom.some(function (c) { return c.id === p.id; })) { p.id = 'custom-' + Date.now().toString(36); custom.push(p); }
    else custom = custom.map(function (c) { return c.id === p.id ? p : c; });
    D.play.id = p.id;
    store(LS_CUSTOM, custom);
    toast('Saved to My plays.');
    showTab('plays'); selectPlay(p.id);
  });
  $('#d-new').addEventListener('click', function () { if (!confirm('Start a new blank play? Unsaved changes are lost.')) return; openDesigner(blankPlay($('#d-form').value)); });
  $('#d-copy').addEventListener('click', function () { var p = cleanDraft(); if (!p.id || p.id.indexOf('custom-') === 0) p.id = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'); copyText(JSON.stringify(p, null, 2), 'Play JSON copied — paste it into js/plays.js to add it to the team playbook.'); });
  $('#d-export').addEventListener('click', function () {
    if (!custom.length) { toast('No saved plays yet.'); return; }
    var blob = new Blob([JSON.stringify(custom, null, 2)], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'b2a-my-plays.json'; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });
  $('#d-import').addEventListener('change', function (e) {
    var f = e.target.files[0]; if (!f) return;
    f.text().then(function (txt) {
      var data = JSON.parse(txt), arr = Array.isArray(data) ? data : [data], n = 0;
      arr.forEach(function (p) {
        if (!p || !p.players || !p.formation) return;
        p.id = 'custom-' + Date.now().toString(36) + n; delete p.custom; custom.push(p); n++;
      });
      store(LS_CUSTOM, custom); renderList(); toast('Imported ' + n + ' play' + (n === 1 ? '' : 's') + '.');
    }).catch(function () { toast('That file isn’t a playbook export.'); });
    e.target.value = '';
  });

  /* ---------------- Rules ---------------- */
  $('#rules-grid').innerHTML = B2A_RULES.map(function (s) {
    return '<div class="card"><h3>' + s.icon + ' ' + esc(s.title) + '</h3><ul>' + s.items.map(function (i) {
      return '<li class="' + (i.league ? 'league' : '') + (i.diff ? ' diff' : '') + '">' + (i.league ? '<b>HOUSE RULE · </b>' : '') + i.t + '</li>';
    }).join('') + '</ul></div>';
  }).join('') + '<div class="card"><h3>🚩 Penalties</h3><table class="pen-table">' + B2A_PENALTIES.map(function (r) {
    return '<tr><td>' + r[0] + '</td><td>' + esc(r[1]) + '</td><td>' + esc(r[2]) + '</td></tr>';
  }).join('') + '</table><p class="hint">Defensive penalties also give an automatic first down where noted. Penalty yardage is halved when it’s more than half the distance to the goal.</p></div>';

  /* ---------------- Boot ---------------- */
  function boot() {
    var h = location.hash;
    if (h.indexOf('#p=') === 0) {
      try {
        shared = JSON.parse(b64d(h.slice(3)));
        shared.id = 'shared'; shared.shared = true; shared.num = 'S'; shared.tags = (shared.tags || []).concat();
        renderList(); selectPlay('shared');
        toast('Shared play opened — tap “Edit copy” then Save to keep it.');
        return;
      } catch (e) { toast('That share link is broken.'); }
    }
    var m = h.match(/^#play=(.+)$/);
    var id = m ? decodeURIComponent(m[1]) : B2A_PLAYS[0].id;
    selectPlay(findPlay(id) ? id : B2A_PLAYS[0].id);
  }
  boot();
})();
