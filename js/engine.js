/* B2A Playbook engine: field model, play simulation, defense overlay, rule checker, SVG rendering.
   Coordinates are in yards. x: 0 (left sideline) .. 25 (right sideline). y: 0 = line of scrimmage,
   positive = downfield (toward the end zone), negative = backfield. */
(function (root) {
  'use strict';

  var FIELD = { W: 25, YMIN: -8, YMAX: 22, S: 20 };
  var CX = 12.5;
  var ROLES = ['C', 'QB', 'X', 'Y', 'Z'];
  var ROLE_NAMES = { C: 'Center', QB: 'Quarterback', X: 'X receiver', Y: 'Y receiver / back', Z: 'Z receiver' };
  var COLORS = { C: '#e5e7eb', QB: '#fbbf24', X: '#38bdf8', Y: '#f472b6', Z: '#a78bfa' };
  var DEFAULT_SPEED = { C: 6, QB: 3.5, X: 7, Y: 7, Z: 7 };
  var SNAP_T = 0.3;
  var PASS_SPEED = 17;   // yds/sec
  var PITCH_SPEED = 10;

  var FORMATIONS = {
    spread: { name: 'Spread (2x1)', C: [CX, 0], QB: [CX, -5], X: [2, 0], Y: [7, -1], Z: [23, 0] },
    trips: { name: 'Trips Right', C: [CX, 0], QB: [CX, -5], X: [23.5, 0], Z: [20, -1], Y: [16.5, -1] },
    bunch: { name: 'Bunch Right', C: [CX, 0], QB: [CX, -5], Z: [20, 0], Y: [18.5, -1.5], X: [21.5, -1.5] },
    gun: { name: 'Gun with Back', C: [CX, 0], QB: [CX, -5], X: [2, 0], Y: [15, -5], Z: [23, 0] },
    stack: { name: 'Stack Left', C: [CX, 0], QB: [CX, -5], X: [4, 0], Y: [4, -2], Z: [22, 0] }
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function dist(a, b) { var dx = a[0] - b[0], dy = a[1] - b[1]; return Math.sqrt(dx * dx + dy * dy); }
  function lerp(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; }
  function plen(pts) { var L = 0; for (var i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i]); return L; }
  function polyAt(pts, d) {
    if (d <= 0 || pts.length < 2) return pts[0].slice();
    for (var i = 1; i < pts.length; i++) {
      var s = dist(pts[i - 1], pts[i]);
      if (d <= s) return lerp(pts[i - 1], pts[i], s ? d / s : 0);
      d -= s;
    }
    return pts[pts.length - 1].slice();
  }

  /* Fill in formation start spots and defaults so every role has start + route. */
  function normalizePlay(play) {
    var p = clone(play);
    var f = FORMATIONS[p.formation] || FORMATIONS.spread;
    p.players = p.players || {};
    ROLES.forEach(function (r) {
      var pl = p.players[r] || {};
      pl.start = pl.start || f[r].slice();
      var rt = pl.route || {};
      pl.route = { pts: rt.pts || [], delay: rt.delay != null ? rt.delay : (r === 'QB' ? 0.35 : 0), speed: rt.speed || DEFAULT_SPEED[r] };
      p.players[r] = pl;
    });
    p.events = (p.events || []).slice().sort(function (a, b) { return a.t - b.t; });
    p.tags = p.tags || [];
    return p;
  }

  function flipPlay(play) {
    var p = normalizePlay(play);
    function fx(pt) { return [FIELD.W - pt[0], pt[1]]; }
    ROLES.forEach(function (r) {
      var pl = p.players[r];
      pl.start = fx(pl.start);
      pl.route.pts = pl.route.pts.map(fx);
    });
    if (p.motion) p.motion.pts = p.motion.pts.map(fx);
    p.flipped = !play.flipped;
    return p;
  }

  function buildSim(play) {
    var P = normalizePlay(play);
    var m = P.motion && P.motion.pts && P.motion.pts.length ? P.motion : null;
    var mPath = null, mDur = 0, mSpd = 0;
    if (m) {
      mPath = [P.players[m.player].start].concat(m.pts);
      mSpd = m.speed || 5;
      mDur = plen(mPath) / mSpd;
    }
    function pos(role, t) {
      var pl = P.players[role];
      var start = pl.start;
      if (m && role === m.player) {
        if (t < 0) return polyAt(mPath, Math.max(0, (t + mDur) * mSpd));
        start = mPath[mPath.length - 1];
      }
      var r = pl.route;
      if (t <= r.delay || !r.pts.length) return start.slice();
      return polyAt([start].concat(r.pts), (t - r.delay) * r.speed);
    }
    function routeEnd(role) {
      var pl = P.players[role];
      var start = (m && role === m.player) ? mPath[mPath.length - 1] : pl.start;
      return pl.route.delay + plen([start].concat(pl.route.pts)) / pl.route.speed;
    }
    // ball flights
    P.events.forEach(function (e) {
      if (e.type === 'pass' || e.type === 'pitch') {
        var A = pos(e.from, e.t), f = 0.3, B;
        for (var i = 0; i < 6; i++) {
          B = pos(e.to, e.t + f);
          f = dist(A, B) / (e.type === 'pass' ? PASS_SPEED : PITCH_SPEED) + 0.05;
        }
        e.flight = f; e.from_pt = A; e.catchPt = pos(e.to, e.t + f); e.catchT = e.t + f;
      }
    });
    function ballState(t) {
      if (t < 0) return { pt: pos('C', t), holder: 'C' };
      if (t < SNAP_T) return { pt: lerp(pos('C', 0), pos('QB', SNAP_T), t / SNAP_T), holder: null, air: 'snap' };
      var holder = 'QB';
      for (var i = 0; i < P.events.length; i++) {
        var e = P.events[i];
        if (t < e.t) break;
        if (e.type === 'handoff') { holder = e.to; continue; }
        if (t < e.catchT) return { pt: lerp(e.from_pt, e.catchPt, (t - e.t) / e.flight), holder: null, air: e.type, ev: e };
        holder = e.to;
      }
      return { pt: pos(holder, t), holder: holder };
    }
    var tEnd = 3;
    ROLES.forEach(function (r) { tEnd = Math.max(tEnd, routeEnd(r) + 0.3); });
    var last = P.events[P.events.length - 1];
    if (last) tEnd = Math.max(tEnd, (last.catchT || last.t) + 1.2);
    tEnd = Math.min(tEnd, 9);
    var firstEx = P.events.length ? P.events[0].t : null;
    return { P: P, pos: pos, ball: ballState, tStart: -mDur, tEnd: tEnd, firstExchange: firstEx, motionPath: mPath };
  }

  /* Simple demonstration defense: 1 declared blitzer from 7 yds + man coverage on the 4 eligible receivers. */
  function buildDefense(sim) {
    var P = sim.P, ballX = P.players.C.start[0];
    var dt = 0.05, steps = Math.ceil((sim.tEnd - sim.tStart) / dt) + 2;
    var bz = [ballX, 7.5], track = [];
    for (var i = 0; i < steps; i++) {
      var t = sim.tStart + i * dt;
      if (t > 0) {
        var bs = sim.ball(t), target = bs.holder ? bs.pt : (bs.air === 'snap' ? sim.pos('QB', SNAP_T) : bs.ev.catchPt);
        var d = dist(bz, target), step = 6.2 * dt;
        if (d > 0.9) bz = lerp(bz, target, Math.min(1, step / d));
      }
      track.push(bz.slice());
    }
    var men = ['X', 'Y', 'Z', 'C'];
    return function (t) {
      var out = [{ id: 'B', pt: track[Math.max(0, Math.min(track.length - 1, Math.round((t - sim.tStart) / dt)))], blitz: true }];
      men.forEach(function (r, k) {
        var tt = Math.max(sim.tStart, t - 0.25);
        var rp = sim.pos(r, tt);
        var cush = Math.max(1.2, 5 - 2.5 * Math.max(t, 0));
        if (r === 'C' && t < 0.3) cush = 5;
        out.push({ id: 'D' + (k + 1), pt: [Math.max(0.3, Math.min(24.7, rp[0])), Math.max(rp[1] + cush, t <= 0 ? 1 : -99)] });
      });
      return out;
    };
  }

  /* Rule checker based on USA Flag 5's (adult) + NFL FLAG rules, with league's 3-down modification. */
  function validate(play) {
    var sim = buildSim(play), P = sim.P, issues = [];
    function add(level, msg) { issues.push({ level: level, msg: msg }); }
    var ev = P.events;
    var passes = ev.filter(function (e) { return e.type === 'pass'; });
    var isRun = passes.length === 0;
    var C = P.players.C.start, QB = P.players.QB.start;

    if (Math.abs(C[1]) > 0.25) add('warn', 'Center should be on the line of scrimmage to snap.');
    if (QB[1] > -0.5) add('error', 'QB must line up off the line of scrimmage (in the backfield).');
    ['X', 'Y', 'Z'].forEach(function (r) {
      var s = P.players[r].start;
      if (s[1] > 0.05) add('error', r + ' lines up past the line of scrimmage (offside).');
      if (Math.abs(s[0] - C[0]) < 3 && s[1] > -1.5) add('warn', r + ' is within 3 yds of the center — adult leagues usually require spacing.');
    });
    ROLES.forEach(function (r) {
      P.players[r].route.pts.concat([P.players[r].start]).forEach(function (pt) {
        if (pt[0] < 0 || pt[0] > FIELD.W) add('warn', r + "'s path goes out of bounds.");
      });
    });
    if (P.motion && P.motion.pts && P.motion.pts.length) {
      var ms = P.players[P.motion.player].start;
      var bad = [ms].concat(P.motion.pts).some(function (pt) { return Math.abs(pt[1] - ms[1]) > 0.05 || pt[1] > -0.95; });
      if (bad) add('error', 'Motion must be parallel to the line and at least 1 yd behind it (no motion toward the LOS).');
      if (P.motion.player === 'C' || P.motion.player === 'QB') add('error', 'Only a receiver can go in motion.');
    }

    if (!ev.length) add('error', 'The QB never hands off or throws — the QB cannot run with the snap.');
    else if (ev[0].t > 7) add('error', 'First handoff/pass is at ' + ev[0].t.toFixed(1) + 's — breaks the 7-second rule.');
    else if (ev[0].t > 4.5 && ev[0].type === 'pass') add('warn', 'Throw at ' + ev[0].t.toFixed(1) + 's — a legal blitzer will usually arrive before then.');

    if (passes.length > 1) add('error', 'Only one forward pass is allowed per play.');

    var qbGotBack = false;
    ev.forEach(function (e) {
      var st = sim.ball(e.t - 0.001);
      if (st.holder !== e.from) add('error', e.from + " doesn't have the ball at " + e.t.toFixed(2) + 's (' + e.type + ').');
      var A = sim.pos(e.from, e.t);
      if (e.type === 'handoff') {
        if (e.to === 'C') add('error', 'Center cannot take a handoff (center sneak is illegal).');
        if (A[1] > 0) add('error', 'Handoff at ' + e.t.toFixed(2) + 's happens past the line of scrimmage.');
        var d = dist(A, sim.pos(e.to, e.t));
        if (d > 2.5) add('warn', 'At the handoff, ' + e.to + ' is ' + d.toFixed(1) + ' yds from ' + e.from + ' — adjust timing.');
        if (e.to === 'QB') qbGotBack = true;
      } else if (e.type === 'pitch') {
        if (e.catchPt[1] > A[1] + 0.05) add('error', 'The pitch to ' + e.to + ' travels forward — it must go backward or sideways.');
        if (A[1] > 0) add('error', 'Backward passes past the line of scrimmage are illegal.');
        if (e.to === 'C') add('warn', 'Pitching to the center is a gray area — center cannot take handoffs.');
        if (e.to === 'QB') qbGotBack = true;
      } else if (e.type === 'pass') {
        if (A[1] > 0) add('error', e.from + ' throws from past the line of scrimmage (illegal forward pass).');
        if (e.catchPt[1] <= 0) add('error', 'Forward pass to ' + e.to + ' is caught behind the line — must be caught beyond the LOS.');
      }
    });

    // QB carrying across LOS without having it handed back
    var gotBackT = Infinity;
    ev.forEach(function (e) { if (e.to === 'QB') gotBackT = Math.min(gotBackT, e.catchT || e.t); });
    for (var t = SNAP_T; t <= sim.tEnd; t += 0.05) {
      var b = sim.ball(t);
      if (b.holder === 'QB' && t < gotBackT && sim.pos('QB', t)[1] > 0) { add('error', 'QB carries the ball across the line of scrimmage.'); break; }
    }

    var exchangeFirst = ev.length && ev[0].type !== 'pass';
    if (isRun) add('info', 'Run play — illegal inside either no-run zone (5 yds before midfield or the goal line) and on 1-pt tries.');
    if (exchangeFirst && passes.length) add('info', 'Handoff/pitch comes first: the 7-sec clock is off, but every defender can now rush.');
    if (((P.ytg != null && P.ytg <= 5) || (P.ytm != null && P.ytm <= 5)) && isRun) add('error', 'Run play called from inside a no-run zone.');
    if (!issues.some(function (i) { return i.level !== 'info'; })) add('ok', 'Legal under league rules.');
    return { issues: issues, isRun: isRun, legal: !issues.some(function (i) { return i.level === 'error'; }) };
  }

  /* ---------- SVG rendering ---------- */
  function sx(x) { return x * FIELD.S; }
  function sy(y) { return (FIELD.YMAX - y) * FIELD.S; }
  function ptsAttr(pts) { return pts.map(function (p) { return sx(p[0]).toFixed(1) + ',' + sy(p[1]).toFixed(1); }).join(' '); }

  function fieldSVG(P, opts) {
    opts = opts || {};
    var W = sx(FIELD.W), H = (FIELD.YMAX - FIELD.YMIN) * FIELD.S, s = '';
    s += '<defs>';
    ROLES.forEach(function (r) {
      s += '<marker id="ar-' + r + (opts.uid || '') + '" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="' + COLORS[r] + '"/></marker>';
    });
    s += '<marker id="ar-ball' + (opts.uid || '') + '" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#fde68a"/></marker>';
    s += '</defs>';
    s += '<rect x="0" y="0" width="' + W + '" height="' + H + '" class="turf"/>';
    for (var y = FIELD.YMIN; y < FIELD.YMAX; y += 5) {
      if (((y - FIELD.YMIN) / 5) % 2 === 0) s += '<rect x="0" y="' + sy(y + 5) + '" width="' + W + '" height="' + 5 * FIELD.S + '" class="stripe"/>';
    }
    if (P.ytg != null) {
      var g = P.ytg;
      s += '<rect x="0" y="' + sy(g + 10) + '" width="' + W + '" height="' + 10 * FIELD.S + '" class="endzone"/>';
      s += '<text x="' + W / 2 + '" y="' + sy(g + 5) + '" class="ez-text">END ZONE</text>';
      s += '<rect x="0" y="' + sy(g) + '" width="' + W + '" height="' + Math.min(5, g) * FIELD.S + '" class="norun"/>';
      if (g <= 5) s += '<text x="6" y="' + (sy(g) + 14) + '" class="zone-label">NO-RUN ZONE</text>';
      else s += '<text x="6" y="' + (sy(5) + 14) + '" class="zone-label">NO-RUN ZONE</text>';
      s += '<line x1="0" x2="' + W + '" y1="' + sy(g) + '" y2="' + sy(g) + '" class="goal"/>';
    }
    if (P.ytm != null) {
      var mm = P.ytm;
      s += '<rect x="0" y="' + sy(mm) + '" width="' + W + '" height="' + Math.min(5, mm) * FIELD.S + '" class="norun"/>';
      s += '<text x="6" y="' + (sy(Math.min(mm, 5)) + 14) + '" class="zone-label">NO-RUN ZONE</text>';
      s += '<line x1="0" x2="' + W + '" y1="' + sy(mm) + '" y2="' + sy(mm) + '" class="midline"/>';
      s += '<text x="' + W / 2 + '" y="' + (sy(mm) - 6) + '" class="mid-text">MIDFIELD · 1ST DOWN</text>';
    }
    for (var yl = -5; yl <= FIELD.YMAX; yl += 5) {
      if (yl === 0) continue;
      s += '<line x1="0" x2="' + W + '" y1="' + sy(yl) + '" y2="' + sy(yl) + '" class="yardline"/>';
      s += '<text x="' + (W - 6) + '" y="' + (sy(yl) - 4) + '" class="yd-label">' + (yl > 0 ? '+' : '') + yl + '</text>';
    }
    s += '<line x1="0" x2="' + W + '" y1="' + sy(7) + '" y2="' + sy(7) + '" class="rushline"/>';
    s += '<text x="6" y="' + (sy(7) - 5) + '" class="rush-label">7-YD RUSH LINE</text>';
    s += '<line x1="0" x2="' + W + '" y1="' + sy(0) + '" y2="' + sy(0) + '" class="los"/>';
    s += '<text x="6" y="' + (sy(0) - 5) + '" class="los-label">LOS</text>';
    return s;
  }

  function routesSVG(sim, opts) {
    opts = opts || {};
    var P = sim.P, s = '', uid = opts.uid || '';
    if (sim.motionPath) s += '<polyline points="' + ptsAttr(sim.motionPath) + '" class="motion" stroke="' + COLORS[P.motion.player] + '"/>';
    ROLES.forEach(function (r) {
      var pl = P.players[r];
      if (!pl.route.pts.length) return;
      var start = (sim.motionPath && P.motion.player === r) ? sim.motionPath[sim.motionPath.length - 1] : pl.start;
      var carrier = P.events.some(function (e) { return e.type === 'handoff' && e.to === r; });
      s += '<polyline points="' + ptsAttr([start].concat(pl.route.pts)) + '" class="route' + (carrier ? ' carry' : '') + (r === 'QB' ? ' qbpath' : '') + '" stroke="' + COLORS[r] + '" marker-end="url(#ar-' + r + uid + ')"/>';
    });
    P.events.forEach(function (e) {
      if (e.type === 'pass' || e.type === 'pitch') {
        s += '<line x1="' + sx(e.from_pt[0]) + '" y1="' + sy(e.from_pt[1]) + '" x2="' + sx(e.catchPt[0]) + '" y2="' + sy(e.catchPt[1]) + '" class="' + e.type + '-line" marker-end="url(#ar-ball' + uid + ')"/>';
        if (e.type === 'pass') s += '<circle cx="' + sx(e.catchPt[0]) + '" cy="' + sy(e.catchPt[1]) + '" r="9" class="catch-ring"/>';
      }
    });
    return s;
  }

  function playersSVG(sim, t, defense, opts) {
    opts = opts || {};
    var s = '', P = sim.P, b = sim.ball(t);
    if (defense) {
      defense(t).forEach(function (d) {
        var x = sx(d.pt[0]), y = sy(d.pt[1]);
        s += '<g class="def' + (d.blitz ? ' blitz' : '') + '"><path d="M' + (x - 9) + ',' + (y - 9) + ' L' + (x + 9) + ',' + (y + 9) + ' M' + (x + 9) + ',' + (y - 9) + ' L' + (x - 9) + ',' + (y + 9) + '"/>' +
          (d.blitz && t <= 0 ? '<text x="' + (x + 12) + '" y="' + (y - 8) + '" class="hand">✋</text>' : '') + '</g>';
      });
    }
    ROLES.forEach(function (r) {
      var p = sim.pos(r, t), x = sx(p[0]), y = sy(p[1]);
      var hasBall = b.holder === r && t >= 0;
      s += '<g class="pl' + (opts.selected === r ? ' sel' : '') + '" data-role="' + r + '"><circle cx="' + x + '" cy="' + y + '" r="12" fill="' + COLORS[r] + '" class="pc' + (hasBall ? ' has-ball' : '') + '"/>' +
        '<text x="' + x + '" y="' + (y + 4.5) + '" class="pl-label">' + r + '</text></g>';
    });
    if (opts.showBall !== false) {
      var bx = sx(b.pt[0]), by = sy(b.pt[1]);
      if (b.holder) { bx += 10; by -= 10; }
      s += '<ellipse cx="' + bx + '" cy="' + by + '" rx="6" ry="4" class="ball"/>';
    }
    return s;
  }

  function viewBox(crop) {
    var y0 = crop ? crop[0] : FIELD.YMIN, y1 = crop ? crop[1] : FIELD.YMAX;
    return '0 ' + sy(y1) + ' ' + sx(FIELD.W) + ' ' + (y1 - y0) * FIELD.S;
  }

  function staticPlaySVG(play, opts) {
    opts = opts || {};
    var sim = buildSim(play);
    var uid = opts.uid || ('s' + Math.random().toString(36).slice(2, 7));
    return '<svg viewBox="' + viewBox(opts.crop) + '" xmlns="http://www.w3.org/2000/svg" class="field-svg">' +
      fieldSVG(sim.P, { uid: uid }) + routesSVG(sim, { uid: uid }) + playersSVG(sim, Math.min(0, sim.tStart), null, { showBall: false }) + '</svg>';
  }

  var api = {
    FIELD: FIELD, ROLES: ROLES, ROLE_NAMES: ROLE_NAMES, COLORS: COLORS, FORMATIONS: FORMATIONS, SNAP_T: SNAP_T,
    normalizePlay: normalizePlay, flipPlay: flipPlay, buildSim: buildSim, buildDefense: buildDefense, validate: validate,
    fieldSVG: fieldSVG, routesSVG: routesSVG, playersSVG: playersSVG, staticPlaySVG: staticPlaySVG, viewBox: viewBox,
    sx: sx, sy: sy, dist: dist, clone: clone
  };
  root.B2A = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
