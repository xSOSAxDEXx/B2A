/* Game Day: matchup, weekly game plan, scoreboard, series tracker, play caller, results log, coach tools. */
(function () {
  'use strict';
  var A = window.APP, ST = A.ST, $ = A.$, $$ = A.$$, esc = A.esc;
  var ORD = ['', '1st', '2nd', '3rd'];
  var g0 = function () { return ST.game(); };

  function optionGroups(side) {
    if (side === 'def') return A.defPlays().map(function (d) { return '<option value="' + d.id + '">' + esc(d.num + ' · ' + d.name) + '</option>'; }).join('');
    var groups = {};
    A.offPlays().filter(function (p) { return !p.shared; }).forEach(function (p) { var g = p.custom ? 'Team plays' : A.CAT_NAME[p.cat] || 'Other'; (groups[g] = groups[g] || []).push(p); });
    return Object.keys(groups).map(function (g) { return '<optgroup label="' + esc(g) + '">' + groups[g].map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.num + ' · ' + p.name) + '</option>'; }).join('') + '</optgroup>'; }).join('');
  }

  /* ---------- matchup ---------- */
  function renderGameSelect() {
    var games = ST.S.data.games.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    $('#gd-game').innerHTML = games.length ? games.map(function (g) {
      return '<option value="' + g.id + '">' + esc(fmtDate(g.date) + ' · vs ' + g.opp) + (g.us || g.them ? ' (' + g.us + '–' + g.them + ')' : '') + '</option>';
    }).join('') : '<option value="">No games yet — create one →</option>';
    $('#gd-game').value = ST.S.data.activeGame || '';
    $('#gd-opp-list').innerHTML = ST.S.data.opponents.map(function (o) { return '<option value="' + esc(o) + '">'; }).join('');
  }
  function fmtDate(d) { if (!d) return ''; var p = d.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
  $('#gd-game').addEventListener('change', function (e) { ST.S.data.activeGame = e.target.value; ST.save(); });
  $('#gd-new-game').addEventListener('click', function () {
    $('#gd-new-form').classList.remove('hidden');
    var d = new Date(); d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
    $('#gd-date-in').value = ST.localDate(d); $('#gd-opp-in').focus();
  });
  $('#gd-cancel').addEventListener('click', function () { $('#gd-new-form').classList.add('hidden'); });
  $('#gd-create').addEventListener('click', function () {
    var name = $('#gd-opp-in').value.trim(); if (!name) { A.toast('Enter the opponent’s team name.'); return; }
    var g = ST.newGame(name, $('#gd-date-in').value);
    $('#gd-new-form').classList.add('hidden'); $('#gd-opp-in').value = '';
    A.toast('Game vs ' + g.opp + ' created' + (g.plan.off.length ? ' — copied your last plan vs them.' : '. Add plays to the game plan.'));
  });

  /* ---------- game plan ---------- */
  function planItem(id, side) {
    var p = side === 'off' ? A.findOff(id) : A.findDef(id); if (!p) return '';
    var s = ST.playStats({ side: side })[id], r = ST.rating(id);
    return '<div class="plan-item" data-id="' + esc(id) + '" data-side="' + side + '"><div class="thumb">' + A.thumb(p, [-6, 16]) + '</div>' +
      '<div class="pi-body"><b><span class="num">' + esc(p.num) + '</span>' + esc(p.name) + '</b><span class="muted">' + (s && s.calls ? s.ok + '/' + s.calls + ' success' : 'no results yet') + (r ? ' · ' + ICON(r > 0 ? 'up' : 'down') : '') + '</span>' + (function () { var rep = A.playReport && A.playReport(side, id); if (!rep || !ST.S.data.roster.length) return ''; return rep.warnCount ? '<span class="pi-warn">' + ICON('warn') + ' ' + rep.warnCount + ' fit warning' + (rep.warnCount > 1 ? 's' : '') + '</span>' : rep.open ? '<span class="muted">' + rep.open + ' spots open</span>' : '<span class="pi-ok">' + ICON('check') + ' assigned</span>'; })() + '</div>' +
      '<button class="x" data-rm="1" title="Remove">✕</button></div>';
  }
  function renderPlan() {
    var g = g0();
    $('#gd-plan-card').classList.toggle('disabled', !g);
    $('#gd-add-off').innerHTML = optionGroups('off'); $('#gd-add-def').innerHTML = optionGroups('def');
    $('#gd-plan-off').innerHTML = g && g.plan.off.length ? g.plan.off.map(function (id) { return planItem(id, 'off'); }).join('') : '<p class="hint">No offensive plays yet.</p>';
    $('#gd-plan-def').innerHTML = g && g.plan.def.length ? g.plan.def.map(function (id) { return planItem(id, 'def'); }).join('') : '<p class="hint">No defensive calls yet.</p>';
    if (document.activeElement !== $('#gd-notes')) $('#gd-notes').value = g ? g.notes || '' : '';   // don't wipe what someone is typing when a live update arrives
  }
  function addPlan(side) {
    var g = g0(); if (!g) { A.toast('Create the game first.'); return; }
    var id = $('#gd-add-' + side).value; if (g.plan[side].indexOf(id) >= 0) { A.toast('Already in the plan.'); return; }
    g.plan[side].push(id); ST.save();
  }
  $('#gd-add-off-btn').addEventListener('click', function () { addPlan('off'); });
  $('#gd-add-def-btn').addEventListener('click', function () { addPlan('def'); });
  ['#gd-plan-off', '#gd-plan-def'].forEach(function (sel) {
    $(sel).addEventListener('click', function (e) {
      var it = e.target.closest('.plan-item'); if (!it) return;
      var g = g0(); if (!g) return;
      if (e.target.closest('[data-rm]')) { var a = g.plan[it.dataset.side]; a.splice(a.indexOf(it.dataset.id), 1); ST.save(); return; }
      A.openPlay(it.dataset.id, it.dataset.side);
    });
  });
  // notes save a moment after you stop typing, so leaving the box doesn't redraw the page under your next tap
  var notesT = null;
  function saveNotes() { clearTimeout(notesT); var g = g0(), v = $('#gd-notes').value; if (g && (g.notes || '') !== v) { g.notes = v; ST.save(); } }
  $('#gd-notes').addEventListener('input', function () { clearTimeout(notesT); notesT = setTimeout(saveNotes, 700); });
  $('#gd-notes').addEventListener('change', saveNotes);

  /* ---------- scoreboard & series ---------- */
  function series() { var g = g0(); return g ? (g.series = g.series || { down: 1, sit: 'own', blitz: false }) : (window._tmpSeries = window._tmpSeries || { down: 1, sit: 'own', blitz: false }); }
  function renderBoard() {
    var g = g0(), s = series();
    $('#sc-us').textContent = g ? g.us : 0; $('#sc-them').textContent = g ? g.them : 0;
    $('#sc-them-name').textContent = g ? g.opp.toUpperCase() : 'THEM';
    $('#gd-half').value = String(g ? g.half || 1 : 1);
    var used = g ? !!(g.to || {})[g.half || 1] : false;
    $('#to-dots').innerHTML = '<span class="to-dot' + (used ? ' used' : '') + '" title="Tap to use/restore"></span>';
    var isPat = s.sit === 'pat1' || s.sit === 'pat2';
    $$('#downs button').forEach(function (b) { var d = +b.dataset.down; b.classList.toggle('on', d === s.down && !isPat); b.classList.toggle('last', d === 3); b.disabled = isPat; });
    $('#gd-sit').value = s.sit; $('#gd-blitz').value = s.blitz ? '1' : '0';
    var left = 3 - s.down + 1, pl = left + ' play' + (left > 1 ? 's' : '');
    var hint = {
      own: ORD[s.down] + ' down — ' + pl + ' left to cross midfield.' + (s.down === 3 ? ' Miss it and they take over at their own 5.' : ''),
      nrzmid: ORD[s.down] + ' down inside 5 of midfield — NO-RUN ZONE: pass only. ' + pl + ' left to get there.',
      past: ORD[s.down] + ' down — ' + pl + ' left to score.' + (s.down === 3 ? ' Score or they take over at their own 5.' : ''),
      nrz: ORD[s.down] + ' down inside the 5 — NO-RUN ZONE: pass only, even after a handoff.',
      pat1: '1-point try from the 5 — pass only. Declare it before the snap.',
      pat2: '2-point try from the 10 — run or pass. Declare it before the snap.'
    }[s.sit];
    $('#gd-hint').textContent = hint;
    $('#gd-sub').textContent = isPat ? '' : '· ' + ORD[s.down] + ' down' + (s.blitz ? ' · vs blitz' : '') + (g && g.plan.off.length ? ' · from the ' + g.opp + ' plan' : '');
  }
  $$('#tab-gameday .mini button').forEach(function (b) {
    b.addEventListener('click', function () { var g = g0(); if (!g) { A.toast('Create the game first.'); return; } g[b.dataset.sc] = Math.max(0, g[b.dataset.sc] + +b.dataset.v); ST.save(); });
  });
  $('#gd-half').addEventListener('change', function (e) { var g = g0(); if (g) { g.half = +e.target.value; ST.save(); } });
  $('#to-dots').addEventListener('click', function () { var g = g0(); if (!g) return; g.to = g.to || {}; g.to[g.half || 1] = !g.to[g.half || 1]; ST.save(); });
  $('#downs').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; series().down = +b.dataset.down; persist(); });
  $('#gd-sit').addEventListener('change', function (e) { var s = series(); s.sit = e.target.value; if (s.sit === 'pat1' || s.sit === 'pat2') s.down = 1; persist(); });
  $('#gd-blitz').addEventListener('change', function (e) { series().blitz = e.target.value === '1'; persist(); });
  function persist() { if (g0()) ST.save(); else render(); }

  /* ---------- recommendations ---------- */
  function recommend() {
    var g = g0(), s = series(), out = [];
    var pool = A.offPlays().filter(function (p) { return !p.shared; });
    var planIds = g ? g.plan.off : [];
    pool.forEach(function (p) {
      var tags = p.tags || [], run = A.isRun(p), score = 0, why = [];
      var has = function (t) { return tags.indexOf(t) >= 0; };
      if ((s.sit === 'nrz' || s.sit === 'nrzmid' || s.sit === 'pat1') && run) return;
      if (!A.E.validate(p).legal) return;
      if (planIds.length) { if (planIds.indexOf(p.id) >= 0) { score += 4; why.push('in the plan'); } else score -= 3; }
      if (s.sit === 'own' || s.sit === 'past') {
        if (p.ytg || p.ytm) score -= 3;
        if (s.down === 1) { if (has('deep')) { score += 2; why.push('shot play'); } if (has('trick')) score += 1; if (run) { score += 1; why.push('keeps D honest'); } if (has('intermediate')) score += 1; }
        if (s.down === 2) { if (has('intermediate')) { score += 2; why.push('chunk gain'); } if (run) score += 1; if (has('quick')) score += 1; }
        if (s.down === 3) { if (has('third-down')) { score += 4; why.push('3rd-down call'); } if (has('quick')) { score += 2; why.push('high %'); } if (has('short-yardage')) score += 1; if (has('trick')) score -= 2; if (has('deep')) score -= 1; }
      }
      if (s.sit === 'nrzmid') { if (p.ytg) score -= 3; if (p.cat === 'midfield') { score += 6; why.push('midfield design'); } if (has('quick')) score += 2; if (has('short-yardage')) score += 2; if (has('deep')) score -= 2; }
      if (s.sit === 'nrz') { if (has('red-zone')) { score += 5; why.push('red-zone design'); } if (has('deep')) score -= 3; if (has('quick')) score += 1; }
      if (s.sit === 'pat1') { if (has('pat1')) { score += 6; why.push('1-pt call'); } if (has('red-zone')) score += 3; if (has('quick')) score += 1; if (has('deep')) score -= 3; }
      if (s.sit === 'pat2') { if (has('pat2')) { score += 6; why.push('2-pt call'); } if (has('red-zone')) score += 2; if (has('deep')) score -= 2; }
      if (s.blitz) { if (has('vs-blitz')) { score += 4; why.push('beats the blitz'); } if (has('quick')) score += 2; if (has('rollout')) score += 1; if (has('deep') && !has('trick')) score -= 2; }
      var st = ST.playStats({ side: 'off', opp: g ? g.opp : undefined })[p.id] || ST.playStats({ side: 'off' })[p.id];
      if (st && st.calls >= 2) { var sr = st.ok / st.calls; score += (sr - 0.5) * 4; if (sr >= 0.6) why.push(Math.round(sr * 100) + '% success'); }
      var r = ST.rating(p.id); if (r > 0) { score += 1.5; why.push('coach favorite'); } if (r < 0) score -= 2;
      out.push({ p: p, score: score, why: why.slice(0, 3) });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out.slice(0, 6);
  }
  function renderRecs() {
    $('#gd-recs').innerHTML = recommend().map(function (r) {
      return '<button class="rec" data-id="' + esc(r.p.id) + '"><div class="thumb">' + A.thumb(r.p, [-6, 16]) + '</div><div class="rb"><span class="rank">#' + esc(r.p.num) + '</span><b>' + esc(r.p.name) + '</b>' +
        '<div class="why">' + esc(r.why.join(' · ') || (A.isRun(r.p) ? 'run' : 'pass')) + '</div></div></button>';
    }).join('');
  }
  $('#gd-recs').addEventListener('click', function (e) {
    var b = e.target.closest('.rec'); if (!b) return;
    $('#lg-side').value = 'off'; fillLogSelects(); $('#lg-play').value = b.dataset.id;
    A.toast('Set as the play to log. Tap again to open it.');
    if (b.classList.contains('picked')) A.openPlay(b.dataset.id, 'off');
    $$('#gd-recs .rec').forEach(function (x) { x.classList.toggle('picked', x === b); });
  });

  /* ---------- results log ---------- */
  function fillLogSelects() {
    var side = $('#lg-side').value, g = g0();
    var plan = g ? g.plan[side] : [];
    var planOpts = plan.length ? '<optgroup label="Game plan">' + plan.map(function (id) { return '<option value="' + esc(id) + '">' + esc(A.playNum(id) + ' · ' + A.playName(id)) + '</option>'; }).join('') + '</optgroup>' : '';
    var cur = $('#lg-play').value;
    $('#lg-play').innerHTML = planOpts + optionGroups(side);
    if (cur) $('#lg-play').value = cur;
    if (!$('#lg-play').value && $('#lg-play').options.length) $('#lg-play').selectedIndex = 0;
    $('#lg-vs-wrap').classList.toggle('hidden', side !== 'def');
    $('#lg-vs').innerHTML = '<option value="">Unknown</option>' + optionGroups('off');
    var R = side === 'def' ? ST.DEF_RESULTS : ST.OFF_RESULTS;
    $('#lg-results').innerHTML = R.map(function (r) { return '<button class="res ' + (r.ok ? 'good' : 'bad') + '" data-k="' + r.k + '">' + esc(r.label) + '</button>'; }).join('');
  }
  $('#lg-side').addEventListener('change', fillLogSelects);
  $('#lg-results').addEventListener('click', function (e) {
    var b = e.target.closest('.res'); if (!b) return;
    var g = g0(); if (!g) { A.toast('Create the game first.'); return; }
    var side = $('#lg-side').value, s = series(), k = b.dataset.k;
    var yds = $('#lg-yds').value;
    ST.logPlay({ side: side, play: $('#lg-play').value, vs: side === 'def' ? $('#lg-vs').value : '', down: s.down, sit: s.sit, result: k, yds: yds === '' ? null : +yds });
    $('#lg-yds').value = '';
    if (side === 'off') advance(k);
    else if (k === 'td') { g.them += 6; ST.save(); A.toast('Logged — added 6 to ' + g.opp + '’s score.'); return; }
    A.toast('Logged: ' + A.playName($('#lg-play').value) + ' — ' + ST.resultInfo(side, k).label);
  });
  function advance(k) {
    var s = series(), g = g0();
    if (s.sit === 'pat1' || s.sit === 'pat2') { if (k === 'td') g.us += s.sit === 'pat1' ? 1 : 2; s.sit = 'own'; s.down = 1; ST.save(); return; }
    if (k === 'td') { g.us += 6; s.sit = 'pat1'; s.down = 1; A.toast('Touchdown! Pick the 1- or 2-pt try.'); }
    else if (k === 'first' && (s.sit === 'own' || s.sit === 'nrzmid')) { s.sit = 'past'; s.down = 1; }
    else if (k === 'first') { A.toast('Past midfield there’s no new 1st down — it’s 3 downs to score.'); nextDown(s); }
    else if (k === 'to') { s.sit = 'own'; s.down = 1; }
    else if (k !== 'pen') nextDown(s);
    ST.save();
  }
  function nextDown(s) { if (s.down >= 3) { s.down = 1; s.sit = 'own'; A.toast('Turnover on downs — they start at their own 5.'); } else s.down++; }
  function renderLog() {
    var g = g0();
    var items = g ? g.log.slice(-8).reverse() : [];
    $('#lg-list').innerHTML = items.length ? '<div class="log-head">Recent</div>' + items.map(function (l) {
      var ok = ST.resultInfo(l.side, l.result).ok;
      return '<div class="log-item"><span class="dot ' + (ok ? 'good' : 'bad') + '"></span><span>' + ICON(l.side === 'def' ? 'shield' : 'football') + ' ' + esc(A.playName(l.play)) + '</span><span class="muted">' + ORD[l.down || 1] + ' · ' + esc(ST.resultInfo(l.side, l.result).label) + (l.yds != null ? ' · ' + (l.yds > 0 ? '+' : '') + l.yds : '') + '</span><button class="x" data-del="' + l.id + '">✕</button></div>';
    }).join('') : '<p class="hint">Nothing logged for this game yet.</p>';
  }
  $('#lg-list').addEventListener('click', function (e) {
    var b = e.target.closest('[data-del]'); if (!b) return;
    var g = g0(); if (!g || !confirm('Remove this logged play?')) return;
    g.log = g.log.filter(function (l) { return l.id !== b.dataset.del; }); ST.save();
  });

  /* ---------- sync status & coach tools ---------- */
  function renderSync() {
    var g = g0();
    $('#gd-title').innerHTML = g
      ? '<span>vs</span> ' + esc(g.opp) + ' <small>' + esc(fmtDate(g.date)) + '</small>'
      : '<small>Create a game to build the weekly plan and track results.</small>';
    $('#gd-sync').innerHTML = syncPill();
  }
  /* "Live" / "Offline — N waiting" / "Saving…" — also shown as a small badge in the header on every tab */
  function syncState() {
    var CL = window.B2A_CLOUD;
    if (!A.isLive()) return { kind: 'test' };
    var n = CL.pending || 0, online = navigator.onLine !== false;
    return { kind: !online ? 'offline' : n ? 'saving' : 'live', n: n };
  }
  function syncPill() {
    var s = syncState();
    if (s.kind === 'test') return '<span class="pill warn">Test mode — logins are off and nothing is saved</span>';
    if (s.kind === 'offline') return '<span class="pill warn">No signal — ' + (s.n ? s.n + ' change' + (s.n > 1 ? 's' : '') + ' saved on this phone, ' : 'changes are saved on this phone and ') + 'will sync when you’re back online</span>';
    if (s.kind === 'saving') return '<span class="pill">Saving…</span>';
    return '<span class="pill ok">' + ICON('check') + ' Live — changes sync to the whole team instantly</span>';
  }
  A.onSyncChange = function () {
    var s = syncState(), b = $('#sync-badge');
    b.className = 'sync-badge ' + (s.kind === 'offline' || s.kind === 'saving' ? s.kind : 'hidden');
    b.textContent = s.kind === 'offline' ? 'Offline' + (s.n ? ' · ' + s.n + ' to sync' : '') : s.kind === 'saving' ? 'Saving…' : '';
    $('#gd-sync').innerHTML = syncPill();
  };
  $('#ck-download').addEventListener('click', ST.download);
  $('#ck-delgame').addEventListener('click', function () {
    var g = g0();
    if (g && confirm('Delete the game vs ' + g.opp + ' and its log?')) ST.deleteGame(g.id);
  });

  function render() {
    renderGameSelect(); renderPlan(); renderBoard(); renderRecs(); fillLogSelects(); renderLog(); renderSync();
  }
  A.tabHooks.gameday = render;
  ST.on(function () { if ($('#tab-gameday').classList.contains('active')) render(); else renderSync(); });
})();
