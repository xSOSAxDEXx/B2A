/* B2A defense engine: coverage simulation against any offensive play, flag-pull / sack detection, SVG drawing.
   A defensive call is a list of defenders, each with a job:
     blitz – declared rusher from 7+ yds, rushes the QB / ball
     man   – covers one offensive role (on: 'X'|'Y'|'Z'|'C'|'QB'), inside leverage, trails him
     zone  – drops to a spot (drop) and plays any receiver who enters its radius (r)
     spy   – mirrors the QB/ball at a set depth until there's a handoff or throw
   Starting spots for man defenders are computed from the receiver's alignment; zone/blitz/spy use absolute spots. */
(function (root) {
  'use strict';
  var E = root.B2A;
  var dist = E.dist, W = E.FIELD.W;
  var DT = 0.05;
  var JOB_COLORS = { blitz: '#fb923c', man: '#f87171', zone: '#fb7185', spy: '#facc15' };

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

  /* Build the defense simulation against an offensive sim (from B2A.buildSim). */
  function simulate(defPlay, sim) {
    var P = sim.P, ballX = P.players.C.start[0];
    var defs = defPlay.defenders.map(function (d) {
      var o = E.clone(d);
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
        if (carrier) { target = sim.pos(carrier, t); speed = d.job === 'blitz' ? 6 : 7; }
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
          var react = d.job === 'zone' && d.drop[1] >= 10 ? 0.6 : 0.4;   // deep defenders read longer before driving
          if (tin > react) { if (mine) { target = cp; speed = d.job === 'zone' && d.drop[1] >= 10 ? 5.8 : 6.4; } else if (tin > 0.7) { target = cp; speed = 5; } }
        }
        var np = clampX(moveTo(d.pos, target, speed * DT));
        if (d.job !== 'blitz' && t < firstEx && np[1] < 0.3) np[1] = 0.3;  // can't cross LOS before an exchange
        d.pos = np;
      });
      frames.push(defs.map(function (d) { return d.pos.slice(); }));
      if (passEv && sep == null && t >= passEv.catchT) {
        sep = Infinity; defs.forEach(function (d) { sep = Math.min(sep, dist(d.pos, passEv.catchPt)); });
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
    if (passEv && result) { result.sep = sep; result.caught = result.kind !== 'sack' && result.t >= passEv.catchT - 0.01; }
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
        if (d.zone && !opts.faint) s += '<text x="' + sx(d.drop[0]) + '" y="' + (sy(d.drop[1]) + r * 14 - 6) + '" class="zone-name">' + d.zone + '</text>';
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

  function defendersSVG(dsim, t, opts) {
    opts = opts || {};
    var s = '';
    dsim.at(t).forEach(function (d) {
      var x = sx(d.pt[0]), y = sy(d.pt[1]), c = JOB_COLORS[d.job];
      if (opts.marks) {
        s += '<g class="defm"><path d="M' + (x - 8) + ',' + (y - 8) + ' L' + (x + 8) + ',' + (y + 8) + ' M' + (x + 8) + ',' + (y - 8) + ' L' + (x - 8) + ',' + (y + 8) + '" stroke="' + c + '"/></g>';
      } else {
        s += '<g class="defp"><rect x="' + (x - 12) + '" y="' + (y - 12) + '" width="24" height="24" rx="7" fill="' + c + '"/>' +
          '<text x="' + x + '" y="' + (y + 4.5) + '" class="def-label">' + d.label + '</text></g>';
      }
      if (d.job === 'blitz' && t <= 0) s += '<text x="' + (x + 13) + '" y="' + (y - 9) + '" class="hand">✋</text>';
    });
    return s;
  }

  function resultSVG(res, t) {
    if (!res || t < res.t) return '';
    var x = sx(res.pt[0]), y = sy(res.pt[1]);
    var txt = res.kind === 'flag' ? 'FLAG ' + (res.gain >= 0 ? '+' : '') + res.gain.toFixed(0) : res.kind === 'sack' ? 'SACK ' + res.gain.toFixed(0) : res.kind === 'td' ? 'TOUCHDOWN' : '';
    if (!txt) return '';
    return '<g class="result ' + res.kind + '"><circle cx="' + x + '" cy="' + y + '" r="18"/><text x="' + x + '" y="' + (y - 24) + '">' + txt + '</text></g>';
  }

  function describe(res) {
    if (!res) return '';
    var pre = '';
    if (res.caught && res.sep != null) pre = (res.sep < 1.2 ? 'Contested catch (' : res.sep < 3 ? 'Tight window (' : 'Open (') + res.sep.toFixed(1) + ' yds separation) · ';
    return pre + describe2(res);
  }
  function describe2(res) {
    if (res.kind === 'flag') return 'Flag pulled — ' + (res.gain >= 0 ? 'gain of ' : 'loss of ') + Math.abs(res.gain).toFixed(0) + ' yds';
    if (res.kind === 'sack') return 'Sack — the blitzer gets home before the ball is out';
    if (res.kind === 'td') return 'Touchdown';
    return 'Ball carrier still running at ' + (res.gain >= 0 ? '+' : '') + res.gain.toFixed(0) + ' yds';
  }

  var api = { simulate: simulate, flipDefense: flipDefense, assignmentsSVG: assignmentsSVG, defendersSVG: defendersSVG, resultSVG: resultSVG, describe: describe, JOB_COLORS: JOB_COLORS };
  E.DEF = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
