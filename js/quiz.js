/* Quiz: pick your position, get questions built from this week's game plan (or the whole book).
   Route questions use the real play data; "who's open" / "which call" answers come from the coverage simulation. */
(function () {
  'use strict';
  var A = window.APP, E = A.E, D = A.D, ST = A.ST, $ = A.$, $$ = A.$$, esc = A.esc;
  var root = $('#quiz-root');
  var POS = [
    ['QB', 'Quarterback', '🎯'], ['C', 'Center', '🧲'], ['X', 'X receiver', '⚡'], ['Y', 'Y receiver / back', '⚡'], ['Z', 'Z receiver', '⚡'],
    ['DEF', 'Defender (coverage)', '🛡'], ['BLITZ', 'Blitzer', '🏃']
  ];
  var Q = { pos: null, src: 'plan', n: 10, list: [], i: 0, score: 0, missed: [], answered: false, anim: null };
  var LS_BEST = 'b2a.quiz.best';

  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  /* ---------- sources ---------- */
  function planIds(side) {
    var g = ST.game();
    if (Q.src === 'plan' && g && g.plan[side].length) return g.plan[side].slice();
    return side === 'off' ? A.offPlays().filter(function (p) { return !p.shared; }).map(function (p) { return p.id; }) : A.defPlays().map(function (d) { return d.id; });
  }
  function offList() { return planIds('off').map(A.findOff).filter(Boolean); }
  function defList() { return planIds('def').map(A.findDef).filter(Boolean); }
  function pureQBPass(p) { return p.events.length === 1 && p.events[0].type === 'pass' && p.events[0].from === 'QB'; }

  /* ---------- diagrams ---------- */
  var uidN = 0;
  function formationSVG(p, role, crop) {
    var sim = E.buildSim(p), u = 'q' + (uidN++);
    var players = E.playersSVG(sim, sim.tStart, null, { showBall: false, selected: role });
    return '<svg viewBox="' + E.viewBox(crop || [-7, 14]) + '" class="field-svg">' + E.fieldSVG(sim.P, { uid: u }) + '<g class="dim-others" data-me="' + role + '">' + players + '</g></svg>';
  }
  function pathSVG(p, role, path, crop) {
    var sim = E.buildSim(p), u = 'q' + (uidN++), c = E.COLORS[role];
    var d = path.map(function (pt) { return E.sx(pt[0]).toFixed(1) + ',' + E.sy(pt[1]).toFixed(1); }).join(' ');
    return '<svg viewBox="' + E.viewBox(crop || [-7, 18]) + '" class="field-svg">' + E.fieldSVG(sim.P, { uid: u }).replace('<defs>', '<defs><marker id="qa' + u + '" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="' + c + '"/></marker>') +
      '<polyline points="' + d + '" fill="none" stroke="' + c + '" stroke-width="4" stroke-linejoin="round" marker-end="url(#qa' + u + ')"/>' +
      '<g class="dim-others" data-me="' + role + '">' + E.playersSVG(sim, sim.tStart, null, { showBall: false, selected: role }) + '</g></svg>';
  }
  function defJobText(d) {
    if (d.job === 'blitz') return 'Rush the QB from 7+ yds (hand up), straight at the throwing shoulder';
    if (d.job === 'man') return 'Man coverage on ' + d.on + ' — inside leverage, stay on his hip';
    if (d.job === 'spy') return 'Spy — mirror the ball at ' + d.start[1] + ' yds';
    var z = d.zone || 'zone';
    return 'Zone: ' + z + ' — drop to ' + Math.round(d.drop[1]) + ' yds ' + (d.drop[0] < 9 ? 'on the left' : d.drop[0] > 16 ? 'on the right' : 'in the middle');
  }

  /* ---------- question builders ---------- */
  function routeQ(p, role) {
    var sim = E.buildSim(p), start = sim.routeStart(role), pts = p.players[role] && p.players[role].route && p.players[role].route.pts;
    if (!pts || !pts.length || E.dist(start, pts[pts.length - 1]) < 3) return null;
    var right = [start].concat(pts.map(function (x) { return x.slice(); }));
    var cands = [];
    A.offPlays().forEach(function (o) {
      if (o.id === p.id || !o.players[role] || !o.players[role].route || !o.players[role].route.pts) return;
      var os = E.buildSim(o).routeStart(role), dx = start[0] - os[0], dy = start[1] - os[1];
      var pth = [start].concat(o.players[role].route.pts.map(function (q) { return [Math.max(0.5, Math.min(24.5, q[0] + dx)), q[1] + dy]; }));
      if (E.dist(pth[0], pth[pth.length - 1]) > 3) cands.push(pth);
    });
    var mirror = right.map(function (q) { return [Math.max(0.5, Math.min(24.5, 2 * start[0] - q[0])), q[1]]; });
    function differs(a, b) { var e = a[a.length - 1], f = b[b.length - 1]; return E.dist(e, f) > 3 || Math.abs(a.length - b.length) > 1; }
    var opts = [right];
    if (differs(mirror, right)) opts.push(mirror);
    shuffle(cands).forEach(function (c) { if (opts.length < 4 && opts.every(function (o) { return differs(o, c); })) opts.push(c); });
    if (opts.length < 3) return null;
    var order = shuffle(opts.map(function (o, i) { return i; }));
    var pass = p.events.filter(function (e) { return e.type === 'pass'; })[0];
    var target = pass && pass.to === role;
    return {
      kind: 'route', play: p, role: role,
      prompt: 'You’re <b>' + role + '</b> on <b>' + esc(p.name) + '</b>. Which route do you run?',
      pic: formationSVG(p, role),
      options: order.map(function (i) { return { svg: pathSVG(p, role, opts[i]), ok: i === 0 }; }),
      explain: (target ? 'You’re the primary target — the ball comes out as you hit your break. ' : '') + (p.reads ? 'Progression: ' + p.reads.join(' → ') + '.' : '')
    };
  }
  function firstReadQ(p) {
    var pass = p.events.filter(function (e) { return e.type === 'pass'; })[0]; if (!pass) return null;
    var thrower = pass.from === 'QB' ? '' : ' (' + pass.from + ' throws it after the handoff)';
    var opts = shuffle(['X', 'Y', 'Z', 'C', 'QB'].filter(function (r) { return r !== pass.from; })).slice(0, 3);
    if (opts.indexOf(pass.to) < 0) opts[0] = pass.to;
    return {
      kind: 'choice', play: p, prompt: 'Who is the designed target on <b>' + esc(p.name) + '</b>?' + thrower,
      pic: A.offSVG(p, [-7, 18], 'qf' + (uidN++)).replace(/<line[^>]*class="(pass|pitch)-line"[^>]*\/>|<circle[^>]*class="(catch-ring|break-dot)"[^>]*\/>|<polyline[^>]*class="yac"[^>]*\/>/g, ''), options: shuffle(opts).map(function (r) { return { text: r + ' — ' + E.ROLE_NAMES[r], ok: r === pass.to }; }),
      explain: 'Progression: ' + (p.reads || []).join(' → ')
    };
  }
  function timingQ(p) {
    var pass = p.events.filter(function (e) { return e.type === 'pass' && e.brk != null; })[0]; if (!pass) return null;
    var sim = E.buildSim(p), ev = sim.P.events.filter(function (e) { return e.type === 'pass'; })[0];
    return {
      kind: 'choice', play: p, prompt: 'On <b>' + esc(p.name) + '</b>, when should the ball come out to ' + pass.to + '?',
      pic: A.offSVG(p, [-7, 18], 'qt' + (uidN++)),
      options: shuffle([
        { text: 'As ' + pass.to + ' plants for his break (~' + ev.t.toFixed(1) + 's) — ball meets him in stride', ok: true },
        { text: 'When ' + pass.to + ' reaches the end of his route and turns around', ok: false },
        { text: 'Hold it until the blitzer commits, then throw', ok: false },
        { text: 'Right after the snap, before he makes his cut', ok: false }
      ]),
      explain: 'Throw on the break. Every beat you wait lets the defender close — and a blitzer from 7 yds arrives in about 2 seconds.'
    };
  }
  function whosOpenQ(p, def) {
    if (!pureQBPass(p)) return null;
    var res = [];
    ['X', 'Y', 'Z', 'C'].forEach(function (r) {
      var pts = p.players[r] && p.players[r].route && p.players[r].route.pts; if (!pts || !pts.length) return;
      var q = E.clone(p); var brk = pts[0][1] < 1 && pts.length > 1 ? 1 : 0;
      q.events = [{ type: 'pass', from: 'QB', to: r, brk: brk }];
      var sim = E.buildSim(q); var ev = sim.P.events[0]; if (!ev.catchPt || ev.catchPt[1] <= 0.5) return;
      var out = D.simulate(def, sim).result; if (out.kind === 'sack') return;
      res.push({ r: r, sep: out.sep || 0, gain: out.gain });
    });
    if (res.length < 3) return null;
    res.sort(function (a, b) { return b.sep - a.sep; });
    if (res[0].sep - res[1].sep < 1 || res[0].sep < 2) return null;
    return {
      kind: 'choice', play: p, def: def, prompt: 'Running <b>' + esc(p.name) + '</b> against <b>' + esc(def.name) + '</b>. Who should be open?',
      pic: A.defSVG(def, p.id, [-7, 18], 'qo' + (uidN++)), options: shuffle(res.slice(0, 4)).map(function (x) { return { text: x.r + ' — ' + E.ROLE_NAMES[x.r], ok: x.r === res[0].r }; }),
      explain: res[0].r + ' gets about ' + res[0].sep.toFixed(1) + ' yds of separation vs ' + def.name + ' (next best ' + res[1].r + ' at ' + res[1].sep.toFixed(1) + '). ' + def.weaknesses,
      anim: { off: (function () { var q = E.clone(p); q.events = [{ type: 'pass', from: 'QB', to: res[0].r, brk: (p.players[res[0].r].route.pts[0][1] < 1 && p.players[res[0].r].route.pts.length > 1) ? 1 : 0 }]; return q; })(), def: def, mode: 'off' }
    };
  }
  function beatCoverageQ(def, offs) {
    var scored = offs.filter(pureQBPass).map(function (p) { var r = D.simulate(def, E.buildSim(p)).result; return { p: p, s: r.kind === 'sack' ? -9 : (r.sep || 0) * 2 + r.gain / 4 + (r.kind === 'td' ? 5 : 0), r: r }; });
    if (scored.length < 3) return null;
    scored.sort(function (a, b) { return b.s - a.s; });
    if (scored[0].s - scored[1].s < 1.5) return null;
    var opts = [scored[0]].concat(shuffle(scored.slice(1)).slice(0, 3));
    return {
      kind: 'choice', prompt: 'They’re in <b>' + esc(def.name) + '</b> (' + esc(def.front) + '). Which of our plays attacks it best?',
      pic: A.defSVG(def, scored[0].p.id, [-7, 18], 'qb' + (uidN++)).replace(/<g class="ghost-off">[\s\S]*?<\/g>/, ''),
      options: shuffle(opts).map(function (x) { return { text: x.p.name, ok: x === scored[0] }; }),
      explain: scored[0].p.name + ': ' + D.describe(scored[0].r) + '. ' + def.name + ' weakness — ' + def.weaknesses,
      anim: { off: scored[0].p, def: def, mode: 'off' }
    };
  }
  function bestCallQ(off, defs) {
    if (defs.length < 3) return null;
    var scored = defs.map(function (d) { var r = D.simulate(d, E.buildSim(off)).result; return { d: d, s: r.kind === 'sack' ? -6 : r.kind === 'td' ? 40 : r.gain + (r.sep || 0) * 2, r: r }; });
    scored.sort(function (a, b) { return a.s - b.s; });
    if (scored[1].s - scored[0].s < 2) return null;
    var opts = [scored[0]].concat(shuffle(scored.slice(1)).slice(0, 3));
    return {
      kind: 'choice', play: off, prompt: 'They line up and run <b>' + esc(off.name) + '</b>. Which of our calls stops it best?',
      pic: A.offSVG(off, [-7, 18], 'qc' + (uidN++)), options: shuffle(opts).map(function (x) { return { text: x.d.name + ' — ' + x.d.front, ok: x === scored[0] }; }),
      explain: scored[0].d.name + ' → ' + D.describe(scored[0].r) + '. ' + scored[0].d.strengths,
      anim: { off: off, def: scored[0].d, mode: 'def' }
    };
  }
  function assignmentQ(def, wantBlitz) {
    var mine = def.defenders.filter(function (d) { return wantBlitz ? d.job === 'blitz' : d.job !== 'blitz'; });
    if (!mine.length) return null;
    var me = pick(mine);
    var pool = [];
    A.defPlays().forEach(function (o) { o.defenders.forEach(function (d) { var t = defJobText(d); if (pool.indexOf(t) < 0) pool.push(t); }); });
    var right = defJobText(me);
    var opts = [right].concat(shuffle(pool.filter(function (t) { return t !== right; })).slice(0, 3));
    return {
      kind: 'choice', prompt: 'We call <b>' + esc(def.name) + '</b>. You’re <b>' + esc(me.label) + '</b>. What’s your job?',
      pic: A.defSVG(def, def.vs, [-7, 18], 'qa' + (uidN++)).replace('class="def-label">' + me.label + '<', 'class="def-label me">' + me.label + '<'),
      options: shuffle(opts).map(function (t) { return { text: t, ok: t === right }; }),
      explain: def.keys.join(' · '), anim: { off: A.findOff(def.vs), def: def, mode: 'def' }
    };
  }
  var RULES = [
    { who: 'all', q: 'How many downs do we get to cross midfield?', a: '3', w: ['4', '2', 'Unlimited'] },
    { who: 'all', q: 'After a turnover on downs, where does the other team start?', a: 'Their own 5-yard line', w: ['At the spot of the ball', 'Midfield', 'Their own 10'] },
    { who: 'all', q: 'The ball is inside 5 yards of midfield. Can we run?', a: 'No — pass plays only (no-run zone)', w: ['Yes, any run', 'Only a QB run', 'Only after a handoff'] },
    { who: 'off', q: 'Which player can NOT take a handoff?', a: 'The center', w: ['The QB (after giving it)', 'Any receiver', 'The Y back'] },
    { who: 'off', q: 'Teammates near the ball carrier should…', a: 'Stop and stay out of the way — no blocking or screening', w: ['Run alongside to shield him', 'Block the nearest defender', 'Hold the defender’s flag'] },
    { who: 'qb', q: 'How long does the QB have to throw or hand off?', a: '7 seconds', w: ['5 seconds', '10 seconds', 'Until the blitzer arrives'] },
    { who: 'qb', q: 'After a handoff, the 7-second clock…', a: 'Turns off — but every defender can now rush', w: ['Resets to 7', 'Keeps running', 'Drops to 3 seconds'] },
    { who: 'qb', q: 'Can the QB run the ball across the line?', a: 'Only after he gets it back on a handoff or pitch', w: ['Yes, any time', 'Only on 3rd down', 'Only in the red zone'] },
    { who: 'qb', q: 'A 1-point try is from the…', a: '5-yard line, pass only', w: ['10-yard line, run or pass', '3-yard line', '5-yard line, run or pass'] },
    { who: 'blitz', q: 'How far off the line must a blitzer start?', a: 'At least 7 yards, hand raised before the snap', w: ['5 yards', 'Anywhere if his hand is up', '10 yards'] },
    { who: 'blitz', q: 'How many blitzers can rush on one play?', a: 'Two', w: ['One', 'Three', 'Unlimited'] },
    { who: 'blitz', q: 'When can a NON-blitzer cross the line of scrimmage?', a: 'After a handoff, pitch or pass', w: ['At the snap', 'After 3 seconds', 'Never'] },
    { who: 'blitz', q: 'Where should the blitzer aim?', a: 'At the QB’s throwing shoulder', w: ['At the center', 'At the QB’s feet', 'Wide, to contain'] },
    { who: 'blitz', q: 'You reach the QB and swat the ball, then bump his arm. Result?', a: 'Roughing the passer: +10 and an automatic first down', w: ['Legal play', 'Loss of down for them', 'A sack'] },
    { who: 'def', q: 'Pulling a flag before the receiver has the ball is…', a: 'Illegal flag pull: +5 from the spot', w: ['Legal if the ball is in the air', 'A sack', 'No penalty'] },
    { who: 'def', q: 'In zone, two receivers enter your area. You…', a: 'Split the difference and play the throw', w: ['Follow the first one deep', 'Rush the QB', 'Stay at your drop spot no matter what'] },
    { who: 'def', q: 'Once the ball is caught, every defender…', a: 'Takes an angle to where the carrier is going', w: ['Stays in his zone', 'Runs at where the carrier is now', 'Returns to the line'] },
    { who: 'all', q: 'How many timeouts do we get per half?', a: 'One', w: ['Two', 'Three', 'None'] }
  ];
  function rulesQs(who) {
    return RULES.filter(function (r) { return r.who === 'all' || r.who === who || (who === 'qb' && r.who === 'off') || (who === 'off' && r.who === 'off'); }).map(function (r) {
      return { kind: 'choice', prompt: r.q, options: shuffle([{ text: r.a, ok: true }].concat(r.w.map(function (w) { return { text: w, ok: false }; }))), explain: 'Rule: ' + r.a + '.' };
    });
  }

  function build() {
    var pos = Q.pos, offs = offList(), defs = defList(), qs = [];
    function add(q) { if (q) qs.push(q); }
    if (['X', 'Y', 'Z', 'C'].indexOf(pos) >= 0) {
      shuffle(offs).forEach(function (p) { add(routeQ(p, pos)); });
      shuffle(defs).slice(0, 3).forEach(function (d) { add(beatCoverageQ(d, offs)); });
      shuffle(offs).slice(0, 2).forEach(function (p) { add(firstReadQ(p)); });
      qs = shuffle(qs).slice(0, Q.n - 2).concat(shuffle(rulesQs('off')).slice(0, 2));
    } else if (pos === 'QB') {
      shuffle(offs).forEach(function (p) { add(firstReadQ(p)); });
      shuffle(offs).slice(0, 3).forEach(function (p) { add(timingQ(p)); });
      var allDefs = A.defPlays();
      shuffle(offs).slice(0, 8).forEach(function (p) { add(whosOpenQ(p, pick(defs.length ? defs : allDefs))); });
      shuffle(allDefs).slice(0, 4).forEach(function (d) { add(beatCoverageQ(d, offs)); });
      qs = shuffle(qs).slice(0, Q.n - 2).concat(shuffle(rulesQs('qb')).slice(0, 2));
    } else {
      var blitz = pos === 'BLITZ';
      var pool = defs.length ? defs : A.defPlays();
      shuffle(pool).forEach(function (d) { add(assignmentQ(d, blitz)); });
      shuffle(offs).slice(0, 6).forEach(function (o) { add(bestCallQ(o, pool.length >= 3 ? pool : A.defPlays())); });
      qs = shuffle(qs).slice(0, Q.n - 3).concat(shuffle(rulesQs(blitz ? 'blitz' : 'def')).slice(0, 3));
    }
    return shuffle(qs).slice(0, Q.n);
  }

  /* ---------- UI ---------- */
  function setup() {
    stopAnim();
    var g = ST.game(), hasPlan = g && (g.plan.off.length || g.plan.def.length);
    var best = {}; try { best = JSON.parse(localStorage.getItem(LS_BEST) || '{}'); } catch (e) { }
    root.innerHTML = '<div class="quiz-setup card"><h2>Quiz</h2><p class="hint">Pick your position. Questions come from ' + (hasPlan ? 'the <b>' + esc(g.opp) + '</b> game plan' : 'the playbook') + ' — where you go, who’s open, what to call.</p>' +
      '<div class="pos-grid">' + POS.map(function (p) { return '<button class="pos" data-pos="' + p[0] + '"><span>' + p[2] + '</span><b>' + p[1] + '</b>' + (best[p[0]] ? '<small>Best ' + best[p[0]] + '%</small>' : '') + '</button>'; }).join('') + '</div>' +
      '<div class="dd-row"><label class="dd"><span>Questions from</span><select id="qz-src"><option value="plan"' + (hasPlan ? '' : ' disabled') + '>This week’s game plan' + (hasPlan ? ' (vs ' + esc(g.opp) + ')' : ' — none yet') + '</option><option value="all">Whole playbook</option></select></label>' +
      '<label class="dd"><span>Length</span><select id="qz-n"><option>5</option><option selected>10</option><option>15</option></select></label></div></div>';
    $('#qz-src').value = hasPlan ? Q.src : 'all';
    root.querySelector('.pos-grid').addEventListener('click', function (e) {
      var b = e.target.closest('.pos'); if (!b) return;
      Q.pos = b.dataset.pos; Q.src = $('#qz-src').value; Q.n = +$('#qz-n').value;
      Q.list = build(); Q.i = 0; Q.score = 0; Q.missed = [];
      if (!Q.list.length) { A.toast('Not enough plays in the plan for this position yet — try “Whole playbook”.'); return; }
      showQ();
    });
  }
  function stopAnim() { if (Q.anim) { Q.anim.stop(); Q.anim = null; } }
  function showQ() {
    stopAnim(); Q.answered = false;
    var q = Q.list[Q.i], posName = POS.filter(function (p) { return p[0] === Q.pos; })[0][1];
    root.innerHTML = '<div class="quiz card"><div class="qz-top"><span>' + esc(posName) + '</span><span>Question ' + (Q.i + 1) + ' / ' + Q.list.length + ' · Score ' + Q.score + '</span><button class="btn ghost small" id="qz-quit">Quit</button></div>' +
      '<div class="qz-bar"><i style="width:' + (100 * Q.i / Q.list.length) + '%"></i></div>' +
      '<h2 class="qz-prompt">' + q.prompt + '</h2>' + (q.pic ? '<div class="qz-pic">' + q.pic + '</div>' : '') +
      '<div class="qz-opts ' + (q.kind === 'route' ? 'pics' : '') + '">' + q.options.map(function (o, i) {
        return '<button class="qz-opt" data-i="' + i + '">' + (o.svg ? '<span class="lbl">' + String.fromCharCode(65 + i) + '</span>' + o.svg : esc(o.text)) + '</button>';
      }).join('') + '</div><div class="qz-feedback" id="qz-fb"></div></div>';
    $('#qz-quit').addEventListener('click', setup);
    root.querySelector('.qz-opts').addEventListener('click', answer);
  }
  function answer(e) {
    var b = e.target.closest('.qz-opt'); if (!b || Q.answered) return;
    Q.answered = true;
    var q = Q.list[Q.i], o = q.options[+b.dataset.i];
    if (o.ok) Q.score++; else Q.missed.push(q);
    $$('.qz-opt', root).forEach(function (x, i) { x.classList.add(q.options[i].ok ? 'right' : (x === b ? 'wrong' : 'dim')); });
    var animSrc = q.anim || (q.play ? { off: q.play, def: null, mode: 'off' } : null);
    $('#qz-fb').innerHTML = '<div class="verdict ' + (o.ok ? 'good' : 'bad') + '">' + (o.ok ? '✓ Correct' : '✕ Not quite') + '</div><p>' + esc(q.explain || '') + '</p>' +
      (animSrc ? '<div class="field-wrap qz-anim"><svg class="field-svg" id="qz-field"></svg></div>' : '') +
      '<button class="btn primary" id="qz-next">' + (Q.i + 1 < Q.list.length ? 'Next question →' : 'See results') + '</button>';
    if (animSrc) { Q.anim = new A.Animator($('#qz-field')); Q.anim.speed = 0.6; Q.anim.load(animSrc.off, animSrc.def, animSrc.mode); Q.anim.start(); }
    $('#qz-next').addEventListener('click', function () { Q.i++; if (Q.i < Q.list.length) showQ(); else finish(); });
  }
  function finish() {
    stopAnim();
    var p = Math.round(100 * Q.score / Q.list.length);
    var best = {}; try { best = JSON.parse(localStorage.getItem(LS_BEST) || '{}'); } catch (e) { }
    if (!best[Q.pos] || p > best[Q.pos]) { best[Q.pos] = p; try { localStorage.setItem(LS_BEST, JSON.stringify(best)); } catch (e) { } }
    root.innerHTML = '<div class="quiz card done"><h2>' + Q.score + ' / ' + Q.list.length + ' <small>(' + p + '%)</small></h2><p>' + (p >= 90 ? 'Game ready. 🔥' : p >= 70 ? 'Solid — review the misses below.' : 'Spend some time in the Plays tab, then run it back.') + '</p>' +
      (Q.missed.length ? '<h3>Review</h3><ul class="missed">' + Q.missed.map(function (q) { return '<li><b>' + q.prompt.replace(/<[^>]+>/g, '') + '</b><br><span class="muted">' + esc(q.explain || '') + '</span>' + (q.play ? ' <a href="#" data-open="' + esc(q.play.id) + '">Open play</a>' : '') + '</li>'; }).join('') + '</ul>' : '') +
      '<div class="series-actions"><button class="btn primary" id="qz-again">Run it back</button><button class="btn" id="qz-other">Change position</button></div></div>';
    $('#qz-again').addEventListener('click', function () { Q.list = build(); Q.i = 0; Q.score = 0; Q.missed = []; showQ(); });
    $('#qz-other').addEventListener('click', setup);
    root.addEventListener('click', function (e) { var a = e.target.closest('[data-open]'); if (a) { e.preventDefault(); A.openPlay(a.dataset.open, 'off'); } });
  }
  A.tabHooks.quiz = function () { if (!Q.list.length || Q.i >= Q.list.length || !root.innerHTML) setup(); };
})();
