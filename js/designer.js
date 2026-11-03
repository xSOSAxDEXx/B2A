/* Designer: draw routes, place players, set ball exchanges (passes thrown on a receiver's break), rules check, save to team plays. */
(function () {
  'use strict';
  var A = window.APP, E = A.E, ST = A.ST, $ = A.$, $$ = A.$$, esc = A.esc;
  var TAGS = ['pass', 'run', 'quick', 'intermediate', 'deep', 'trick', 'vs-blitz', 'vs-man', 'vs-zone', 'third-down', 'short-yardage', 'red-zone', 'pat1', 'pat2', 'rollout', 'misdirection', 'perimeter', 'sideline', 'two-minute'];
  var D = { play: null, sel: 'X', mode: 'draw', drag: null, anim: null };
  var dfield = $('#dfield');

  function blankPlay(form) {
    return { name: '', cat: 'team', formation: form || 'spread', tags: ['pass'], players: { QB: { route: { pts: [[12.5, -6]] } } }, events: [{ type: 'pass', from: 'QB', to: 'X', brk: 0 }], reads: [], notes: '' };
  }
  function open(p) {
    D.play = E.normalizePlay(p);
    D.play.reads = p.reads || []; D.play.notes = p.notes || ''; D.play.cat = p.cat || 'team';
    if (p.id) D.play.id = p.id;
    D.sel = 'X'; fillForm(); A.showTab('designer');
  }
  $('#d-form').innerHTML = Object.keys(E.FORMATIONS).map(function (k) { return '<option value="' + k + '">' + E.FORMATIONS[k].name + '</option>'; }).join('');
  $('#d-cat').innerHTML = '<option value="team">Team plays</option>' + B2A_CATS.map(function (c) { return '<option value="' + c[0] + '">' + esc(c[1]) + '</option>'; }).join('');
  $('#d-roles').innerHTML = E.ROLES.map(function (r) { return '<button class="role-chip" data-role="' + r + '" style="background:' + E.COLORS[r] + '">' + r + '</button>'; }).join('');
  $('#d-tags').innerHTML = TAGS.map(function (t) { return '<button class="chip" data-tag="' + t + '">' + t + '</button>'; }).join('');

  function fillForm() {
    var p = D.play;
    $('#d-name').value = p.name || ''; $('#d-form').value = p.formation || 'spread'; $('#d-cat').value = p.cat || 'team';
    $('#d-ytg').value = p.ytg ? String(p.ytg) : (p.ytm ? 'm' + p.ytm : '');
    $('#d-reads').value = (p.reads || []).join('\n'); $('#d-notes').value = p.notes || '';
    $$('#d-tags .chip').forEach(function (c) { c.classList.toggle('on', (p.tags || []).indexOf(c.dataset.tag) >= 0); });
    renderEvents();
  }

  function render() {
    if (!D.play) { open(blankPlay()); return; }
    if (D.anim) { D.anim.stop(); D.anim = null; $('#d-preview').textContent = '▶ Preview'; }
    var sim = E.buildSim(D.play);
    dfield.setAttribute('viewBox', E.viewBox());
    var dots = '', r = D.play.players[D.sel];
    r.route.pts.forEach(function (pt, i) {
      dots += '<circle class="pt-dot" cx="' + E.sx(pt[0]) + '" cy="' + E.sy(pt[1]) + '" r="' + (i === r.route.pts.length - 1 ? 6 : 4.5) + '"/><text class="pt-num" x="' + (E.sx(pt[0]) + 8) + '" y="' + (E.sy(pt[1]) - 6) + '">' + (i + 1) + '</text>';
    });
    if (D.play.motion && D.play.motion.player === D.sel) D.play.motion.pts.forEach(function (pt) { dots += '<circle class="pt-dot" cx="' + E.sx(pt[0]) + '" cy="' + E.sy(pt[1]) + '" r="4.5"/>'; });
    dfield.innerHTML = E.fieldSVG(sim.P, { uid: 'd' }) + E.routesSVG(sim, { uid: 'd', noYac: true }) + dots + E.playersSVG(sim, sim.tStart, null, { selected: D.sel, showBall: false });
    $('#d-time').textContent = 'pre-snap';
    $$('#d-roles .role-chip').forEach(function (c) { c.classList.toggle('on', c.dataset.role === D.sel); });
    $$('#d-mode button').forEach(function (b) { b.classList.toggle('on', b.dataset.mode === D.mode); });
    $('#d-sel-name').textContent = E.ROLE_NAMES[D.sel] + ' (' + D.sel + ')';
    $('#d-delay').value = r.route.delay; $('#d-speed').value = r.route.speed;
    $('#d-hint').textContent = D.mode === 'draw' ? 'Tap a player to select, then tap the field to add route points for ' + D.sel + '. Points are numbered — pick which one is the break for the throw below.' : 'Drag players to set their alignment, or drag the white dots to reshape a route.';
    $('#d-checks').innerHTML = E.validate(D.play).issues.map(function (i) { return '<li class="' + i.level + '">' + esc(i.msg) + '</li>'; }).join('');
    renderEvents(sim);
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
    if (D.anim) { render(); return; }
    var pt = fieldPoint(e), hit = nearestPlayer(pt, 1.2);
    if (D.mode === 'draw') {
      if (hit) { D.sel = hit; render(); return; }
      D.play.players[D.sel].route.pts.push(pt); render(); return;
    }
    var pts = D.play.players[D.sel].route.pts, bi = -1, bd = 1;
    pts.forEach(function (p, i) { var d = E.dist(p, pt); if (d < bd) { bd = d; bi = i; } });
    if (bi >= 0) D.drag = { kind: 'pt', i: bi };
    else if (hit) { D.sel = hit; D.drag = { kind: 'start', role: hit }; }
    else return;
    dfield.setPointerCapture(e.pointerId); render();
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
    render();
  });
  function endDrag() { D.drag = null; }
  dfield.addEventListener('pointerup', endDrag); dfield.addEventListener('pointercancel', endDrag);

  $('#d-roles').addEventListener('click', function (e) { var b = e.target.closest('.role-chip'); if (!b) return; D.sel = b.dataset.role; render(); });
  $('#d-mode').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; D.mode = b.dataset.mode; render(); });
  $('#d-undo').addEventListener('click', function () { D.play.players[D.sel].route.pts.pop(); render(); });
  $('#d-clear').addEventListener('click', function () { D.play.players[D.sel].route.pts = []; if (D.play.motion && D.play.motion.player === D.sel) delete D.play.motion; render(); });
  $('#d-motion').addEventListener('click', function () {
    var r = D.sel, pl = D.play.players[r];
    if (r === 'C' || r === 'QB') { A.toast('Only receivers can go in motion.'); return; }
    if (!pl.route.pts.length) { A.toast('Draw one sideways point for the motion first, then tap “Set as motion”.'); return; }
    if (pl.start[1] > -1) pl.start = [pl.start[0], -1];
    var first = pl.route.pts.shift();
    D.play.motion = { player: r, pts: [[first[0], pl.start[1]]] };
    A.toast(r + ' now motions pre-snap; the remaining points are his route after the snap.'); render();
  });
  $('#d-preview').addEventListener('click', function () {
    if (D.anim) { render(); return; }
    D.anim = new A.Animator(dfield, function (t, a) { $('#d-time').textContent = Math.max(0, t).toFixed(1) + 's'; });
    D.anim.speed = +$('#v-speed').value; D.anim.load(D.play, null, 'off'); D.anim.start();
    $('#d-preview').textContent = '■ Stop'; $('#d-hint').textContent = 'Previewing… tap the field to go back to editing.';
  });
  $('#d-delay').addEventListener('change', function (e) { D.play.players[D.sel].route.delay = Math.max(0, +e.target.value || 0); render(); });
  $('#d-speed').addEventListener('change', function (e) { D.play.players[D.sel].route.speed = Math.max(1, +e.target.value || 6); render(); });
  $('#d-name').addEventListener('input', function (e) { D.play.name = e.target.value; });
  $('#d-cat').addEventListener('change', function (e) { D.play.cat = e.target.value; });
  $('#d-reads').addEventListener('input', function (e) { D.play.reads = e.target.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean); });
  $('#d-notes').addEventListener('input', function (e) { D.play.notes = e.target.value; });
  $('#d-ytg').addEventListener('change', function (e) { var v = e.target.value; delete D.play.ytg; delete D.play.ytm; if (v.charAt(0) === 'm') D.play.ytm = +v.slice(1); else if (v) D.play.ytg = +v; render(); });
  $('#d-form').addEventListener('change', function (e) {
    var f = E.FORMATIONS[e.target.value]; D.play.formation = e.target.value;
    E.ROLES.forEach(function (r) {
      var pl = D.play.players[r], dx = f[r][0] - pl.start[0], dy = f[r][1] - pl.start[1];
      pl.start = f[r].slice(); pl.route.pts = pl.route.pts.map(function (p) { return [p[0] + dx, p[1] + dy]; });
    });
    delete D.play.motion; render();
  });
  $('#d-tags').addEventListener('click', function (e) {
    var c = e.target.closest('.chip'); if (!c) return;
    var t = c.dataset.tag, tags = D.play.tags = D.play.tags || [], i = tags.indexOf(t);
    if (i >= 0) tags.splice(i, 1); else tags.push(t);
    c.classList.toggle('on', i < 0);
  });

  /* ball exchanges: passes default to "throw on the break" (route point #) */
  function renderEvents(sim) {
    var ev = D.play.events, opt = function (list, v) { return list.map(function (x) { return '<option' + (x === v ? ' selected' : '') + '>' + x + '</option>'; }).join(''); };
    var timed = sim ? sim.P.events : [];
    $('#d-events').innerHTML = (ev.length ? '<div class="ev-head"><span>Type</span><span>From</span><span>To</span><span>When</span></div>' : '<p class="hint">No exchanges yet — the QB has to hand off or throw.</p>') +
      ev.map(function (e, i) {
        var when;
        if (e.type === 'pass') {
          var n = D.play.players[e.to].route.pts.length, opts = '';
          for (var k = 0; k < n; k++) opts += '<option value="' + k + '"' + (e.brk === k ? ' selected' : '') + '>Break @ pt ' + (k + 1) + '</option>';
          opts += '<option value="t"' + (e.brk == null ? ' selected' : '') + '>Fixed time…</option>';
          when = '<select data-k="brk">' + opts + '</select>' + (e.brk == null ? '<input data-k="t" type="number" step="0.05" min="0.35" max="7" value="' + (e.t || 1.5) + '">' : '');
          var te = timed.filter(function (x) { return x.type === 'pass' && x.to === e.to && x.from === e.from; })[0];
          if (te && e.brk != null) when += '<span class="ev-t">throw ' + te.t.toFixed(2) + 's</span>';
        } else when = '<input data-k="t" type="number" step="0.05" min="0.35" max="7" value="' + e.t + '">';
        return '<div class="ev-row" data-i="' + i + '"><select data-k="type">' + opt(['handoff', 'pitch', 'pass'], e.type) + '</select><select data-k="from">' + opt(E.ROLES, e.from) + '</select><select data-k="to">' + opt(E.ROLES, e.to) + '</select>' +
          '<div class="ev-when">' + when + '</div><button data-del="' + i + '" title="Remove">✕</button></div>';
      }).join('');
  }
  $('#d-events').addEventListener('change', function (e) {
    var row = e.target.closest('.ev-row'); if (!row) return;
    var ev = D.play.events[+row.dataset.i], k = e.target.dataset.k, v = e.target.value;
    if (k === 'brk') { if (v === 't') { delete ev.brk; ev.t = ev.t || 1.5; } else ev.brk = +v; }
    else if (k === 't') ev.t = Math.max(0.35, +v || 0.35);
    else { ev[k] = v; if (k === 'type' && v === 'pass' && ev.brk == null) ev.brk = 0; if (k === 'type' && v !== 'pass') { delete ev.brk; ev.t = ev.t || 0.6; } }
    render();
  });
  $('#d-events').addEventListener('click', function (e) { var b = e.target.closest('[data-del]'); if (!b) return; D.play.events.splice(+b.dataset.del, 1); render(); });
  $('#d-add-ev').addEventListener('click', function () {
    var ev = D.play.events, last = ev[ev.length - 1], holder = last ? last.to : 'QB';
    var hasPass = ev.some(function (e) { return e.type === 'pass'; });
    var to = D.sel !== holder ? D.sel : (holder === 'X' ? 'Z' : 'X');
    ev.push(hasPass ? { type: 'pitch', from: holder, to: to, t: last ? +((last.t || 1) + 0.8).toFixed(2) : 1 } : { type: 'pass', from: holder, to: to, brk: 0 });
    render();
  });

  function cleanDraft() {
    var p = E.clone(D.play);
    p.name = (p.name || '').trim() || 'Untitled play';
    E.ROLES.forEach(function (r) { var rt = p.players[r].route; rt.pts = rt.pts.map(function (q) { return [+q[0].toFixed(1), +q[1].toFixed(1)]; }); });
    p.events.forEach(function (e) { if (e.brk != null) delete e.t; });
    delete p.flipped; delete p.custom; delete p.num;
    return p;
  }
  $('#d-save').addEventListener('click', function () {
    var p = cleanDraft();
    if (!E.validate(p).legal && !confirm('This play has rule issues. Save anyway?')) return;
    var tp = ST.S.data.teamPlays;
    if (!p.id || !tp.some(function (c) { return c.id === p.id; })) { p.id = 'team-' + Date.now().toString(36); tp.push(p); }
    else ST.S.data.teamPlays = tp.map(function (c) { return c.id === p.id ? p : c; });
    D.play.id = p.id; ST.save();
    A.toast('Saved to team plays. Publish from Game Day so the team gets it.');
    A.refreshPlays(); A.openPlay(p.id, 'off');
  });
  $('#d-new').addEventListener('click', function () { if (confirm('Start a new blank play? Unsaved changes are lost.')) open(blankPlay($('#d-form').value)); });
  $('#d-copy').addEventListener('click', function () {
    var p = cleanDraft(); if (!p.id || p.id.indexOf('team-') === 0) p.id = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    A.copyText(JSON.stringify(p, null, 2), 'Play JSON copied — paste it into js/plays.js to make it part of the built-in book.');
  });

  A.openDesigner = open;
  A.tabHooks.designer = render;
})();
