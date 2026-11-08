/* Opponent scouting: the teams we play, their players, and how each compares to the league average
   (speed for everyone, arm strength for QBs). Pick an opponent above the field in the Plays tab and the
   simulation runs at their speed: a faster safety closes sooner, a strong-armed QB fits the ball in sooner.
   Stored per opponent in Firebase (teams/b2a/scout/{id}) — see cloud.js. */
(function () {
  'use strict';
  var A = window.APP, ST = A.ST, E = A.E, D = A.D, $ = A.$, esc = A.esc;

  var SPEED = [[-2, 'Much slower'], [-1, 'Slower'], [0, 'Average'], [1, 'Faster'], [2, 'Much faster']];
  var ARM = [[-2, 'Much weaker arm'], [-1, 'Weaker arm'], [0, 'Average arm'], [1, 'Stronger arm'], [2, 'Much stronger arm']];
  var OFF = [['', 'Offense: —'], ['QB', 'Offense: QB'], ['C', 'Offense: Center'], ['WR', 'Offense: Receiver'], ['X', 'Offense: X'], ['Y', 'Offense: Y'], ['Z', 'Offense: Z']];
  var DEF = [['', 'Defense: —'], ['B', 'Defense: Blitz'], ['CB', 'Defense: Corner'], ['M', 'Defense: Middle'], ['S', 'Defense: Safety']];
  var DEF_GROUP = { B: 'Blitzer', CB: 'Corners', M: 'Middle', S: 'Safeties' };
  var SPD_STEP = 0.07, ARM_STEP = 0.10;   // one step = 7% running speed / 10% ball speed

  function list() { return ST.S.data.scout || (ST.S.data.scout = []); }
  function find(id) { return list().filter(function (o) { return o.id === id; })[0] || null; }
  function norm(n) { return (n || '').trim().toLowerCase(); }
  function forName(name) { return list().filter(function (o) { return norm(o.name) === norm(name); })[0] || null; }
  function canEdit() { var CL = window.B2A_CLOUD; return !(CL && CL.enabled) || CL.can('edit'); }
  function storable() { var CL = window.B2A_CLOUD; return !(CL && CL.enabled) || CL.scoutReady() === true; }

  /* ---------- ratings → simulation ---------- */
  function avg(xs) { return xs.length ? xs.reduce(function (a, b) { return a + b; }, 0) / xs.length : 0; }
  function speedOf(players, test) { return avg(players.filter(test).map(function (p) { return +p.speed || 0; })); }
  function profile(o) {
    var pl = (o && o.players) || [], def = {}, off = {};
    Object.keys(DEF_GROUP).forEach(function (k) { def[k] = speedOf(pl, function (p) { return p.def === k; }); });
    off.QB = speedOf(pl, function (p) { return p.off === 'QB'; });
    off.C = speedOf(pl, function (p) { return p.off === 'C'; });
    var wr = speedOf(pl, function (p) { return /^(WR|X|Y|Z)$/.test(p.off); });
    ['X', 'Y', 'Z'].forEach(function (r) {   // a player listed at X/Y/Z sets that spot; otherwise their receivers' average
      var own = pl.filter(function (p) { return p.off === r; });
      off[r] = own.length ? speedOf(own, function () { return true; }) : wr;
    });
    var arm = avg(pl.filter(function (p) { return p.off === 'QB'; }).map(function (p) { return +p.arm || 0; }));
    return { def: def, off: off, arm: arm };
  }
  // their defense: each defender runs at the speed of their players at that position
  function tuneDef(def, id) {
    var o = find(id); if (!def || !o || !(o.players || []).length) return def;
    var pr = profile(o), d = E.clone(def);
    d.defenders.forEach(function (x) { x.spd = 1 + SPD_STEP * (pr.def[D.posOf(x)] || 0); });
    return d;
  }
  // their offense: receivers' route speed and the QB's arm
  function tuneOff(play, id) {
    var o = find(id); if (!play || !o || !(o.players || []).length) return play;
    var pr = profile(o), p = E.normalizePlay(play);
    E.ROLES.forEach(function (r) { p.players[r].route.speed *= 1 + SPD_STEP * (pr.off[r] || 0); });
    p.arm = 1 + ARM_STEP * pr.arm;
    return p;
  }

  /* ---------- words ---------- */
  function word(scale, v) { var r = Math.max(-2, Math.min(2, Math.round(v))); return scale.filter(function (s) { return s[0] === r; })[0][1]; }
  function summary(o, side) {   // "Safeties faster · QB much stronger arm"
    if (!o || !(o.players || []).length) return '';
    var pr = profile(o), bits = [];
    if (side !== 'off') Object.keys(DEF_GROUP).forEach(function (k) { if (Math.abs(pr.def[k]) >= 0.5) bits.push(DEF_GROUP[k] + ' ' + word(SPEED, pr.def[k]).toLowerCase()); });
    if (side !== 'def') {
      if (Math.abs(pr.arm) >= 0.5) bits.push('QB ' + word(ARM, pr.arm).toLowerCase());
      if (Math.abs(pr.off.QB) >= 0.5) bits.push('QB ' + word(SPEED, pr.off.QB).toLowerCase());
      var rec = avg(['X', 'Y', 'Z'].map(function (r) { return pr.off[r]; }));
      if (Math.abs(rec) >= 0.5) bits.push('receivers ' + word(SPEED, rec).toLowerCase());
    }
    return bits.join(' · ') || 'about league average';
  }

  /* ---------- Roster tab: opponents card ---------- */
  var editing = null;
  function allNames() {   // every team we've played or scouted, this week's opponent first
    var g = A.activeGame(), seen = {}, out = [];
    function add(n) { var o = forName(n); n = o ? o.name : n; if (n && !seen[norm(n)]) { seen[norm(n)] = 1; out.push(n); } }
    if (g) add(g.opp);
    list().map(function (o) { return o.name; }).concat(ST.S.data.opponents || []).sort(function (a, b) { return a.localeCompare(b); }).forEach(add);
    return out;
  }
  function renderList() {
    var g = A.activeGame(), names = allNames();
    var CL = window.B2A_CLOUD, ready = storable();
    $('#op-warn').innerHTML = ready ? '' : (CL && CL.scoutReady() === false
      ? '<p class="hint warn-text">' + (CL.role === 'coach' ? 'To save opponent rosters, publish the updated <b>firestore.rules</b> in the Firebase console (Firestore → Rules).' : 'Opponent rosters can’t be saved until the coach publishes the updated rules.') + '</p>'
      : '<p class="hint">Checking…</p>');
    $('#op-list').innerHTML = names.length ? names.map(function (n) {
      var o = forName(n), cnt = o ? (o.players || []).length : 0;
      return '<button class="ro-card op-card" data-name="' + esc(n) + '"><span class="ro-num op-ic">' + ICON('users') + '</span><div class="ro-body"><b>' + esc(n) +
        (g && norm(g.opp) === norm(n) ? ' <span class="pill">This week</span>' : '') + '</b>' +
        '<span class="muted">' + (cnt ? cnt + ' player' + (cnt > 1 ? 's' : '') + ' · ' + esc(summary(o)) : 'No roster yet' + (canEdit() && ready ? ' — tap to add' : '')) + '</span>' +
        (o && o.notes ? '<span class="pos-note">' + esc(o.notes) + '</span>' : '') + '</div></button>';
    }).join('') : '<p class="hint">No opponents yet. Add one here, or create a game in Game Day.</p>';
  }
  function opts(scale, cur, prefix) {
    return scale.map(function (s) { return '<option value="' + s[0] + '"' + (String(s[0]) === String(cur) ? ' selected' : '') + '>' + esc((prefix || '') + (prefix ? s[1].toLowerCase() : s[1])) + '</option>'; }).join('');
  }
  function playerRow(p, ro) {
    var dis = ro ? ' disabled' : '';
    return '<div class="op-prow" data-id="' + esc(p.id) + '"><div class="op-top">' +
      '<input data-f="name" type="text" maxlength="40" placeholder="Name" value="' + esc(p.name || '') + '"' + dis + '>' +
      '<input data-f="number" type="number" min="0" max="99" placeholder="#" value="' + esc(p.number || '') + '"' + dis + '>' +
      (ro ? '<span></span>' : '<button type="button" class="x" data-rm="1" title="Remove player">✕</button>') + '</div><div class="op-sel">' +
      '<select data-f="off" aria-label="Offense position"' + dis + '>' + opts(OFF, p.off || '') + '</select>' +
      '<select data-f="def" aria-label="Defense position"' + dis + '>' + opts(DEF, p.def || '') + '</select>' +
      '<select data-f="speed" aria-label="Speed"' + dis + '>' + opts(SPEED, p.speed || 0, 'Speed: ') + '</select>' +
      '<select data-f="arm" aria-label="Arm" class="op-arm' + (p.off === 'QB' ? '' : ' hidden') + '"' + dis + '>' + opts(ARM.map(function (a) { return [a[0], a[1].replace(/ arm$/, '')]; }), p.arm || 0, 'Arm: ') + '</select>' +
      '</div></div>';
  }
  function openForm(name) {
    var o = forName(name), ro = !canEdit() || !storable();
    editing = o ? E.clone(o) : { id: null, name: name || '', notes: '', players: [] };
    editing.players = editing.players || [];
    var f = $('#op-form'); f.classList.remove('hidden');
    f.innerHTML = '<div class="dd-row"><label class="dd grow"><span>Team</span><input id="of-name" maxlength="60" placeholder="Opponent name" value="' + esc(editing.name) + '"' + (ro ? ' disabled' : '') + '></label></div>' +
      '<label class="dd"><span>Notes</span><input id="of-notes" maxlength="300" placeholder="What stands out about them" value="' + esc(editing.notes || '') + '"' + (ro ? ' disabled' : '') + '></label>' +
      '<div class="tr-label">Players <span class="muted">— speed vs the rest of the league; arm for QBs</span></div>' +
      '<div id="of-players" class="op-players">' + editing.players.map(function (p) { return playerRow(p, ro); }).join('') + '</div>' +
      (ro ? '' : '<button type="button" class="btn small" id="of-addp">＋ Add player</button>') +
      '<div class="series-actions">' + (ro ? '<button class="btn ghost" id="of-cancel">Close</button>'
        : '<button class="btn primary" id="of-save">Save team</button><button class="btn ghost" id="of-cancel">Cancel</button>' + (editing.id ? '<button class="btn ghost danger" id="of-del">Delete roster</button>' : '')) + '</div>';
    if (!editing.players.length && !ro) addPlayerRow();
    f.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function addPlayerRow() {
    var wrap = $('#of-players'); wrap.insertAdjacentHTML('beforeend', playerRow({ id: ST.uid('o'), speed: 0, arm: 0 }, false));
    var last = wrap.lastElementChild.querySelector('[data-f="name"]'); if (last) last.focus();
  }
  function readRows() {
    return Array.prototype.map.call(document.querySelectorAll('#of-players .op-prow'), function (row) {
      var v = function (f) { return row.querySelector('[data-f="' + f + '"]').value; };
      var p = { id: row.dataset.id, name: v('name').trim(), number: v('number'), off: v('off'), def: v('def'), speed: +v('speed') || 0, arm: v('off') === 'QB' ? +v('arm') || 0 : 0 };
      return p;
    }).filter(function (p) { return p.name || p.number || p.off || p.def || p.speed; });
  }
  function close() { $('#op-form').classList.add('hidden'); $('#op-form').innerHTML = ''; editing = null; }
  function save() {
    var name = $('#of-name').value.trim(); if (!name) { A.toast('Add the team’s name.'); return; }
    var clash = forName(name); if (clash && clash.id !== editing.id) { A.toast(name + ' already has a roster.'); return; }
    var oldName = editing.name, d = ST.S.data;
    editing.name = name; editing.notes = $('#of-notes').value.trim(); editing.players = readRows();
    if (editing.id) d.scout = list().map(function (o) { return o.id === editing.id ? editing : o; });
    else { editing.id = ST.uid('o'); list().push(editing); }
    // same team, new spelling: keep their games and the opponents list pointing at it
    if (oldName && norm(oldName) !== norm(name)) {
      d.opponents = (d.opponents || []).map(function (n) { return norm(n) === norm(oldName) ? name : n; });
      d.games.forEach(function (g) { if (norm(g.opp) === norm(oldName)) g.opp = name; });
    }
    if (!(d.opponents || []).some(function (n) { return norm(n) === norm(name); })) d.opponents.push(name);
    A.toast(name + ' saved for the whole team.'); close(); ST.save();
  }
  $('#op-add').addEventListener('click', function () {
    if (!storable()) { A.toast('Opponent rosters can’t be saved yet — see the note in this card.'); return; }
    openForm('');
  });
  $('#op-list').addEventListener('click', function (e) { var c = e.target.closest('.op-card'); if (c) openForm(c.dataset.name); });
  $('#op-form').addEventListener('change', function (e) {   // arm only matters for a QB
    if (e.target.dataset.f !== 'off') return;
    e.target.closest('.op-prow').querySelector('.op-arm').classList.toggle('hidden', e.target.value !== 'QB');
  });
  $('#op-form').addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest('[data-rm]')) { t.closest('.op-prow').remove(); return; }
    if (t.id === 'of-addp') { addPlayerRow(); return; }
    if (t.id === 'of-cancel') { close(); return; }
    if (t.id === 'of-save') { save(); return; }
    if (t.id === 'of-del') {
      if (!confirm('Delete ' + editing.name + '’s roster? Their games and results stay.')) return;
      ST.S.data.scout = list().filter(function (o) { return o.id !== editing.id; });
      close(); ST.save();
    }
  });

  function render() { if (!editing) renderList(); }
  var prevTab = A.tabHooks.roster;
  A.tabHooks.roster = function () { if (prevTab) prevTab(); render(); };
  ST.on(function () { if ($('#tab-roster').classList.contains('active')) render(); });
  A.onScoutReady = function () { if ($('#tab-roster').classList.contains('active')) render(); };

  /* Game Day: "Their roster" line under the matchup title */
  A.scoutLineHTML = function (opp) {
    var o = forName(opp), n = o ? (o.players || []).length : 0;
    return '<button class="btn small ghost" id="gd-scout">' + ICON('users') + ' ' + (n ? 'Their roster: ' + n + ' players · ' + esc(summary(o)) : 'Add their roster') + '</button>';
  };
  document.addEventListener('click', function (e) {
    if (!e.target.closest('#gd-scout')) return;
    var g = A.activeGame(); A.showTab('roster'); if (g) openForm(g.opp);
  });

  A.scout = { list: list, find: find, forName: forName, profile: profile, tuneDef: tuneDef, tuneOff: tuneOff, summary: summary, open: function (n) { A.showTab('roster'); openForm(n); } };
})();
