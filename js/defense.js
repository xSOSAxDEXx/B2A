/* B2A defense engine: coverage simulation against any offensive play, flag-pull / sack detection, SVG drawing.
   A defensive call is a list of defenders, each with a job:
     blitz – declared blitzer from 7+ yds, blitzes the QB / ball
     man   – covers one offensive role (on: 'X'|'Y'|'Z'|'C'|'QB'), inside leverage, trails him
     zone  – drops to a spot (drop) and plays any receiver who enters its radius (r)
     spy   – mirrors the QB/ball at a set depth until there's a handoff or throw
   Starting spots for man defenders are computed from the receiver's alignment; zone/blitz/spy use absolute spots. */
(function (root) {
  'use strict';
  var E = root.B2A;
  var dist = E.dist, W = E.FIELD.W;
  var DT = 0.05;
  var JOB_COLORS = { blitz: '#ff8a1f', man: '#ff2e63', zone: '#b8ff2e', spy: '#ffe14d' };
  var JOB_NAMES = { blitz: 'Blitzer', man: 'Man', zone: 'Zone', spy: 'Spy' };

  function lerp(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; }
  function moveTo(p, target, step) {
    var d = dist(p, target);
    if (d <= step || d < 1e-6) return target.slice();
    return lerp(p, target, step / d);
  }
  function clampX(p) { return [Math.max(0.4, Math.min(W - 0.4, p[0])), p[1]]; }

  function flipDefense(def) {
    var d = E.clone(def);
    d.defenders.forEach(function (x) {
      if (x.start) x.start = [W - x.start[0], x.start[1]];
      if (x.drop) x.drop = [W - x.drop[0], x.drop[1]];
    });
    d.flipped = !def.flipped;
    return d;
  }

  function manAlign(def, recStart, ballX) {
    var inside = recStart[0] < ballX ? 1 : -1;
    var cushion = def.cushion != null ? def.cushion : (recStart[1] < -2 ? 4 : 5);
    return [recStart[0] + inside * (def.lev != null ? def.lev : 0.8), Math.max(recStart[1], 0) + cushion];
  }

  /* Formation strength: which side has 2 receivers (strong), 1 (weak); trips = all 3 on one side. */
  function strength(sim) {
    var P = sim.P, bx = P.players.C.start[0], L = [], R = [];
    ['X', 'Y', 'Z'].forEach(function (r) { var p = sim.pos(r, sim.tStart); (p[0] < bx ? L : R).push({ r: r, out: Math.abs(p[0] - bx) }); });
    var strongIsLeft = L.length > R.length, strong = strongIsLeft ? L : R, weak = strongIsLeft ? R : L;
    strong.sort(function (a, b) { return b.out - a.out; }); weak.sort(function (a, b) { return b.out - a.out; });
    var roles = { strongOut: strong[0] && strong[0].r, strongSlot: strong[1] && strong[1].r, weakOut: weak[0] ? weak[0].r : (strong[2] && strong[2].r) };
    return { left: strongIsLeft, trips: strong.length === 3, balanced: L.length === R.length, roles: roles };
  }
  var ROLE_WORDS = { strongOut: 'the strong-side outside receiver (#1)', strongSlot: 'the strong-side slot (#2)', weakOut: 'the weak-side receiver' };
  function onText(on) { return ROLE_WORDS[on] || on; }
  function cornerLabel(id, st) { return (id === 'SC' || id === 'WC') && (st.trips || st.balanced) ? 'C' : id; }

  /* Build the defense simulation against an offensive sim (from B2A.buildSim). */
  function simulate(defPlay, sim) {
    var P = sim.P, ballX = P.players.C.start[0], st = strength(sim);
    var defs = defPlay.defenders.map(function (d) {
      var o = E.clone(d);
      if (o.on && st.roles[o.on] !== undefined) o.on = st.roles[o.on] || 'C';
      if (st.left !== !!defPlay.flipped) {   // put the strong-side defenders on the offense's strong side
        if (o.start) o.start = [W - o.start[0], o.start[1]];
        if (o.drop) o.drop = [W - o.drop[0], o.drop[1]];
      }
      o.label = cornerLabel(o.id, st);
      if (o.job === 'man') o.start = manAlign(o, sim.pos(o.on, sim.tStart), ballX);
      o.pos = o.start.slice();
      return o;
    });
    var steps = Math.ceil((sim.tEnd + 1.5 - sim.tStart) / DT) + 1;
    var frames = [], result = null;
    var gotBackT = Infinity;
    P.events.forEach(function (e) { if (e.to === 'QB') gotBackT = Math.min(gotBackT, e.catchT || e.t); });
    var firstEx = sim.firstExchange == null ? Infinity : sim.firstExchange;
    var goalY = P.ytg != null ? P.ytg : null;
    var passEv = P.events.filter(function (e) { return e.type === 'pass'; })[0], sep = null;

    /* who goes after a ball carrier. Blitzers (and a spy) chase him after a short reaction. Coverage players hold
       their coverage while he is still behind the line — after a handoff or backward pass he can still throw —
       and come up once he crosses the line, gets close to them, or caught a forward pass. */
    function gotBallBy(r, t) {
      var last = null;
      P.events.forEach(function (e) { if (e.to === r && (e.catchT || e.t) <= t + 1e-6) last = e; });
      return last;
    }
    function chases(d, r, t) {
      var e = gotBallBy(r, t), since = e ? t - (e.catchT || e.t) : 9, cp = sim.pos(r, t);
      if (e && e.type === 'pass') return true;                 // a receiver after the catch: everyone rallies
      if (d.job === 'blitz' || d.job === 'spy') return since >= 0.25;
      if (since < 0.4) return false;                           // reading the exchange
      var canThrow = cp[1] < -0.3 && !(passEv && t >= passEv.t);   // behind the line, no forward pass thrown yet
      return !canThrow || dist(d.pos, cp) < 3.5;
    }

    for (var i = 0; i < steps; i++) {
      var t = sim.tStart + i * DT;
      var b = sim.ball(Math.min(t, sim.tEnd));
      var qb = sim.pos('QB', t);
      var carrier = b.holder && t > E.SNAP_T && (b.holder !== 'QB' || t >= gotBackT) ? b.holder : null;
      defs.forEach(function (d) {
        if (t <= 0) {
          if (d.job === 'man') d.pos = manAlign(d, sim.pos(d.on, t), ballX);
          return;
        }
        var target, speed;
        if (carrier && chases(d, carrier, t)) { target = sim.pos(carrier, t); speed = d.job === 'blitz' ? 6 : 7; }
        else if (d.job === 'blitz') {
          target = b.holder === 'QB' || !b.holder ? qb : b.pt; speed = d.speed || 5.6;
        } else if (d.job === 'man') {
          var rp = sim.pos(d.on, Math.max(0, t - 0.4)), inside = rp[0] < ballX ? 0.6 : -0.6;   // reacts ~0.4s after the receiver
          target = [rp[0] + inside, rp[1] + (d.trail != null ? d.trail : 1.3)]; speed = 7;
        } else if (d.job === 'zone') {
          var best = null, bd = d.r || 6;
          ['X', 'Y', 'Z', 'C', 'QB'].forEach(function (r) {
            if (r === 'QB' && t < gotBackT && !P.events.some(function (e) { return e.from === 'QB' && e.t < t; })) return;
            var p = sim.pos(r, t); if (p[1] < -0.5) return;
            var dd = dist(p, d.drop); if (dd < bd) { bd = dd; best = p; }
          });
          if (best) {
            var deep = d.drop[1] >= 10;
            var tgt = lerp(d.drop, best, 0.6);
            if (deep) tgt[1] = Math.max(tgt[1], best[1] + 2.5);   // deep defenders stay on top
            target = tgt; speed = 6.5;
          } else { target = d.drop; speed = 6.3; }
        } else if (d.job === 'spy') {
          target = [b.pt[0], d.start[1]]; speed = 6;
        } else { target = d.pos; speed = 0; }
        // ball in the air: defenders read it (~0.3s) then break on the catch point if it's in range
        if (!carrier && b.air === 'pass' && d.job !== 'blitz') {
          var ev = b.ev, tin = t - ev.t, cp = ev.catchPt, dd2 = dist(d.pos, cp);
          var mine = (d.job === 'man' && d.on === ev.to) || dd2 < (d.r || 5) + 1.5;
          var react = d.job === 'zone' && d.drop[1] >= 10 ? 0.65 : 0.5;   // deep defenders read longer before driving
          if (tin > react) { if (mine) { target = cp; speed = d.job === 'zone' && d.drop[1] >= 10 ? 5.4 : 5.8; } else if (tin > 0.7) { target = cp; speed = 5; } }
        }
        var np = clampX(moveTo(d.pos, target, speed * DT));
        if (passEv && b.air === 'pass' && b.ev === passEv && d.nearT == null && dist(np, passEv.catchPt) < 1.0) d.nearT = t;
        if (d.job !== 'blitz' && t < firstEx && np[1] < 0.3) np[1] = 0.3;  // can't cross LOS before an exchange
        d.pos = np;
      });
      frames.push(defs.map(function (d) { return d.pos.slice(); }));
      // ball in the air: a cover player sitting in the throwing lane (short of the catch spot) picks it off
      if (!result && passEv && b.air === 'pass' && b.ev === passEv && (t - passEv.t) / passEv.flight > 0.35 && dist(b.pt, passEv.catchPt) > 2) {
        for (var q = 0; q < defs.length; q++) {
          if ((defs[q].job === 'zone' || defs[q].job === 'spy') && dist(defs[q].pos, b.pt) < 0.45) { result = { kind: 'int', t: t, pt: b.pt.slice(), gain: 0, by: defs[q].id, why: 'lane' }; break; }
        }
      }
      if (passEv && sep == null && t >= passEv.catchT) {
        sep = Infinity; var close = null;
        defs.forEach(function (d) { var dd = dist(d.pos, passEv.catchPt); if (dd < sep) { sep = dd; close = d; } });
        if (!result && close) {
          var cp = passEv.catchPt, fp = passEv.from_pt;
          var under = dist(close.pos, fp) < dist(cp, fp) - 0.3;                  // between the thrower and the catch
          var early = close.nearT != null && close.nearT <= passEv.catchT - 0.6;  // was waiting at the spot well before the receiver
          var hawk = close.job !== 'blitz';
          if (sep < 0.5 && hawk && (under || early)) result = { kind: 'int', t: t, pt: cp.slice(), gain: 0, by: close.id };
          else if (sep < 0.7 || (sep < 1.2 && under)) result = { kind: 'inc', t: t, pt: cp.slice(), gain: 0, by: close.id };
        }
      }

      if (!result && t > E.SNAP_T && t <= sim.tEnd) {
        if (carrier) {
          var cpos = sim.pos(carrier, t);
          if (goalY != null && cpos[1] >= goalY) { result = { kind: 'td', t: t, pt: cpos, gain: goalY }; }
          else {
            for (var k = 0; k < defs.length; k++) {
              if (dist(defs[k].pos, cpos) < 1.0) { result = { kind: 'flag', t: t, pt: cpos, gain: cpos[1], by: defs[k].id }; break; }
            }
          }
        } else if (b.holder === 'QB' && t < firstEx) {
          for (var j = 0; j < defs.length; j++) {
            if (defs[j].job === 'blitz' && dist(defs[j].pos, qb) < 0.8) { result = { kind: 'sack', t: t, pt: qb, gain: qb[1], by: defs[j].id }; break; }
          }
        }
      }
    }
    if (!result) {
      var bs = sim.ball(sim.tEnd);
      result = { kind: 'open', t: sim.tEnd, pt: bs.pt, gain: bs.pt[1] };
      if (goalY != null && bs.pt[1] >= goalY) result.kind = 'td';
    }
    if (passEv && result) { result.sep = sep; result.caught = result.kind !== 'sack' && result.kind !== 'inc' && result.kind !== 'int' && result.t >= passEv.catchT - 0.01; }
    function at(t) {
      var i = Math.max(0, Math.min(frames.length - 1, Math.round((t - sim.tStart) / DT)));
      return defs.map(function (d, k) { return { id: d.id, label: d.label || d.id, job: d.job, pt: frames[i][k], d: d }; });
    }
    function pressure(t) {
      var b = sim.ball(t); if (b.holder !== 'QB' || t > firstEx) return false;
      var qbp = sim.pos('QB', t);
      return at(t).some(function (d) { return d.job === 'blitz' && dist(d.pt, qbp) < 2.6; });
    }
    return { defs: defs, at: at, result: result, pressure: pressure, start: at(sim.tStart) };
  }

  function sx(x) { return E.sx(x); } function sy(y) { return E.sy(y); }

  /* Static layer: zones, blitz paths, man assignment lines (pre-snap). */
  function assignmentsSVG(dsim, sim, opts) {
    opts = opts || {};
    var s = '', faint = opts.faint ? ' faint' : '';
    var qb = sim.pos('QB', E.SNAP_T);
    dsim.defs.forEach(function (d) {
      var c = JOB_COLORS[d.job];
      if (d.job === 'zone') {
        var r = d.r || 6;
        s += '<ellipse cx="' + sx(d.drop[0]) + '" cy="' + sy(d.drop[1]) + '" rx="' + r * 20 + '" ry="' + r * 14 + '" class="zone-area' + faint + '" fill="' + c + '" stroke="' + c + '"/>';
        if (d.zone) s += '<text x="' + sx(d.drop[0]) + '" y="' + (sy(d.drop[1]) + r * 14 - 6) + '" class="zone-name">' + d.zone + '</text>';
        if (dist(d.start, d.drop) > 0.6) s += '<line x1="' + sx(d.start[0]) + '" y1="' + sy(d.start[1]) + '" x2="' + sx(d.drop[0]) + '" y2="' + sy(d.drop[1]) + '" class="drop-line' + faint + '" stroke="' + c + '"/>';
      } else if (d.job === 'blitz') {
        s += '<line x1="' + sx(d.start[0]) + '" y1="' + sy(d.start[1]) + '" x2="' + sx(qb[0]) + '" y2="' + sy(qb[1] + 1) + '" class="blitz-line' + faint + '" stroke="' + c + '"/>';
      } else if (d.job === 'man') {
        var rp = sim.pos(d.on, sim.tStart);
        s += '<line x1="' + sx(d.start[0]) + '" y1="' + sy(d.start[1]) + '" x2="' + sx(rp[0]) + '" y2="' + sy(rp[1]) + '" class="man-line' + faint + '" stroke="' + c + '"/>';
      } else if (d.job === 'spy') {
        s += '<line x1="' + sx(d.start[0] - 3) + '" y1="' + sy(d.start[1]) + '" x2="' + sx(d.start[0] + 3) + '" y2="' + sy(d.start[1]) + '" class="spy-line' + faint + '" stroke="' + c + '"/>';
      }
    });
    return s;
  }

  /* Shapes: blitzer = triangle, man = square, zone = diamond, spy = circle. */
  function shapePath(job, x, y, r) {
    if (job === 'blitz') return 'M' + x + ',' + (y - r * 1.15) + ' L' + (x + r * 1.1) + ',' + (y + r * 0.8) + ' L' + (x - r * 1.1) + ',' + (y + r * 0.8) + ' Z';
    if (job === 'zone') return 'M' + x + ',' + (y - r * 1.2) + ' L' + (x + r * 1.2) + ',' + y + ' L' + x + ',' + (y + r * 1.2) + ' L' + (x - r * 1.2) + ',' + y + ' Z';
    if (job === 'spy') return 'M' + (x - r) + ',' + y + ' a' + r + ',' + r + ' 0 1,0 ' + 2 * r + ',0 a' + r + ',' + r + ' 0 1,0 ' + -2 * r + ',0';
    return 'M' + (x - r) + ',' + (y - r) + ' h' + 2 * r + ' v' + 2 * r + ' h' + -2 * r + ' Z';
  }
  var RAISED_HAND = 'M4 14V6a1.5 1.5 0 013 0v5M7 11V3.5a1.5 1.5 0 013 0V11M10 11V4.5a1.5 1.5 0 013 0V12M13 12V7a1.5 1.5 0 013 0v6c0 4-3 6-6 6s-5-2-6-4l-2-4a1.5 1.5 0 012.5-1.5L4 14';
  function defendersSVG(dsim, t, opts) {
    opts = opts || {};
    var s = '';
    dsim.at(t).forEach(function (d) {
      var x = sx(d.pt[0]), y = sy(d.pt[1]), c = JOB_COLORS[d.job];
      if (opts.marks) {
        s += '<path d="' + shapePath(d.job, x, y, 8) + '" class="defm" stroke="' + c + '"/>';
      } else {
        s += '<g class="defp ' + d.job + '"><path d="' + shapePath(d.job, x, y, 12) + '" fill="' + c + '"/>' +
          '<text x="' + x + '" y="' + (y + (d.job === 'blitz' ? 7 : 4.5)) + '" class="def-label">' + d.label + '</text></g>';
      }
      if (d.job === 'blitz' && t <= 0) s += '<g transform="translate(' + (x + 13) + ',' + (y - 22) + ')"><path d="' + RAISED_HAND + '" fill="none" stroke="' + c + '" stroke-width="1.6" stroke-linecap="round"/></g>';   // hand up before the snap
    });
    return s;
  }
  function legendHTML() {
    return ['blitz', 'man', 'zone'].map(function (j) {
      return '<span class="lg-item"><svg viewBox="-14 -14 28 28" width="18" height="18"><path d="' + shapePath(j, 0, 0, 9) + '" fill="' + JOB_COLORS[j] + '"/></svg>' + JOB_NAMES[j] + (j === 'zone' ? ' (shaded area)' : '') + '</span>';
    }).join('');
  }

  function resultSVG(res, t) {
    if (!res || t < res.t) return '';
    var x = sx(res.pt[0]), y = sy(res.pt[1]);
    var txt = res.kind === 'flag' ? 'FLAG ' + (res.gain >= 0 ? '+' : '') + res.gain.toFixed(0) : res.kind === 'sack' ? 'SACK ' + res.gain.toFixed(0) : res.kind === 'td' ? 'TOUCHDOWN' : res.kind === 'int' ? 'INTERCEPTED' : res.kind === 'inc' ? 'INCOMPLETE' : '';
    if (!txt) return '';
    var tx = Math.max(60, Math.min(E.sx(W) - 60, x));
    return '<g class="result ' + res.kind + '"><circle cx="' + x + '" cy="' + y + '" r="18"/><text x="' + tx + '" y="' + (y - 24) + '">' + txt + '</text></g>';
  }

  function describe(res) {
    if (!res) return '';
    var pre = '';
    if (res.kind === 'int') return 'Intercepted by ' + res.by + ' — ' + (res.why === 'lane' ? 'he was sitting in the throwing lane' : 'he got to the spot before the receiver') + '. Look elsewhere or throw it away.';
    if (res.kind === 'inc') return 'Incomplete — ' + res.by + ' breaks it up (' + res.sep.toFixed(1) + ' yds separation). Covered; try the next read.';
    if (res.caught && res.sep != null) pre = (res.sep < 1.2 ? 'Contested catch (' : res.sep < 3 ? 'Tight window (' : 'Open (') + res.sep.toFixed(1) + ' yds separation) · ';
    return pre + describe2(res);
  }
  function describe2(res) {
    if (res.kind === 'flag') return 'Flag pulled — ' + (res.gain >= 0 ? 'gain of ' : 'loss of ') + Math.abs(res.gain).toFixed(0) + ' yds';
    if (res.kind === 'sack') return 'Sack — the blitzer gets home before the ball is out';
    if (res.kind === 'td') return 'Touchdown';
    return 'Ball carrier still running at ' + (res.gain >= 0 ? '+' : '') + res.gain.toFixed(0) + ' yds';
  }

  /* One number for "how good was this play for the offense" — used by "Best read", the quiz and anything
     else that ranks plays against a coverage, so they always agree. Higher = better for the offense. */
  function scoreResult(res) {
    if (res.kind === 'sack' || res.kind === 'int') return -9;
    if (res.kind === 'inc') return -4;
    if (res.kind === 'td') return 40;
    return res.gain + (res.sep || 0) * 2;
  }

  var api = {
    simulate: simulate, scoreResult: scoreResult, describe: describe, flipDefense: flipDefense,
    strength: strength, onText: onText, cornerLabel: cornerLabel,
    assignmentsSVG: assignmentsSVG, defendersSVG: defendersSVG, resultSVG: resultSVG, legendHTML: legendHTML, shapePath: shapePath,
    JOB_NAMES: JOB_NAMES, JOB_COLORS: JOB_COLORS
  };
  E.DEF = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
