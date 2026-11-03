/* Start-up: load the team's published season data, then show the playbook. */
(function () {
  'use strict';
  var A = window.APP;
  A.bootPlays();
  A.ST.load().then(function () { A.refreshPlays(); });
  A.ST.on(function () { var t = document.querySelector('#tab-plays'); if (t.classList.contains('active')) A.refreshPlays(); });
})();
