/* Stats: record, matchups, play performance, by-down success, takeaways — all from logged results. */
(function () {
  'use strict';
  var A = window.APP, ST = A.ST, $ = A.$, esc = A.esc, pct = A.pct;
  var ORD = ['', '1st', '2nd', '3rd'];
  var f = { opp: '', side: 'off' };

  function bar(x, cls) { return '<div class="bar ' + (cls || '') + '"><i style="width:' + Math.round((x || 0) * 100) + '%"></i></div>'; }
  function render() {
    var d = ST.S.data;
    var opps = d.opponents.slice().sort();
    $('#st-opp').innerHTML = '<option value="">All opponents</option>' + opps.map(function (o) { return '<option>' + esc(o) + '</option>'; }).join('');
    $('#st-opp').value = f.opp; $('#st-side').value = f.side;
    var games = d.games.filter(function (g) { return !f.opp || g.opp === f.opp; }).sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    var played = games.filter(function (g) { return g.us || g.them; });
    var W = 0, L = 0, T = 0, PF = 0, PA = 0;
    played.forEach(function (g) { PF += g.us; PA += g.them; if (g.us > g.them) W++; else if (g.us < g.them) L++; else T++; });
    var off = ST.entries({ opp: f.opp, side: 'off' }), def = ST.entries({ opp: f.opp, side: 'def' });
    var offOk = off.filter(function (l) { return ST.resultInfo('off', l.result).ok; }).length;
    var defOk = def.filter(function (l) { return ST.resultInfo('def', l.result).ok; }).length;
    var tds = off.filter(function (l) { return l.result === 'td'; }).length;
    $('#st-tiles').innerHTML = [
      ['Record', W + '–' + L + (T ? '–' + T : '')], ['Points', PF + ' / ' + PA], ['Offense success', off.length ? pct(offOk / off.length) : '—', off.length + ' plays'],
      ['Defense stop rate', def.length ? pct(defOk / def.length) : '—', def.length + ' plays'], ['Offensive TDs', String(tds)]
    ].map(function (t) { return '<div class="tile"><span>' + t[0] + '</span><b>' + t[1] + '</b>' + (t[2] ? '<small>' + t[2] + '</small>' : '') + '</div>'; }).join('');

    $('#st-games').innerHTML = games.length ? '<table class="tbl"><thead><tr><th>Date</th><th>Opponent</th><th>Score</th><th>Off.</th><th>Def.</th><th></th></tr></thead><tbody>' + games.map(function (g) {
      var o = g.log.filter(function (l) { return l.side === 'off'; }), dd = g.log.filter(function (l) { return l.side === 'def'; });
      var oo = o.filter(function (l) { return ST.resultInfo('off', l.result).ok; }).length, de = dd.filter(function (l) { return ST.resultInfo('def', l.result).ok; }).length;
      var res = g.us > g.them ? 'W' : g.us < g.them ? 'L' : (g.us || g.them ? 'T' : '–');
      return '<tr data-opp="' + esc(g.opp) + '"><td>' + esc(g.date || '') + '</td><td><b>' + esc(g.opp) + '</b></td><td>' + g.us + '–' + g.them + ' <span class="wl ' + res + '">' + res + '</span></td><td>' + (o.length ? pct(oo / o.length) : '—') + '</td><td>' + (dd.length ? pct(de / dd.length) : '—') + '</td><td class="muted">' + g.log.length + ' logged</td></tr>';
    }).join('') + '</tbody></table>' : '<p class="hint">No games yet. Create one in Game Day and log plays as you go.</p>';

    var stats = ST.playStats({ opp: f.opp, side: f.side });
    var rows = Object.keys(stats).map(function (k) { return stats[k]; }).sort(function (a, b) { return b.ok / b.calls - a.ok / a.calls || b.calls - a.calls; });
    // include rated-but-unlogged plays so ratings are visible
    Object.keys(ST.S.data.ratings).forEach(function (id) {
      var isDef = !!A.findDef(id); if ((f.side === 'def') !== isDef || stats[id]) return;
      rows.push({ play: id, calls: 0, ok: 0, yds: 0, ydsN: 0, td: 0, to: 0 });
    });
    $('#st-plays').innerHTML = rows.length ? '<table class="tbl plays"><thead><tr><th>Play</th><th>Calls</th><th>Success</th><th>Avg yds</th><th>' + (f.side === 'off' ? 'TD / TO' : 'INT') + '</th><th>Rate</th></tr></thead><tbody>' + rows.map(function (s) {
      var sr = s.calls ? s.ok / s.calls : null, r = ST.rating(s.play);
      return '<tr data-id="' + esc(s.play) + '"><td><b>' + esc(A.playName(s.play)) + '</b></td><td>' + s.calls + '</td><td><div class="sr">' + (sr == null ? '—' : bar(sr, sr >= 0.6 ? 'good' : sr < 0.4 ? 'bad' : '') + '<span>' + pct(sr) + '</span>') + '</div></td><td>' + (s.ydsN ? (s.yds / s.ydsN).toFixed(1) : '—') + '</td><td>' + (f.side === 'off' ? s.td + ' / ' + s.to : s.to) + '</td>' +
        '<td class="rt"><button data-r="1" class="' + (r > 0 ? 'on' : '') + '">👍</button><button data-r="-1" class="' + (r < 0 ? 'on' : '') + '">👎</button></td></tr>';
    }).join('') + '</tbody></table>' : '<p class="hint">Log plays in Game Day to see what works.</p>';

    var ents = f.side === 'off' ? off : def;
    $('#st-down').innerHTML = [1, 2, 3].map(function (dn) {
      var e = ents.filter(function (l) { return (l.down || 1) === dn && l.sit !== 'pat1' && l.sit !== 'pat2'; });
      var ok = e.filter(function (l) { return ST.resultInfo(f.side, l.result).ok; }).length;
      return '<div class="down-row"><span>' + ORD[dn] + '</span>' + bar(e.length ? ok / e.length : 0, '') + '<b>' + (e.length ? pct(ok / e.length) : '—') + '</b><small>' + e.length + '</small></div>';
    }).join('');

    var ins = [];
    var enough = rows.filter(function (s) { return s.calls >= 2; });
    if (enough.length) {
      var best = enough[0], worst = enough[enough.length - 1];
      if (best.ok / best.calls >= 0.5) ins.push('Most reliable: <b>' + esc(A.playName(best.play)) + '</b> (' + best.ok + '/' + best.calls + ').');
      if (worst !== best && worst.ok / worst.calls < 0.5) ins.push('Struggling: <b>' + esc(A.playName(worst.play)) + '</b> (' + worst.ok + '/' + worst.calls + ') — rep it or drop it.');
    }
    var third = ents.filter(function (l) { return l.down === 3; }), thirdBest = {};
    third.forEach(function (l) { var o = thirdBest[l.play] || (thirdBest[l.play] = { n: 0, ok: 0 }); o.n++; if (ST.resultInfo(f.side, l.result).ok) o.ok++; });
    var tb = Object.keys(thirdBest).filter(function (k) { return thirdBest[k].ok; }).sort(function (a, b) { return thirdBest[b].ok - thirdBest[a].ok; })[0];
    if (tb) ins.push('Best 3rd-down ' + (f.side === 'off' ? 'call' : 'defense') + ': <b>' + esc(A.playName(tb)) + '</b> (' + thirdBest[tb].ok + '/' + thirdBest[tb].n + ').');
    if (f.side === 'def') {
      var vs = {}; def.forEach(function (l) { if (!l.vs || ST.resultInfo('def', l.result).ok) return; vs[l.vs] = (vs[l.vs] || 0) + 1; });
      var hurt = Object.keys(vs).sort(function (a, b) { return vs[b] - vs[a]; })[0];
      if (hurt) ins.push('Their play that hurt us most: <b>' + esc(A.playName(hurt)) + '</b> (' + vs[hurt] + '×).');
    }
    var rated = Object.keys(ST.S.data.ratings).length;
    if (rated) ins.push(rated + ' play' + (rated > 1 ? 's' : '') + ' rated by the coach.');
    $('#st-insights').innerHTML = (ins.length ? ins : ['Not enough data yet — log a game to unlock takeaways.']).map(function (x) { return '<li>' + x + '</li>'; }).join('');
  }
  $('#st-opp').addEventListener('change', function (e) { f.opp = e.target.value; render(); });
  $('#st-side').addEventListener('change', function (e) { f.side = e.target.value; render(); });
  $('#st-games').addEventListener('click', function (e) { var tr = e.target.closest('tr[data-opp]'); if (tr) { f.opp = tr.dataset.opp; render(); } });
  $('#st-plays').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-r]'), tr = e.target.closest('tr[data-id]'); if (!tr) return;
    if (b) { ST.rate(tr.dataset.id, +b.dataset.r); return; }
    A.openPlay(tr.dataset.id, f.side);
  });
  A.tabHooks.stats = render;
  ST.on(function () { if ($('#tab-stats').classList.contains('active')) render(); });
})();
