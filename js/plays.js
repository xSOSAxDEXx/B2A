/* B2A offensive playbook.
   Coordinates in yards: x 0..25 sideline to sideline (ball/center at 12.5), y 0 = line of scrimmage, + downfield.
   Route "pts" are waypoints after the player's start spot.
   events: ball exchanges after the snap (the snap always goes C -> QB).
     pass  { from, to, brk }  -> QB throws the moment the receiver reaches route point #brk (his break; 0 = first point)
                                 and the ball meets him in stride. Use { t } instead of brk for a fixed throw time.
     handoff / pitch { from, to, t }
   cat: playbook section. ytg: yards to goal (red zone / PAT). ytm: yards to midfield (midfield no-run zone).
   Add plays in the Designer tab; team plays published from Game Day are stored in data/season.json. */
var B2A_CATS = [
  ['quick', 'Quick game'], ['dropback', 'Dropback & zone beaters'], ['man', 'Man beaters'], ['center', 'Center plays'],
  ['trick', 'Trick plays'], ['run', 'Runs'], ['midfield', 'Midfield no-run zone'], ['redzone', 'Red zone & PAT']
];
var B2A_PLAYS = [
  /* ================= QUICK GAME (ball out by ~1.5s — first answer to a blitzer) ================= */
  {
    id: 'slant-flat', cat: 'quick', name: 'Slant Flat', formation: 'spread', tags: ['pass', 'quick', 'vs-blitz', 'vs-man', 'short-yardage'],
    players: {
      X: { route: { pts: [[2, 3], [7, 7], [9, 9]] } },
      Y: { route: { pts: [[5, 1], [1, 2.5]] } },
      Z: { route: { pts: [[23, 4], [24.4, 4]] } },
      C: { route: { pts: [[12.5, 4.5], [12, 4.5]], delay: 0.3 } },
      QB: { route: { pts: [[12.5, -5.5]] } }
    },
    events: [{ type: 'pass', from: 'QB', to: 'X', brk: 0 }],
    reads: ['C hook — if the rusher came, he’s open where the rusher left', 'X slant (throw on his 3rd step)', 'Y flat', 'Z quick out'],
    notes: 'One-step throw. Our default call vs Cover 0 / a hand-up blitzer. X must win inside leverage on the break.'
  },
  {
    id: 'hot-outs', cat: 'quick', name: 'Hot Outs', formation: 'spread', tags: ['pass', 'quick', 'vs-blitz', 'sideline', 'two-minute'],
    players: {
      X: { route: { pts: [[2, 4.5], [0.7, 4.5]] } },
      Y: { route: { pts: [[7, 5], [7.5, 4.5]] } },
      Z: { route: { pts: [[23, 4.5], [24.3, 4.5]] } },
      C: { route: { pts: [[14, 1.5], [21, 2.5]], delay: 0.3 } },
      QB: { route: { pts: [[12.5, -5.5]] } }
    },
    events: [{ type: 'pass', from: 'QB', to: 'X', brk: 0 }],
    reads: ['Pick a side pre-snap: X out or Z out', 'Y hitch', 'C flat'],
    notes: 'Two-minute call. Catch, turn upfield one step, get out of bounds to stop the clock.'
  },
  {
    id: 'stick', cat: 'quick', name: 'Stick', formation: 'trips', tags: ['pass', 'quick', 'third-down', 'short-yardage', 'vs-zone'],
    players: {
      X: { route: { pts: [[23.5, 6], [22.5, 18]] } },
      Z: { route: { pts: [[20, 5.5], [19, 5.5]] } },
      Y: { route: { pts: [[18, 0.5], [23, 2]] } },
      C: { route: { pts: [[12.5, 3], [8, 7]], delay: 0.3 } },
      QB: { route: { pts: [[12.5, -5.5]] } }
    },
    events: [{ type: 'pass', from: 'QB', to: 'Z', brk: 0 }],
    reads: ['Read the flat defender: he widens → Z stick, he sits → Y flat', 'X fade if they press', 'C backside slant'],
    notes: 'Z sits at 5–6 and turns away from the nearest defender — a sit, not a curl. Reliable in any no-run zone.'
  },
  {
    id: 'snag', cat: 'quick', name: 'Snag', formation: 'bunch', tags: ['pass', 'quick', 'vs-zone', 'vs-man', 'third-down'],
    players: {
      X: { route: { pts: [[22, 5], [24, 11]] } },
      Z: { route: { pts: [[20, 5], [18.5, 5.5]] } },
      Y: { route: { pts: [[20, 0.3], [24, 1]] } },
      C: { route: { pts: [[12.5, 5], [9, 11]], delay: 0.3 } },
      QB: { route: { pts: [[12.5, -5.5]] } }
    },
    events: [{ type: 'pass', from: 'QB', to: 'Z', brk: 0 }],
    reads: ['Triangle: X corner (high) → Z snag (middle) → Y flat (low)', 'C backside post'],
    notes: 'The bunch release gives free traffic vs man — run your route, never stop in a defender’s path (screening).'
  },

  /* ================= DROPBACK & ZONE BEATERS ================= */
  {
    id: 'smash', cat: 'dropback', name: 'Smash', formation: 'spread', tags: ['pass', 'intermediate', 'vs-zone', 'cover-2'],
    players: {
      X: { route: { pts: [[2, 5], [2.5, 4.5]] } },
      Y: { route: { pts: [[7, 7], [2.5, 13]] } },
      Z: { route: { pts: [[23, 3], [18, 7]] } },
      C: { route: { pts: [[14, 1], [20, 2]], delay: 0.3 } },
      QB: { route: { pts: [[12.5, -6.5]] } }
    },
    events: [{ type: 'pass', from: 'QB', to: 'Y', brk: 0 }],
    reads: ['Corner defender: sinks with Y → X hitch, jumps the hitch → Y corner', 'Z slant (hot vs blitz)', 'C flat'],
    notes: 'High-low on one defender. Best vs Cover 2 — the corner route lands in the hole between the corner and safety.'
  },
  {
    id: 'flood', cat: 'dropback', name: 'Flood Rollout', formation: 'trips', tags: ['pass', 'intermediate', 'vs-zone', 'rollout', 'cover-3'],
    players: {
      X: { route: { pts: [[23.5, 8], [23.5, 20]] } },
      Z: { route: { pts: [[20, 8], [24, 8.5]] } },
      Y: { route: { pts: [[18, 1], [24, 2.5]] } },
      C: { route: { pts: [[12.5, 3], [5, 6]], delay: 0.4 } },
      QB: { route: { pts: [[17, -4.5]], speed: 4 } }
    },
    events: [{ type: 'pass', from: 'QB', to: 'Z', brk: 0 }],
    reads: ['Z out at 8 (high-low the flat defender)', 'Y flat', 'X go clears the deep third', 'C drag backside'],
    notes: 'QB rolls toward the flood and away from the blitzer — square the shoulders before throwing. Kills Cover 3.'
  },
  {
    id: 'levels', cat: 'dropback', name: 'Drive / Levels', formation: 'trips', tags: ['pass', 'intermediate', 'third-down', 'vs-zone'],
    players: {
      X: { route: { pts: [[23.5, 9], [19, 17]] } },
      Z: { route: { pts: [[20, 9], [10, 9]] } },
      Y: { route: { pts: [[16, 2], [5, 2.5]] } },
      C: { route: { pts: [[12.5, 12]], delay: 0.4 } },
      QB: { route: { pts: [[12.5, -6.5]] } }
    },
    events: [{ type: 'pass', from: 'QB', to: 'Z', brk: 0 }],
    reads: ['Middle defender: drops → Y shallow, sits → Z dig', 'X post if the safety jumps the dig', 'C seam'],
    notes: 'High-low the hook defender. Stem the dig past the line to gain on 3rd down.'
  },
  {
    id: 'curl-flat', cat: 'dropback', name: 'Curl Flat', formation: 'gun', tags: ['pass', 'intermediate', 'vs-zone'],
    players: {
      X: { route: { pts: [[2, 9], [3, 8]] } },
      Y: { route: { pts: [[19, -3], [23, 1]] } },
      Z: { route: { pts: [[23, 9], [22, 8]] } },
      C: { route: { pts: [[12.5, 6], [12.5, 13]], delay: 0.3 } },
      QB: { route: { pts: [[12.5, -6.5]] } }
    },
    events: [{ type: 'pass', from: 'QB', to: 'X', brk: 0 }],
    reads: ['X curl', 'Z curl (other side)', 'Y swing (check-down)', 'C seam'],
    notes: 'Both outside WRs curl at 9 and work back to the QB. The ball is out as they turn.'
  },
  {
    id: 'four-verts', cat: 'dropback', name: 'Four Verts', formation: 'trips', tags: ['pass', 'deep', 'vs-zone', 'cover-2'],
    players: {
      X: { route: { pts: [[23.5, 8], [23.5, 20]] } },
      Z: { route: { pts: [[18, 6], [18, 20]] } },
      Y: { route: { pts: [[15, 7], [9, 18]] } },
      C: { route: { pts: [[12.5, 5], [11, 5]], delay: 0.3 } },
      QB: { route: { pts: [[12.5, -7]] } }
    },
    events: [{ type: 'pass', from: 'QB', to: 'Y', brk: 0 }],
    reads: ['Y bender away from the deep middle defender', 'Z seam (vs Cover 2, split the safeties)', 'X go', 'C hook vs blitz'],
    notes: 'Shot play on 1st down. Outside receivers stay 3 yds off the sideline so there’s room to drop it in.'
  },
  {
    id: 'post-wheel', cat: 'dropback', name: 'Post Wheel', formation: 'spread', tags: ['pass', 'deep', 'vs-zone', 'cover-2', 'vs-man'],
    players: {
      X: { route: { pts: [[2, 8], [8, 15]] } },
      Y: { route: { pts: [[4, 1], [2, 6], [2, 18]] } },
      Z: { route: { pts: [[23, 10], [24, 8.5]] } },
      C: { route: { pts: [[12.5, 6], [12, 6]], delay: 0.7 } },
      QB: { route: { pts: [[12.5, -6.5]] } }
    },
    events: [{ type: 'pass', from: 'QB', to: 'Y', brk: 1 }],
    reads: ['Deep defender takes the post → Y wheel, sits on the wheel → X post', 'Z comeback', 'C delay sit (check-down)'],
    notes: 'Scissors concept. Throw the wheel as Y turns up the sideline — lead him, don’t hang it.'
  },
  {
    id: 'y-cross', cat: 'dropback', name: 'Y Cross', formation: 'spread', tags: ['pass', 'intermediate', 'vs-man', 'vs-zone', 'third-down'],
    players: {
      X: { route: { pts: [[2, 8], [2.5, 20]] } },
      Y: { route: { pts: [[8, 7], [19, 11]] } },
      Z: { route: { pts: [[23, 8], [22, 7]] } },
      C: { route: { pts: [[11, 1], [4, 2]], delay: 0.3 } },
      QB: { route: { pts: [[12.5, -6.5]] } }
    },
    events: [{ type: 'pass', from: 'QB', to: 'Y', brk: 0 }],
    reads: ['Y deep cross (catch on the run in front of Z)', 'Z curl', 'C flat (check-down)', 'X go clears'],
    notes: 'X runs the deep defender off; Y crosses underneath him into the space Z’s curl holds open.'
  },

  /* ================= MAN BEATERS ================= */
  {
    id: 'mesh', cat: 'man', name: 'Mesh', formation: 'spread', tags: ['pass', 'intermediate', 'vs-man', 'third-down', 'short-yardage'],
    players: {
      X: { route: { pts: [[3, 2], [20, 2.5]] } },
      Z: { route: { pts: [[22, 5], [5, 5]] } },
      Y: { route: { pts: [[4, 1], [2, 6], [2, 18]] } },
      C: { route: { pts: [[12.5, 7], [12, 7]], delay: 0.5 } },
      QB: { route: { pts: [[12.5, -6]] } }
    },
    events: [{ type: 'pass', from: 'QB', to: 'Z', brk: 0 }],
    reads: ['Crosser running away from his man (Z high / X low)', 'C sit behind them', 'Y wheel deep'],
    notes: 'Best 3rd-and-short call. Crossers pass close but NEVER touch or stop in a defender’s path — that’s screening (−10, loss of down). Vs zone, crossers settle in windows.'
  },
  {
    id: 'bunch-switch', cat: 'man', name: 'Bunch Switch', formation: 'bunch', tags: ['pass', 'intermediate', 'vs-man'],
    players: {
      Z: { route: { pts: [[20, 5], [15, 9]] } },
      Y: { route: { pts: [[18.5, 1], [23.5, 3]] } },
      X: { route: { pts: [[22, 6], [24, 14]] } },
      C: { route: { pts: [[12.5, 4], [6, 6]], delay: 0.3 } },
      QB: { route: { pts: [[12.5, -6]] } }
    },
    events: [{ type: 'pass', from: 'QB', to: 'Z', brk: 0 }],
    reads: ['Z slant inside', 'Y flat', 'X corner', 'C drag backside'],
    notes: 'Release cleanly — the traffic is legal only if each receiver runs his own route at full speed.'
  },
  {
    id: 'stack-switch', cat: 'man', name: 'Stack Switch', formation: 'stackR', tags: ['pass', 'intermediate', 'vs-man', 'third-down'],
    players: {
      Y: { route: { pts: [[20, 3], [20, 6], [24, 6]] } },
      Z: { route: { pts: [[22.5, 4], [22, 9], [24.3, 13]] } },
      X: { route: { pts: [[2, 8], [11, 8]] } },
      C: { route: { pts: [[11, 1], [5, 2]], delay: 0.3 } },
      QB: { route: { pts: [[12.5, -6]] } }
    },
    events: [{ type: 'pass', from: 'QB', to: 'Y', brk: 1 }],
    reads: ['Y out (released inside)', 'Z corner (released outside)', 'X dig backside', 'C flat'],
    notes: 'Front man goes in, back man goes out — paths cross at the line and man defenders have to switch. Legal because each runs his own route.'
  },

  /* ================= CENTER PLAYS ================= */
  {
    id: 'center-hot', cat: 'center', name: 'Center Hot', formation: 'spread', tags: ['pass', 'quick', 'vs-blitz', 'short-yardage', 'third-down'],
    players: {
      X: { route: { pts: [[2, 4], [6, 8]] } },
      Z: { route: { pts: [[23, 4], [19, 8]] } },
      Y: { route: { pts: [[7, 6], [7, 18]] } },
      C: { route: { pts: [[12.5, 5], [12.5, 5.5]], delay: 0.5, speed: 5 } },
      QB: { route: { pts: [[12.5, -5.5]] } }
    },
    events: [{ type: 'pass', from: 'QB', to: 'C', brk: 0 }],
    reads: ['C delay — settles exactly where the blitzer started', 'X slant', 'Z slant', 'Y seam'],
    notes: 'C snaps, counts one, then sits at 5 facing the QB with hands up. When the rusher comes, that spot is empty.'
  },
  {
    id: 'center-seam', cat: 'center', name: 'Center Seam', formation: 'spread', tags: ['pass', 'deep', 'cover-2', 'vs-zone'],
    players: {
      X: { route: { pts: [[2, 8], [2.5, 20]] } },
      Z: { route: { pts: [[23, 8], [22.5, 20]] } },
      Y: { route: { pts: [[5, 1], [1, 2.5]] } },
      C: { route: { pts: [[12.5, 7], [12.5, 18]], delay: 0.2 } },
      QB: { route: { pts: [[12.5, -6.5]] } }
    },
    events: [{ type: 'pass', from: 'QB', to: 'C', brk: 0 }],
    reads: ['C seam between the two deep safeties', 'X / Z go (whichever safety cheats inside)', 'Y flat'],
    notes: 'Defenses put their slowest player on the center. Outside gos hold the safeties wide; C splits them.'
  },
  {
    id: 'center-throwback', cat: 'center', name: 'Center Throwback', formation: 'trips', tags: ['pass', 'trick', 'rollout', 'vs-zone'],
    players: {
      X: { route: { pts: [[23.5, 8], [23.5, 20]] } },
      Z: { route: { pts: [[20, 8], [24, 8.5]] } },
      Y: { route: { pts: [[18, 1], [24, 2.5]] } },
      C: { route: { pts: [[13, 1.5], [4, 2.5], [3, 12]], delay: 0.6 } },
      QB: { route: { pts: [[16.5, -4.5], [15.5, -4.5]], speed: 4 } }
    },
    events: [{ type: 'pass', from: 'QB', to: 'C', brk: 1 }],
    reads: ['C throwback up the left sideline', 'Z out', 'Y flat'],
    notes: 'Looks exactly like Flood Rollout. Call it after the defense has seen Flood — everyone flows right, C leaks back left.'
  },

  /* ================= TRICK (handoff first: 7-sec clock off, everyone can rush) ================= */
  {
    id: 'hb-pass', cat: 'trick', name: 'Halfback Pass', formation: 'gun', tags: ['pass', 'trick', 'deep'],
    players: {
      Y: { route: { pts: [[12.5, -5.8], [6, -4]], speed: 5 } },
      QB: { route: { pts: [[19, -2], [24, 3]], delay: 0.8, speed: 6 } },
      Z: { route: { pts: [[23, 10], [15, 20]] } },
      X: { route: { pts: [[2, 6], [4, 5]] } },
      C: { route: { pts: [[12.5, 3], [18, 4]], delay: 0.3 } }
    },
    events: [{ t: 0.6, type: 'handoff', from: 'QB', to: 'Y' }, { type: 'pass', from: 'Y', to: 'Z', brk: 0 }],
    reads: ['Z post deep', 'QB leaking to the flat', 'X curl'],
    notes: 'Sell the run. Y throws on the run — if Z is covered, hit the QB leaking out.'
  },
  {
    id: 'qb-throwback', cat: 'trick', name: 'QB Throwback', formation: 'gun', tags: ['pass', 'trick'],
    players: {
      Y: { route: { pts: [[13, -5.4], [20, -3], [21, -3]], speed: 5 } },
      QB: { route: { pts: [[8, -1], [5, 6], [5, 16]], delay: 0.7, speed: 6.5 } },
      X: { route: { pts: [[2, 8], [2, 20]] } },
      Z: { route: { pts: [[23, 6], [21, 5]] } },
      C: { route: { pts: [[16, 5]], delay: 0.3 } }
    },
    events: [{ t: 0.5, type: 'handoff', from: 'QB', to: 'Y' }, { type: 'pass', from: 'Y', to: 'QB', brk: 1 }],
    reads: ['QB wheel up the left side', 'Z curl', 'C hook'],
    notes: 'After the handoff the QB is an eligible receiver. Defenses almost never cover him.'
  },
  {
    id: 'flea-flicker', cat: 'trick', name: 'Flea Flicker', formation: 'gun', tags: ['pass', 'trick', 'deep'],
    players: {
      Y: { route: { pts: [[13, -5.4], [13, -2]], speed: 5 } },
      QB: { route: { pts: [[12.5, -7]], delay: 0.6, speed: 3 } },
      X: { route: { pts: [[2, 6], [2.5, 6], [2, 22]], speed: 6.5 } },
      Z: { route: { pts: [[23, 9], [17, 17]] } },
      C: { route: { pts: [[12.5, 12]], delay: 0.3 } }
    },
    events: [
      { t: 0.45, type: 'handoff', from: 'QB', to: 'Y' },
      { t: 1.3, type: 'pitch', from: 'Y', to: 'QB' },
      { type: 'pass', from: 'QB', to: 'X', brk: 1 }
    ],
    reads: ['X stutter-go', 'Z post', 'C seam'],
    notes: 'Y pitches BACK to the QB while still behind the line. After the handoff every defender can rush — get it out fast.'
  },
  {
    id: 'sweep-return', cat: 'trick', name: 'Jet Return', formation: 'spread', tags: ['run', 'trick', 'perimeter'],
    players: {
      Y: { start: [7, -1.5], route: { pts: [[13, -3.5], [18, -3.5], [20, -3]], speed: 7 } },
      QB: { route: { pts: [[12.5, -4], [14, -5.5], [21, -4.5], [23, 3], [23, 14]], delay: 0.15, speed: 6 } },
      X: { route: { pts: [[2, 18]] } },
      Z: { route: { pts: [[23, 8], [16, 15]] } },
      C: { route: { pts: [[12.5, 12]], delay: 0.3 } }
    },
    motion: { player: 'Y', pts: [[10, -1.5]] },
    events: [{ t: 0.45, type: 'handoff', from: 'QB', to: 'Y' }, { t: 1.35, type: 'pitch', from: 'Y', to: 'QB' }],
    reads: ['QB takes the pitch around the right edge'],
    notes: 'Jet motion, handoff to Y, Y pitches back to the QB — after getting it back the QB can legally run. Not legal in a no-run zone.'
  },

  /* ================= RUNS (illegal inside a no-run zone) ================= */
  {
    id: 'jet-sweep', cat: 'run', name: 'Jet Sweep', formation: 'spread', tags: ['run', 'perimeter'],
    players: {
      Z: { start: [23, -1.5], route: { pts: [[13, -3.5], [6, -3], [2, 3], [2, 14]], speed: 7 } },
      QB: { route: { pts: [[12.5, -4]], delay: 0.2, speed: 3 } },
      X: { route: { pts: [[2, 18]] } },
      Y: { route: { pts: [[9, 8], [9, 16]] } },
      C: { route: { pts: [[12.5, 6]], delay: 0.3 } }
    },
    motion: { player: 'Z', pts: [[16, -1.5]] },
    events: [{ t: 0.5, type: 'handoff', from: 'QB', to: 'Z' }],
    reads: ['Z takes it to the left edge'],
    notes: 'Z motions 1 yd behind and parallel to the LOS. X and Y run defenders off with routes — no blocking or running alongside the carrier.'
  },
  {
    id: 'counter', cat: 'run', name: 'Counter', formation: 'gun', tags: ['run', 'misdirection'],
    players: {
      Y: { route: { pts: [[16.5, -4.5], [13.5, -5], [8, -3], [6, 3], [6, 12]], speed: 6 } },
      QB: { route: { pts: [[17, -4]], delay: 0.9, speed: 4 } },
      X: { route: { pts: [[2, 18]] } },
      Z: { route: { pts: [[23, 6], [22, 5]] } },
      C: { route: { pts: [[15, 6]], delay: 0.3 } }
    },
    events: [{ t: 0.75, type: 'handoff', from: 'QB', to: 'Y' }],
    reads: ['Y cuts back left'],
    notes: 'Y jab-steps right to pull the blitzer, takes the handoff going left. QB carries out a fake to the right.'
  },
  {
    id: 'reverse', cat: 'run', name: 'Reverse', formation: 'gun', tags: ['run', 'trick', 'misdirection'],
    players: {
      Y: { route: { pts: [[13.5, -5.2], [17, -4], [19, -3.5]], speed: 6 } },
      Z: { route: { pts: [[21, -3], [17, -4], [8, -3.5], [4, 2], [4, 14]], speed: 7 } },
      QB: { route: { pts: [[10, -3]], delay: 0.5, speed: 4 } },
      X: { route: { pts: [[2, 18]] } },
      C: { route: { pts: [[12.5, 6], [10, 6]], delay: 0.3 } }
    },
    events: [{ t: 0.35, type: 'handoff', from: 'QB', to: 'Y' }, { t: 1.1, type: 'handoff', from: 'Y', to: 'Z' }],
    reads: ['Z reverse to the left sideline'],
    notes: 'Two handoffs, both behind the line. Y sells the sweep right before giving to Z.'
  },

  /* ================= MIDFIELD NO-RUN ZONE ================= */
  {
    id: 'mid-sticks', cat: 'midfield', name: 'Midfield Sticks', formation: 'trips', ytm: 5, tags: ['pass', 'midfield', 'quick', 'short-yardage', 'third-down'],
    players: {
      X: { route: { pts: [[23.5, 7], [24.8, 7]] } },
      Z: { route: { pts: [[20, 6.5], [19, 6.5]] } },
      Y: { route: { pts: [[17, 6.5], [11, 6.5]] } },
      C: { route: { pts: [[11, 1], [5, 2]], delay: 0.3 } },
      QB: { route: { pts: [[12.5, -5.5]] } }
    },
    events: [{ type: 'pass', from: 'QB', to: 'Z', brk: 0 }],
    reads: ['Z sit just past midfield', 'Y shallow cross past the line', 'X out at the sticks', 'C flat (check-down)'],
    notes: 'Inside 5 of midfield = no-run zone. Every route breaks PAST midfield so a catch is a first down.'
  },
  {
    id: 'mid-mesh', cat: 'midfield', name: 'Midfield Mesh', formation: 'spread', ytm: 4, tags: ['pass', 'midfield', 'vs-man', 'short-yardage', 'third-down'],
    players: {
      X: { route: { pts: [[3, 5], [20, 5.5]] } },
      Z: { route: { pts: [[22, 6.5], [5, 6.5]] } },
      Y: { route: { pts: [[7, 7], [7, 16]] } },
      C: { route: { pts: [[12.5, 6], [12, 6]], delay: 0.5 } },
      QB: { route: { pts: [[12.5, -5.5]] } }
    },
    events: [{ type: 'pass', from: 'QB', to: 'X', brk: 0 }],
    reads: ['X / Z crossers just past midfield', 'C sit', 'Y seam'],
    notes: 'Mesh with the crossers raised to the line to gain. Expect man coverage here — crossers beat it.'
  },

  /* ================= RED ZONE & PAT ================= */
  {
    id: 'rz-slant-corner', cat: 'redzone', name: 'RZ Slant Corner', formation: 'spread', ytg: 5, tags: ['pass', 'red-zone', 'quick'],
    players: {
      X: { route: { pts: [[3, 5], [3, 12]] } },
      Y: { route: { pts: [[7, 4], [3, 10]] } },
      Z: { route: { pts: [[23, 2], [16, 6]] } },
      C: { route: { pts: [[12.5, 3], [12, 3]], delay: 0.3 } },
      QB: { route: { pts: [[12.5, -5.5]] } }
    },
    events: [{ type: 'pass', from: 'QB', to: 'Z', brk: 0 }],
    reads: ['Z slant', 'Y corner to the pylon', 'X back-shoulder fade', 'C sit'],
    notes: 'Inside the 5 = no-run zone. Pass only, even after a handoff. Short field — no long-developing routes.'
  },
  {
    id: 'rz-pivot', cat: 'redzone', name: 'RZ Fade Pivot', formation: 'trips', ytg: 5, tags: ['pass', 'red-zone', 'vs-man'],
    players: {
      X: { route: { pts: [[23, 4], [22.5, 11]] } },
      Z: { route: { pts: [[19, 3.5], [16.5, 3.5], [20, 3.5]] } },
      Y: { route: { pts: [[16.5, 4], [12, 8]] } },
      C: { route: { pts: [[11, 1], [5, 3]], delay: 0.3 } },
      QB: { route: { pts: [[12.5, -5.5]] } }
    },
    events: [{ type: 'pass', from: 'QB', to: 'Z', brk: 1 }],
    reads: ['Z pivot (sells in, snaps back out)', 'X fade', 'Y slant into the end zone', 'C flat backside'],
    notes: 'Man beater at the goal line: the defender jumps the in-cut and Z snaps back out to the sideline.'
  },
  {
    id: 'pat1-snag', cat: 'redzone', name: 'PAT-1 Snag', formation: 'trips', ytg: 5, tags: ['pass', 'pat1', 'red-zone', 'quick'],
    players: {
      X: { route: { pts: [[23.5, 4], [22.5, 4]] } },
      Z: { route: { pts: [[20, 4], [24, 9]] } },
      Y: { route: { pts: [[18, 0.5], [23, 1.5]] } },
      C: { route: { pts: [[12.5, 2], [10, 7]], delay: 0.3 } },
      QB: { route: { pts: [[12.5, -5.5]] } }
    },
    events: [{ type: 'pass', from: 'QB', to: 'Z', brk: 0 }],
    reads: ['Z corner', 'X snag (sit)', 'Y flat', 'C backside slant'],
    notes: '1-point try from the 5: pass only. Triangle read — someone is always open vs zone.'
  },
  {
    id: 'pat2-cross', cat: 'redzone', name: 'PAT-2 Cross', formation: 'spread', ytg: 10, tags: ['pass', 'pat2', 'red-zone'],
    players: {
      X: { route: { pts: [[2, 7], [8, 14]] } },
      Z: { route: { pts: [[23, 8], [14, 8]] } },
      Y: { route: { pts: [[4, 1], [2, 6], [2, 14]] } },
      C: { route: { pts: [[12.5, 4], [12, 4]], delay: 0.3 } },
      QB: { route: { pts: [[12.5, -6.5]] } }
    },
    events: [{ type: 'pass', from: 'QB', to: 'X', brk: 0 }],
    reads: ['X post into the end zone', 'Z dig at the goal line', 'Y wheel', 'C sit'],
    notes: '2-point try from the 10. Runs ARE legal on a 2-pt try, but this is our go-to.'
  }
];
if (typeof module !== 'undefined') module.exports = B2A_PLAYS;
