/* Tiny helpers shared by every other script. Loaded first. */
(function (root) {
  'use strict';
  var MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  /* make any text safe to put inside HTML (names, notes, emails typed by people) */
  root.B2A_ESC = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return MAP[c]; }); };
})(window);
