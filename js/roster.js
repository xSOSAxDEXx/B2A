/* Roster: players, strengths/weaknesses, and who plays each spot on every play in this week's game plan.
   Each spot's demands are read from the play itself (deep target? thrower? ball carrier? man/zone/blitz?),
   then compared with the player's strengths and weaknesses to warn the coach about bad fits. */
(function () {
  'use strict';
  var A = window.APP, E = A.E, ST = A.ST, $ = A.$, $$ = A.$$, esc = A.esc;

  var TRAITS = [
    ['speed', 'Speed'], ['hands', 'Hands'], ['routes', 'Route running'], ['quick', 'Short-area quickness'], ['deep', 'Tracking deep balls'],
    ['elusive', 'Elusive after catch'], ['height', 'Height / jump ball'], ['arm', 'Arm strength'], ['accuracy', 'Accuracy'], ['decision', 'Decision making'],
    ['snapping', 'Snapping'], ['blitzing', 'Blitzing'], ['man', 'Man coverage'], ['zone', 'Zone awareness'], ['flags', 'Flag pulling']
  ];
  var TL = {}; TRAITS.forEach(function (t) { TL[t[0]] = t[1]; });
  var OFF_POS = [['QB', 'Quarterback'], ['C', 'Center'], ['X', 'X receiver'], ['Y', 'Y receiver / back'], ['Z', 'Z receiver'], ['WR', 'Any receiver']];
  var DEF_POS = [['B', 'Blitzer'], ['CB', 'Corner'], ['M', 'Middle / linebacker'], ['S', 'Safety'], ['ANY', 'Anywhere']];

  function roster() { return ST.S.data.roster; }
  function player(id) { return roster().filter(function (p) { return p.id === id; })[0]; }
  function game() { return ST.game(); }

  /* ---------- what each spot demands ---------- */
  function offNeeds(play, role) {
    var sim = E.buildSim(play), P = sim.P, out = [];
    function need(k, why) { if (!out.some(function (n) { return n.k === k; })) out.push({ k: k, why: why }); }
    var pass = P.events.filter(function (e) { return e.type === 'pass'; })[0];
    var run = !pass;
    var gets = P.events.filter(function (e) { return (e.type === 'handoff' || e.type === 'pitch') && e.to === role; });
    if (role === 'C') need('snapping', 'snaps every play');
    if (pass && pass.from === role) {
      need('accuracy', 'throws the pass');
      if (pass.catchPt[1] >= 12 || (P.tags || []).indexOf('deep') >= 0) need('arm', 'deep throw');
      if (role === 'QB') need('decision', 'reads the progression');
      else need('arm', 'throws after the handoff');
    }
    if (role === 'QB' && pass && pass.from === 'QB' && pass.t < 1.1) need('decision', 'quick-game timing');
    if (pass && pass.to === role) {
      need('hands', 'designed target');
      if (pass.catchPt[1] >= 12) { need('deep', 'deep catch at ' + Math.round(pass.catchPt[1]) + ' yds'); need('speed', 'deep route'); }
      else if (Math.abs(pass.catchPt[0] - (P.players[role].start[0])) > 6) need('quick', 'catch on the move across the field');
      else need('routes', 'timing route');
      if (P.ytg != null) need('height', 'red-zone catch');
    }
    if (gets.length && run && role !== 'QB') { need('speed', 'ball carrier'); need('elusive', 'run after the handoff'); }
    if (gets.length && role === 'QB' && run) need('speed', 'runs after getting it back');
    var pl = P.players[role], pts = pl.route.pts;
    if (role !== 'QB' && pts.length && (!pass || pass.to !== role) && pts[pts.length - 1][1] >= 14) need('speed', 'clear-out route — has to run off the deep defender');
    return out;
  }
  function defNeeds(def, label) {
    var d = def.defenders.filter(function (x) { return x.id === label; })[0], out = [];
    if (!d) return out;
    if (d.job === 'blitz') { out.push({ k: 'blitzing', why: 'blitzer' }); out.push({ k: 'speed', why: 'gets home before the throw' }); }
    else if (d.job === 'man') { out.push({ k: 'man', why: 'man coverage on ' + A.D.onText(d.on) }); out.push({ k: 'speed', why: 'stays with his man' }); if (d.on === 'C') out.push({ k: 'quick', why: 'center’s quick release' }); }
    else if (d.job === 'zone') {
      out.push({ k: 'zone', why: (d.zone || 'zone') + ' zone' });
      if (d.drop[1] >= 10) out.push({ k: 'speed', why: 'deep zone — nobody behind him' }); else out.push({ k: 'flags', why: 'short zone — pulls flags after the catch' });
    }
    else if (d.job === 'spy') out.push({ k: 'quick', why: 'mirrors the QB' });
    return out;
  }
  function defPosOf(label, def) {
    var d = def.defenders.filter(function (x) { return x.id === label; })[0]; if (!d) return 'ANY';
    if (d.job === 'blitz') return 'B';
    if (/^(M|RB)$/.test(label)) return 'M';
    if (d.job === 'zone' && d.drop[1] >= 10) return 'S';
    return 'CB';
  }

  /* ---------- fit ---------- */
  function fit(p, needs, side, role, play) {
    var res = { score: 0, warns: [], goods: [] };
    if (!p) return res;
    var s = p.strengths || [], w = p.weaknesses || [];
    needs.forEach(function (n) {
      if (w.indexOf(n.k) >= 0) { res.score -= 3; res.warns.push(TL[n.k] + ' is a weakness — ' + n.why); }
      else if (s.indexOf(n.k) >= 0) { res.score += 2; res.goods.push(TL[n.k]); }
    });
    function offOk(pos) { return pos === role || (pos === 'WR' && /^[XYZ]$/.test(role)) || (/^[XYZ]$/.test(pos) && /^[XYZ]$/.test(role)); }
    if (side === 'off') {
      var prim = p.offPos, alts = p.offAlt || [];
      if (!prim || prim === role || (prim === 'WR' && /^[XYZ]$/.test(role))) res.score += 1;
      else if (offOk(prim)) res.score += 0.6;
      else if (alts.some(offOk)) { res.score += 0.3; res.goods.push('also plays ' + role); }
      else { res.score -= (role === 'QB' || role === 'C' || prim === 'QB' || prim === 'C') ? 3 : 1; res.warns.push('Out of position — plays ' + [prim].concat(alts).join(' / ')); }
    } else {
      var want = defPosOf(role, play), dp = p.defPos, dalts = p.defAlt || [];
      if (!dp || dp === 'ANY' || dp === want) res.score += 1;
      else if (dalts.indexOf(want) >= 0) { res.score += 0.3; res.goods.push('also plays ' + want); }
      else { res.score -= want === 'B' || dp === 'B' ? 2 : 1; res.warns.push('Out of position — plays ' + [dp].concat(dalts).join(' / ') + ', this spot is ' + want); }
    }
    return res;
  }
  function rolesOf(side, play) { return side === 'off' ? ['QB', 'C', 'X', 'Y', 'Z'] : play.defenders.map(function (d) { return d.id; }); }
  function needsOf(side, play, role) { return side === 'off' ? offNeeds(play, role) : defNeeds(play, role); }

  /* all warnings for one plan play (used here, in Game Day and in the Plays viewer) */
  function playReport(side, id) {
    var g = game(), play = side === 'off' ? A.findOff(id) : A.findDef(id);
    if (!g || !play) return null;
    var asg = (g.assign[side] || {})[id] || {}, rows = [], seen = {};
    rolesOf(side, play).forEach(function (role) {
      var pid = asg[role], p = pid ? player(pid) : null, needs = needsOf(side, play, role), f = fit(p, needs, side, role, play);
      if (p) { if (seen[pid]) f.warns.unshift(p.name + ' is also at ' + seen[pid]); seen[pid] = role; }
      rows.push({ role: role, p: p, needs: needs, fit: f });
    });
    return { play: play, rows: rows, warnCount: rows.reduce(function (n, r) { return n + r.fit.warns.length; }, 0), open: rows.filter(function (r) { return !r.p; }).length };
  }

  /* ---------- auto-assign ---------- */
  function autoAssign(side, id) {
    var g = game(), play = side === 'off' ? A.findOff(id) : A.findDef(id); if (!g || !play || !roster().length) return;
    var roles = rolesOf(side, play), used = {}, out = {};
    // fill the hardest spots first (QB, C, blitzers, targets)
    roles = roles.slice().sort(function (a, b) { return needsOf(side, play, b).length - needsOf(side, play, a).length + (a === 'QB' ? -5 : 0) - (b === 'QB' ? -5 : 0); });
    roles.forEach(function (role) {
      var needs = needsOf(side, play, role), best = null, bs = -Infinity;
      roster().forEach(function (p) { if (used[p.id]) return; var sc = fit(p, needs, side, role, play).score; if (sc > bs) { bs = sc; best = p; } });
      if (best) { out[role] = best.id; used[best.id] = 1; }
    });
    g.assign[side][id] = out;
  }

  /* ---------- roster UI ---------- */
  var editing = null;
  function chipPicker(name, sel) {
    return '<div class="trait-picks" data-name="' + name + '">' + TRAITS.map(function (t) { return '<button type="button" class="chip' + (sel.indexOf(t[0]) >= 0 ? ' on' : '') + '" data-k="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>';
  }
  function openForm(p) {
    editing = p ? JSON.parse(JSON.stringify(p)) : { id: null, name: '', number: '', offPos: 'WR', defPos: 'CB', offAlt: [], defAlt: [], strengths: [], weaknesses: [], notes: '' };
    editing.offAlt = editing.offAlt || []; editing.defAlt = editing.defAlt || [];
    var f = $('#ro-form'); f.classList.remove('hidden');
    f.innerHTML = '<div class="dd-row"><label class="dd grow"><span>Name</span><input id="rf-name" value="' + esc(editing.name) + '" placeholder="Player name"></label>' +
      '<label class="dd small-in"><span>Number</span><input id="rf-num" type="number" min="0" max="99" value="' + esc(editing.number) + '"></label></div>' +
      '<div class="dd-row"><label class="dd"><span>Primary offense</span><select id="rf-off">' + OFF_POS.map(function (o) { return '<option value="' + o[0] + '"' + (editing.offPos === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
      '<label class="dd"><span>Primary defense</span><select id="rf-def">' + DEF_POS.map(function (o) { return '<option value="' + o[0] + '"' + (editing.defPos === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label></div>' +
      '<div class="alt-row"><div><div class="tr-label">Also plays · offense</div><div class="alt-picks" data-name="offAlt"></div></div><div><div class="tr-label">Also plays · defense</div><div class="alt-picks" data-name="defAlt"></div></div></div>' +
      '<div class="tr-label good">Strengths</div>' + chipPicker('strengths', editing.strengths) +
      '<div class="tr-label bad">Weaknesses</div>' + chipPicker('weaknesses', editing.weaknesses) +
      '<label class="dd"><span>Notes</span><input id="rf-notes" value="' + esc(editing.notes || '') + '" placeholder="Optional"></label>' +
      '<div class="series-actions"><button class="btn primary" id="rf-save">Save player</button><button class="btn ghost" id="rf-cancel">Cancel</button>' + (editing.id ? '<button class="btn ghost danger" id="rf-del">Remove</button>' : '') + '</div>';
    renderAlts();
    $('#rf-off').addEventListener('change', function (e) { editing.offPos = e.target.value; editing.offAlt = editing.offAlt.filter(function (x) { return x !== editing.offPos; }); renderAlts(); });
    $('#rf-def').addEventListener('change', function (e) { editing.defPos = e.target.value; editing.defAlt = editing.defAlt.filter(function (x) { return x !== editing.defPos; }); renderAlts(); });
    $('#rf-name').focus();
  }
  var OFF_ALT = [['QB', 'QB'], ['C', 'Center'], ['X', 'X'], ['Y', 'Y'], ['Z', 'Z']], DEF_ALT = [['B', 'Blitzer'], ['CB', 'Corner'], ['M', 'Middle'], ['S', 'Safety']];
  function renderAlts() {
    editing.offAlt = editing.offAlt || []; editing.defAlt = editing.defAlt || [];
    var offPrim = editing.offPos === 'WR' ? ['X', 'Y', 'Z'] : [editing.offPos];
    $('.alt-picks[data-name="offAlt"]').innerHTML = OFF_ALT.filter(function (o) { return offPrim.indexOf(o[0]) < 0; }).map(function (o) { return '<button type="button" class="chip' + (editing.offAlt.indexOf(o[0]) >= 0 ? ' on' : '') + '" data-k="' + o[0] + '">' + o[1] + '</button>'; }).join('');
    $('.alt-picks[data-name="defAlt"]').innerHTML = editing.defPos === 'ANY' ? '<span class="muted">Plays anywhere</span>' : DEF_ALT.filter(function (o) { return o[0] !== editing.defPos; }).map(function (o) { return '<button type="button" class="chip' + (editing.defAlt.indexOf(o[0]) >= 0 ? ' on' : '') + '" data-k="' + o[0] + '">' + o[1] + '</button>'; }).join('');
  }
  $('#ro-add').addEventListener('click', function () { openForm(null); });
  $('#ro-form').addEventListener('click', function (e) {
    var ac = e.target.closest('.alt-picks .chip');
    if (ac) { var arr2 = editing[ac.parentNode.dataset.name], i2 = arr2.indexOf(ac.dataset.k); if (i2 >= 0) arr2.splice(i2, 1); else arr2.push(ac.dataset.k); ac.classList.toggle('on', i2 < 0); return; }
    var c = e.target.closest('.trait-picks .chip');
    if (c) {
      var name = c.parentNode.dataset.name, other = name === 'strengths' ? 'weaknesses' : 'strengths', k = c.dataset.k;
      var arr = editing[name], i = arr.indexOf(k);
      if (i >= 0) arr.splice(i, 1); else { arr.push(k); var j = editing[other].indexOf(k); if (j >= 0) { editing[other].splice(j, 1); var oc = $('.trait-picks[data-name="' + other + '"] [data-k="' + k + '"]'); if (oc) oc.classList.remove('on'); } }
      c.classList.toggle('on', i < 0); return;
    }
    if (e.target.id === 'rf-cancel') { $('#ro-form').classList.add('hidden'); editing = null; return; }
    if (e.target.id === 'rf-del') {
      if (!confirm('Remove ' + editing.name + ' from the roster? Their assignments are cleared too.')) return;
      ST.S.data.roster = roster().filter(function (p) { return p.id !== editing.id; });
      ST.S.data.games.forEach(function (g) { ['off', 'def'].forEach(function (s) { Object.keys(g.assign[s] || {}).forEach(function (pid) { var a = g.assign[s][pid]; Object.keys(a).forEach(function (r) { if (a[r] === editing.id) delete a[r]; }); }); }); });
      $('#ro-form').classList.add('hidden'); editing = null; ST.save(); return;
    }
    if (e.target.id === 'rf-save') {
      editing.name = $('#rf-name').value.trim(); if (!editing.name) { A.toast('Add a name.'); return; }
      editing.number = $('#rf-num').value; editing.offPos = $('#rf-off').value; editing.defPos = $('#rf-def').value; editing.notes = $('#rf-notes').value.trim();
      if (editing.id) ST.S.data.roster = roster().map(function (p) { return p.id === editing.id ? editing : p; });
      else { editing.id = ST.uid('p'); roster().push(editing); }
      $('#ro-form').classList.add('hidden'); A.toast(editing.name + ' saved. Publish from Game Day to share the roster.'); editing = null; ST.save();
    }
  });
  function renderRoster() {
    var r = roster().slice().sort(function (a, b) { return (+a.number || 999) - (+b.number || 999); });
    $('#ro-count').textContent = r.length ? '· ' + r.length + ' players' : '';
    $('#ro-list').innerHTML = r.length ? r.map(function (p) {
      return '<button class="ro-card" data-id="' + p.id + '"><span class="ro-num">' + esc(p.number || '–') + '</span><div class="ro-body"><b>' + esc(p.name) + '</b>' +
        '<span class="muted"><b class="pos-p">' + esc(p.offPos || '—') + '</b>' + ((p.offAlt || []).length ? ' +' + esc(p.offAlt.join(' ')) : '') + ' · <b class="pos-p">' + esc(p.defPos || '—') + '</b>' + ((p.defAlt || []).length ? ' +' + esc(p.defAlt.join(' ')) : '') + (p.notes ? ' · ' + esc(p.notes) : '') + '</span><div class="tagrow">' +
        (p.strengths || []).map(function (k) { return '<span class="tag tr-good">' + esc(TL[k]) + '</span>'; }).join('') +
        (p.weaknesses || []).map(function (k) { return '<span class="tag tr-bad">' + esc(TL[k]) + '</span>'; }).join('') + '</div></div></button>';
    }).join('') : '<p class="hint">No players yet. Add the team so you can assign spots on each play.</p>';
  }
  $('#ro-list').addEventListener('click', function (e) {
    var c = e.target.closest('.ro-card'); if (!c) return;
    var CL = window.B2A_CLOUD;
    if (CL && CL.enabled && !CL.can('edit') && !(CL.member && CL.member.playerId === c.dataset.id)) { A.toast('You can only edit your own profile.'); return; }
    openForm(player(c.dataset.id));
  });

  /* ---------- team access (cloud mode, coach only) ---------- */
  var ROLE_LABEL = { coach: 'Coach', editor: 'Editor', player: 'Player' };
  function renderAccess() {
    var CL = window.B2A_CLOUD; if (!CL || !CL.enabled || CL.role !== 'coach') return;
    var opts = function (cur) { return '<option value="">— not linked —</option>' + roster().map(function (p) { return '<option value="' + p.id + '"' + (p.id === cur ? ' selected' : '') + '>' + esc((p.number ? '#' + p.number + ' ' : '') + p.name) + '</option>'; }).join(''); };
    $('#ac-player').innerHTML = opts('');
    var me = CL.user.email.toLowerCase();
    $('#ac-list').innerHTML = (CL.members || []).slice().sort(function (a, b) { return (a.role === 'coach' ? 0 : a.role === 'editor' ? 1 : 2) - (b.role === 'coach' ? 0 : b.role === 'editor' ? 1 : 2) || a.email.localeCompare(b.email); }).map(function (m) {
      return '<div class="ac-row" data-email="' + esc(m.email) + '"><div class="ac-who"><b>' + esc(m.name || m.email.split('@')[0]) + '</b><span class="muted">' + esc(m.email) + (m.email === me ? ' (you)' : '') + '</span></div>' +
        '<select data-f="role"' + (m.email === me ? ' disabled' : '') + '>' + ['player', 'editor', 'coach'].map(function (r) { return '<option value="' + r + '"' + (m.role === r ? ' selected' : '') + '>' + ROLE_LABEL[r] + '</option>'; }).join('') + '</select>' +
        '<select data-f="playerId">' + opts(m.playerId) + '</select>' +
        (m.email === me ? '<span></span>' : '<button class="x" data-rm="1" title="Remove access">✕</button>') + '</div>';
    }).join('') || '<p class="hint">Only you so far.</p>';
  }
  $('#ac-add').addEventListener('click', function () {
    var CL = window.B2A_CLOUD;
    CL.addMember($('#ac-email').value, $('#ac-role').value, $('#ac-player').value).then(function () {
      A.toast('Added. They can sign in at the site with that email now.'); $('#ac-email').value = '';
    }).catch(function (e) { A.toast(e.message || 'Couldn’t add that person.'); });
  });
  $('#ac-list').addEventListener('change', function (e) {
    var row = e.target.closest('.ac-row'); if (!row) return; var f = {}; f[e.target.dataset.f] = e.target.value || null;
    window.B2A_CLOUD.updateMember(row.dataset.email, f).then(function () { A.toast('Updated.'); }).catch(function (er) { A.toast(er.message); });
  });
  $('#ac-list').addEventListener('click', function (e) {
    var b = e.target.closest('[data-rm]'); if (!b) return; var em = b.closest('.ac-row').dataset.email;
    if (!confirm('Remove ' + em + '’s access? They’ll be signed out of the team data immediately.')) return;
    window.B2A_CLOUD.removeMember(em).then(function () { A.toast('Access removed.'); });
  });
  A.refreshAccess = function () { if ($('#tab-roster').classList.contains('active')) renderAccess(); };

  /* ---------- assignments UI ---------- */
  function playBlock(side, id) {
    var rep = playReport(side, id); if (!rep) return '';
    var play = rep.play;
    var opts = function (role, cur) {
      var needs = needsOf(side, play, role);
      var ranked = roster().map(function (p) { return { p: p, f: fit(p, needs, side, role, play) }; }).sort(function (a, b) { return b.f.score - a.f.score; });
      return '<option value="">— open —</option>' + ranked.map(function (x) {
        var tag = x.f.warns.length ? ' ⚠' : x.f.goods.length ? ' ✓' : '';
        return '<option value="' + x.p.id + '"' + (x.p.id === cur ? ' selected' : '') + '>' + esc((x.p.number ? '#' + x.p.number + ' ' : '') + x.p.name) + tag + '</option>';
      }).join('');
    };
    return '<div class="as-play" data-side="' + side + '" data-id="' + esc(id) + '"><div class="as-head"><div class="thumb">' + A.thumb(play, [-6, 16]) + '</div><div><b><span class="num">' + esc(play.num) + '</span>' + esc(play.name) + '</b>' +
      '<span class="muted">' + (side === 'off' ? 'Offense' : 'Defense · ' + esc(play.front)) + '</span>' +
      (rep.warnCount ? '<span class="pill warn">' + ICON('warn') + ' ' + rep.warnCount + ' warning' + (rep.warnCount > 1 ? 's' : '') + '</span>' : rep.open ? '<span class="pill">' + rep.open + ' open</span>' : '<span class="pill ok">' + ICON('check') + ' All set</span>') + '</div>' +
      '<button class="btn small ghost" data-auto="1">Auto</button></div><div class="as-rows">' +
      rep.rows.map(function (r) {
        return '<div class="as-row' + (r.fit.warns.length ? ' has-warn' : '') + '"><span class="as-role">' + esc(r.role) + '</span><div class="as-mid"><select data-role="' + esc(r.role) + '">' + opts(r.role, r.p && r.p.id) + '</select>' +
          '<div class="as-needs">Needs: ' + (r.needs.length ? r.needs.map(function (n) { return '<span title="' + esc(n.why) + '">' + esc(TL[n.k]) + '</span>'; }).join(' · ') : '—') + '</div>' +
          r.fit.warns.map(function (w) { return '<div class="as-w">' + ICON('warn') + ' ' + esc(w) + '</div>'; }).join('') +
          (r.p && !r.fit.warns.length && r.fit.goods.length ? '<div class="as-g">' + ICON('check') + ' Strong fit: ' + esc(r.fit.goods.join(', ')) + '</div>' : '') + '</div></div>';
      }).join('') + '</div></div>';
  }
  function renderAssign() {
    var g = game();
    if (!g) { $('#as-sub').textContent = ''; $('#as-list').innerHTML = '<p class="hint">Create this week’s game in Game Day and add plays to the plan first.</p>'; $('#as-warn-sum').innerHTML = ''; return; }
    $('#as-sub').textContent = '· vs ' + g.opp;
    if (!roster().length) { $('#as-list').innerHTML = '<p class="hint">Add players to the roster to start assigning.</p>'; $('#as-warn-sum').innerHTML = ''; return; }
    var html = '', warns = 0, open = 0;
    [['off', 'Offense'], ['def', 'Defense']].forEach(function (s) {
      if (!g.plan[s[0]].length) return;
      html += '<div class="group-label">' + s[1] + '</div>' + g.plan[s[0]].map(function (id) { var r = playReport(s[0], id); if (r) { warns += r.warnCount; open += r.open; } return playBlock(s[0], id); }).join('');
    });
    $('#as-list').innerHTML = html || '<p class="hint">The game plan is empty — add plays in Game Day.</p>';
    $('#as-warn-sum').innerHTML = html ? (warns ? '<div class="as-sum warn">' + ICON('warn') + ' ' + warns + ' fit warning' + (warns > 1 ? 's' : '') + (open ? ' · ' + open + ' open spots' : '') + '</div>' : open ? '<div class="as-sum">' + open + ' open spots</div>' : '<div class="as-sum ok">' + ICON('check') + ' Every spot filled with no warnings</div>') : '';
  }
  $('#as-list').addEventListener('change', function (e) {
    var sel = e.target.closest('select[data-role]'); if (!sel) return;
    var blk = sel.closest('.as-play'), g = game(), side = blk.dataset.side, id = blk.dataset.id;
    var a = g.assign[side][id] = g.assign[side][id] || {};
    if (sel.value) a[sel.dataset.role] = sel.value; else delete a[sel.dataset.role];
    ST.save();
  });
  $('#as-list').addEventListener('click', function (e) {
    var b = e.target.closest('[data-auto]'); if (!b) return;
    var blk = b.closest('.as-play'); autoAssign(blk.dataset.side, blk.dataset.id); ST.save();
  });
  $('#as-auto').addEventListener('click', function () {
    var g = game(); if (!g || !roster().length) { A.toast('Add players and a game plan first.'); return; }
    var has = ['off', 'def'].some(function (s) { return g.plan[s].some(function (id) { return Object.keys((g.assign[s] || {})[id] || {}).length; }); });
    if (has && !confirm('Replace the current assignments with the best fits?')) return;
    ['off', 'def'].forEach(function (s) { g.plan[s].forEach(function (id) { autoAssign(s, id); }); });
    ST.save(); A.toast('Assigned the best fit for every spot.');
  });

  function render() { renderRoster(); renderAssign(); renderAccess(); }
  A.tabHooks.roster = render;
  ST.on(function () { if ($('#tab-roster').classList.contains('active')) render(); });

  /* card for the Plays viewer */
  A.assignmentCardHTML = function (id, side) {
    if (!A.inPlan(id, side) || !roster().length) return '';
    var rep = playReport(side, id); if (!rep) return '';
    return '<div class="card"><h3>' + ICON('users') + ' Who’s playing it</h3><ul class="as-mini">' + rep.rows.map(function (r) {
      return '<li class="' + (r.fit.warns.length ? 'w' : '') + '"><b>' + esc(r.role) + '</b><span>' + (r.p ? esc((r.p.number ? '#' + r.p.number + ' ' : '') + r.p.name) : '<i class="muted">open</i>') + '</span>' + (r.fit.warns.length ? '<em>' + ICON('warn') + ' ' + esc(r.fit.warns[0]) + '</em>' : '') + '</li>';
    }).join('') + '</ul><button class="btn small" onclick="APP.showTab(\'roster\')">Edit assignments</button></div>';
  };
  A.playReport = playReport;
  A.ROSTER = { TRAITS: TRAITS, offNeeds: offNeeds, defNeeds: defNeeds, fit: fit };
})();
