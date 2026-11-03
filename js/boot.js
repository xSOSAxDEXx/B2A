/* Start-up: draw the logo + icons, load the team's published season data, then show the playbook. */
(function () {
  'use strict';
  var A = window.APP;
  document.getElementById('logo').innerHTML = B2A_LOGO();
  B2A_HYDRATE_ICONS();
  A.bootPlays();
  A.ST.load().then(function () { A.refreshPlays(); });
  A.ST.on(function () { var t = document.querySelector('#tab-plays'); if (t.classList.contains('active')) A.refreshPlays(); });
})();
