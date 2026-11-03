/* B2A neon vaporwave icon set — line icons stroked with a hot-pink → cyan gradient and a soft glow.
   ICON(name) returns an inline <svg>; any element with data-icon="name" is filled in on load. */
(function (root) {
  'use strict';
  var P = {
    football: '<ellipse cx="12" cy="12" rx="9.5" ry="6" transform="rotate(-35 12 12)"/><path d="M8.6 15.4l6.8-6.8M10.3 11.6l2.1 2.1M11.9 10l2.1 2.1M8.7 13.2l2.1 2.1"/>',
    clipboard: '<rect x="5" y="4.5" width="14" height="17" rx="2"/><path d="M9 4.5V3h6v1.5M8.5 10h7M8.5 13.5h7M8.5 17h4"/>',
    chart: '<path d="M3 20.5h18"/><path d="M6 17v-4M10.5 17V8M15 17v-6M19.5 17V4"/><circle cx="19.5" cy="4" r=".2"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.6 2.7-6 6-6s6 2.4 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2c2.8.2 5 2.3 5 5.3"/>',
    jersey: '<path d="M8 3l-5 3 2 5 2-1v11h10V10l2 1 2-5-5-3a4 4 0 01-8 0z"/>',
    warn: '<path d="M12 3.5L21.5 20h-19z"/><path d="M12 10v4.5M12 17v.2"/>',
    brain: '<path d="M12 5.5a3 3 0 00-5.6-1.2A3 3 0 004 8.5a3.2 3.2 0 00.3 5.4A3 3 0 008 18.4a3 3 0 004 1.6zM12 5.5a3 3 0 015.6-1.2A3 3 0 0120 8.5a3.2 3.2 0 01-.3 5.4 3 3 0 01-3.7 4.5 3 3 0 01-4 1.6z"/><path d="M12 5.5V20"/>',
    pen: '<path d="M4 20l1-4.5L16 4.5a2.1 2.1 0 013 3L8 18.5z"/><path d="M14 6.5l3 3M4 20h16"/>',
    book: '<path d="M4 5.5A2 2 0 016 3.5h13v15H6a2 2 0 00-2 2z"/><path d="M4 20.5a2 2 0 002 2h13v-4M8 8h7M8 11.5h5"/>',
    print: '<path d="M7 9V3.5h10V9"/><rect x="3.5" y="9" width="17" height="8" rx="2"/><path d="M7 14h10v6.5H7z"/>',
    up: '<path d="M7 10.5V20H4v-9.5zM7 10.5l4-7.5a2 2 0 012 2.3L12.3 9H18a2 2 0 012 2.3l-1.3 7A2 2 0 0116.7 20H7"/>',
    down: '<path d="M17 13.5V4h3v9.5zM17 13.5L13 21a2 2 0 01-2-2.3l.7-3.7H6a2 2 0 01-2-2.3l1.3-7A2 2 0 017.3 4H17"/>',
    link: '<path d="M10 14a4 4 0 005.7 0l3.5-3.5a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3.5 3.5a4 4 0 005.7 5.7l1-1"/>',
    trash: '<path d="M4 6.5h16M9.5 6.5V4h5v2.5M6 6.5l1 14h10l1-14M10 10.5v6M14 10.5v6"/>',
    save: '<path d="M5 3.5h11.5L20 7v13.5H5z"/><path d="M8 3.5v5h7.5v-5M8 20.5v-6h8v6"/>',
    trophy: '<path d="M7.5 4h9v5a4.5 4.5 0 01-9 0z"/><path d="M7.5 6H4.5a3 3 0 003 4M16.5 6h3a3 3 0 01-3 4M12 13.5V17M8.5 20.5h7M9.5 17h5v3.5h-5z"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    magnet: '<path d="M5 4h4.5v8a2.5 2.5 0 005 0V4H19v8a7 7 0 01-14 0z"/><path d="M5 8h4.5M14.5 8H19"/>',
    ruler: '<path d="M3 16.5L16.5 3 21 7.5 7.5 21z"/><path d="M7 12.5l2 2M10 9.5l1.5 1.5M13 6.5l2 2"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    shield: '<path d="M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z"/><path d="M9 12l2 2 4-4"/>',
    runner: '<circle cx="14.5" cy="4.5" r="1.8"/><path d="M6 21l3.5-5.5 3 2.5 1-6 3.5 3h3M8.5 9.5l3.5-2 2.5 1.5-1 3.5M4 13h4"/>',
    hash: '<path d="M9.5 3.5l-2 17M16.5 3.5l-2 17M4.5 9h16M3.5 15h16"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
    flag: '<path d="M5 21V4M5 4.5c4-2 6 2 10 0s4 0 4 0v9s-1-2-4 0-6-2-10 0"/>',
    stop: '<path d="M8.5 3h7L21 8.5v7L15.5 21h-7L3 15.5v-7z"/><path d="M8 12h8"/>',
    hourglass: '<path d="M6.5 3h11M6.5 21h11M7.5 3c0 5 9 5 9 9s-9 4-9 9M16.5 3c0 5-9 5-9 9s9 4 9 9"/>',
    arrow: '<path d="M5 19L19 5M10 5h9v9"/>',
    bolt: '<path d="M13.5 2.5L5 14h6l-1.5 7.5L19 10h-6z"/>',
    blitz: '<path d="M12 3.5L21 19H3z"/><path d="M12 9.5v4.5M12 16.5v.2"/>',
    whistle: '<circle cx="9" cy="14" r="5.5"/><path d="M12.5 10l7-4.5 1.5 3-6 3.5M9 14h.1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    play: '<path d="M7 4.5l12 7.5-12 7.5z"/>'
  };
  var DEFS = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
    '<linearGradient id="vw-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff3ec8"/><stop offset=".55" stop-color="#b26bff"/><stop offset="1" stop-color="#2ee6ff"/></linearGradient>' +
    '<linearGradient id="vw-sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe14d"/><stop offset=".45" stop-color="#ff7a59"/><stop offset="1" stop-color="#ff2bd6"/></linearGradient>' +
    '<linearGradient id="vw-chrome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".48" stop-color="#9ef6ff"/><stop offset=".52" stop-color="#ff3ec8"/><stop offset="1" stop-color="#ffd1f4"/></linearGradient>' +
    '<filter id="vw-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.1" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
    '</defs></svg>';

  function ICON(name, cls) {
    var p = P[name] || P.football;
    return '<svg class="vw-icon ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="url(#vw-grad)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" filter="url(#vw-glow)">' + p + '</g></svg>';
  }
  function LOGO() {
    var stripes = '';
    [26, 30, 33.5, 36.5].forEach(function (y, i) { stripes += '<rect x="20" y="' + y + '" width="40" height="' + (1.2 + i * 0.5) + '" fill="#0b1410"/>'; });
    var grid = '';
    for (var i = 0; i <= 8; i++) grid += '<line x1="' + (40 + (i - 4) * 4) + '" y1="38" x2="' + (40 + (i - 4) * 13) + '" y2="48" stroke="#ff3ec8" stroke-width=".7" opacity=".7"/>';
    [40, 42.5, 45.5].forEach(function (y) { grid += '<line x1="0" y1="' + y + '" x2="80" y2="' + y + '" stroke="#2ee6ff" stroke-width=".6" opacity=".6"/>'; });
    return '<svg class="vw-logo" viewBox="0 0 80 48" role="img" aria-label="B2A">' +
      '<clipPath id="vw-sunclip"><rect x="0" y="0" width="80" height="38"/></clipPath>' +
      '<circle cx="40" cy="26" r="17" fill="url(#vw-sun)" clip-path="url(#vw-sunclip)"/>' + stripes + grid +
      '<text x="40" y="33" text-anchor="middle" class="vw-logo-text" fill="url(#vw-chrome)" stroke="#2ee6ff" stroke-width=".9" filter="url(#vw-glow)">B2A</text></svg>';
  }
  function hydrate(scope) {
    Array.prototype.forEach.call((scope || document).querySelectorAll('[data-icon]'), function (el) {
      if (el.dataset.done) return; el.dataset.done = '1';
      el.insertAdjacentHTML('afterbegin', ICON(el.dataset.icon));
    });
  }
  document.body.insertAdjacentHTML('afterbegin', DEFS);
  root.ICON = ICON; root.B2A_LOGO = LOGO; root.B2A_HYDRATE_ICONS = hydrate;
})(window);
