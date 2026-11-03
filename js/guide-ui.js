/* Guide tab: strategy, coverage cheat sheet, league rules. */
(function () {
  'use strict';
  var A = window.APP, $ = A.$, $$ = A.$$, esc = A.esc, done = false;
  function render() {
    if (done) return; done = true;
    $('#guide-strategy').innerHTML = '<div class="rules-grid">' + B2A_GUIDE.map(function (s) {
      return '<div class="card"><h3>' + s.icon + ' ' + esc(s.title) + '</h3><ul>' + s.items.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ul></div>';
    }).join('') + '</div>';
    $('#guide-coverages').innerHTML = '<p class="hint">Each diagram shows the coverage against its demo play. Tap one to animate it in the Plays tab against any of our offensive plays.</p><div class="cov-grid">' + A.defPlays().map(function (d) {
      return '<button class="cov card" data-id="' + d.id + '"><div class="thumb">' + A.defSVG(d, null, [-7, 18], 'g' + d.id) + '</div><div class="cov-body"><b>' + esc(d.num + ' · ' + d.name) + '</b><span class="muted">' + esc(d.front) + '</span>' +
        '<p><b class="good">Call it:</b> ' + esc(d.when.join(' · ')) + '</p><p><b class="good">+</b> ' + esc(d.strengths) + '</p><p><b class="bad">−</b> ' + esc(d.weaknesses) + '</p></div></button>';
    }).join('') + '</div>';
    $('#rules-grid').innerHTML = B2A_RULES.map(function (s) {
      return '<div class="card"><h3>' + s.icon + ' ' + esc(s.title) + '</h3><ul>' + s.items.map(function (i) {
        return '<li class="' + (i.league ? 'league' : '') + (i.diff ? ' diff' : '') + '">' + (i.league ? '<b>HOUSE RULE · </b>' : '') + i.t + '</li>';
      }).join('') + '</ul></div>';
    }).join('') + '<div class="card"><h3>🚩 Penalties</h3><table class="pen-table">' + B2A_PENALTIES.map(function (r) {
      return '<tr><td>' + r[0] + '</td><td>' + esc(r[1]) + '</td><td>' + esc(r[2]) + '</td></tr>';
    }).join('') + '</table><p class="hint">Defensive penalties give an automatic first down where noted. Yardage is halved when it’s more than half the distance to the goal.</p></div>';
    $('#guide-sources').innerHTML = 'Strategy summarized in our own words from: ' + B2A_GUIDE_SOURCES.map(function (s) { return '<a href="' + s[1] + '" target="_blank" rel="noopener">' + esc(s[0]) + '</a>'; }).join(' · ') +
      '. Rules from the <a href="https://nflflag.com/coaches/flag-football-rules" target="_blank" rel="noopener">NFL FLAG rules page</a> and the <a href="https://resources.usafootball.com/assets/usawebsite/usa-flag-5\'s-rulebook_2026.1.pdf" target="_blank" rel="noopener">USA Flag 5’s Rulebook v2026.1</a>.';
  }
  $('#guide-switch').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    $$('#guide-switch button').forEach(function (x) { x.classList.toggle('on', x === b); });
    $$('.guide-pane').forEach(function (p) { p.classList.toggle('hidden', p.id !== 'guide-' + b.dataset.g); });
  });
  $('#guide-coverages').addEventListener('click', function (e) { var c = e.target.closest('.cov'); if (c) A.openPlay(c.dataset.id, 'def'); });
  A.tabHooks.guide = render;
})();
