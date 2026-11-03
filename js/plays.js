/* B2A built-in playbook. Coordinates in yards: x 0..25 sideline to sideline (center at 12.5),
   y 0 = line of scrimmage, + downfield. Route "pts" are waypoints after the player's start spot.
   events: ball exchanges after the snap (snap always goes C -> QB).
   ytg: yards to the goal line (only for red-zone / PAT plays; draws the end zone + no-run zone).
   Add your own plays in the Designer tab, then "Copy JSON" and paste them into this list to share with the team. */
var B2A_PLAYS = [
  /* ---------------- QUICK GAME ---------------- */
  {
    id: 'slant-flat', name: 'Slant Flat', formation: 'spread', tags: ['pass', 'quick', 'vs-blitz', 'short-yardage'],
    players: {
      X: { route: { pts: [[2, 3], [8, 8]] } },
      Y: { route: { pts: [[6, 1], [1, 3]] } },
      Z: { route: { pts: [[23, 3], [17, 8]] } },
      C: { route: { pts: [[12.5, 4.5], [12.5, 4]], delay: 0.3 } },
      QB: { route: { pts: [[12.5, -6]] } }
    },
    events: [{ t: 1.3, type: 'pass', from: 'QB', to: 'X' }],
    reads: ['X slant (throw on the break)', 'Y flat', 'Z slant backside', 'C hook in the middle'],
    notes: 'Ball out in under 1.5s — our answer to a blitzer. Slants must win inside leverage on the 3rd step.'
  },
  {
    id: 'hot-outs', name: 'Hot Outs', formation: 'spread', tags: ['pass', 'quick', 'vs-blitz', 'sideline'],
    players: {
      X: { route: { pts: [[2, 4], [0.6, 4]] } },
      Y: { route: { pts: [[7, 5], [7.5, 4.5]] } },
      Z: { route: { pts: [[23, 4], [24.4, 4]] } },
      C: { route: { pts: [[14, 1.5], [21, 2.5]], delay: 0.3 } },
      QB: { route: { pts: [[12.5, -6]] } }
    },
    events: [{ t: 1.0, type: 'pass', from: 'QB', to: 'X' }],
    reads: ['X quick out', 'Z quick out (other side)', 'Y hitch', 'C to the flat'],
    notes: 'Late-game sideline play: catch and get out of bounds to stop the pro clock.'
  },
  {
    id: 'stick', name: 'Stick', formation: 'spread', tags: ['pass', 'quick', 'third-down', 'short-yardage'],
    players: {
      X: { route: { pts: [[3, 18]] } },
      Y: { route: { pts: [[7, 5], [8.5, 5]] } },
      Z: { route: { pts: [[23, 10], [13, 10]] } },
      C: { route: { pts: [[11, 1], [4, 2]], delay: 0.3 } },
      QB: { route: { pts: [[12.5, -6]] } }
    },
    events: [{ t: 1.8, type: 'pass', from: 'QB', to: 'Y' }],
    reads: ['Y stick at 5 (sit in the hole)', 'C flat', 'X fade', 'Z dig backside'],
    notes: 'High-percentage 3rd-down call. Y sits down between defenders — not a curl, a sit.'
  },

  /* ---------------- DROPBACK ---------------- */
  {
    id: 'mesh', name: 'Mesh', formation: 'spread', tags: ['pass', 'intermediate', 'vs-man'],
    players: {
      X: { route: { pts: [[3, 2], [20, 3]] } },
      Z: { route: { pts: [[22, 5], [5, 5]] } },
      Y: { route: { pts: [[4, 1], [2, 6], [2, 18]] } },
      C: { route: { pts: [[12.5, 7], [12, 7]], delay: 0.3 } },
      QB: { route: { pts: [[12.5, -6.5]] } }
    },
    events: [{ t: 1.9, type: 'pass', from: 'QB', to: 'Z' }],
    reads: ['Z crosser (high)', 'X crosser (low)', 'C sit over the middle', 'Y wheel deep'],
    notes: 'Crossers run at different depths and NEVER run into a defender — any pick is a screening penalty (-10 & loss of down).'
  },
  {
    id: 'smash', name: 'Smash', formation: 'spread', tags: ['pass', 'intermediate', 'vs-zone'],
    players: {
      X: { route: { pts: [[2, 5], [2.5, 4.5]] } },
      Y: { route: { pts: [[7, 9], [2, 15]] } },
      Z: { route: { pts: [[23, 9], [16, 18]] } },
      C: { route: { pts: [[12.5, 5], [13, 5]], delay: 0.3 } },
      QB: { route: { pts: [[12.5, -7]] } }
    },
    events: [{ t: 2.3, type: 'pass', from: 'QB', to: 'Y' }],
    reads: ['Y corner (throw away from the safety)', 'X hitch', 'C hook', 'Z post'],
    notes: 'High-low the corner defender: if he sinks with Y, hit X on the hitch.'
  },
  {
    id: 'curl-flat', name: 'Curl Flat', formation: 'gun', tags: ['pass', 'intermediate', 'vs-zone'],
    players: {
      X: { route: { pts: [[2, 10], [3, 9]] } },
      Y: { route: { pts: [[19, -3], [23, 1]] } },
      Z: { route: { pts: [[23, 10], [22, 9]] } },
      C: { route: { pts: [[12.5, 12]], delay: 0.3 } },
      QB: { route: { pts: [[12.5, -6.5]] } }
    },
    events: [{ t: 2.0, type: 'pass', from: 'QB', to: 'X' }],
    reads: ['X curl', 'Z curl', 'Y swing to the flat', 'C seam'],
    notes: 'Both outside WRs curl at 10 and work back to the QB. Y swing is the check-down.'
  },
  {
    id: 'flood', name: 'Flood Rollout', formation: 'trips', tags: ['pass', 'intermediate', 'vs-zone', 'rollout'],
    players: {
      X: { route: { pts: [[23.5, 20]] } },
      Z: { route: { pts: [[20, 8], [24, 8]] } },
      Y: { route: { pts: [[18, 1], [24, 2.5]] } },
      C: { route: { pts: [[12.5, 3], [5, 4]], delay: 0.4 } },
      QB: { route: { pts: [[17, -4.5]], speed: 4 } }
    },
    events: [{ t: 2.3, type: 'pass', from: 'QB', to: 'Z' }],
    reads: ['Z out at 8', 'Y flat', 'X go', 'C drag backside'],
    notes: 'QB rolls away from the blitzer to buy time. Three levels on one side of the field.'
  },
  {
    id: 'levels', name: 'Levels', formation: 'trips', tags: ['pass', 'intermediate', 'third-down', 'vs-zone'],
    players: {
      X: { route: { pts: [[23.5, 20]] } },
      Z: { route: { pts: [[20, 10], [10, 10]] } },
      Y: { route: { pts: [[16, 4], [6, 4]] } },
      C: { route: { pts: [[13, 1.5], [21, 1.5]], delay: 0.4 } },
      QB: { route: { pts: [[12.5, -6.5]] } }
    },
    events: [{ t: 2.4, type: 'pass', from: 'QB', to: 'Z' }],
    reads: ['Z dig at 10', 'Y drag at 4', 'C flat', 'X go clears the top'],
    notes: 'Read the middle defender: if he jumps Y underneath, Z is open behind him.'
  },
  {
    id: 'four-verts', name: 'Four Verts', formation: 'trips', tags: ['pass', 'deep', 'vs-zone'],
    players: {
      X: { route: { pts: [[23.5, 20]] } },
      Z: { route: { pts: [[18, 6], [18, 20]] } },
      Y: { route: { pts: [[15, 5], [8, 18]] } },
      C: { route: { pts: [[12.5, 5], [11, 5]], delay: 0.3 } },
      QB: { route: { pts: [[12.5, -7]] } }
    },
    events: [{ t: 2.5, type: 'pass', from: 'QB', to: 'Y' }],
    reads: ['Y bender away from the safety', 'Z seam', 'X go', 'C hook (check-down)'],
    notes: 'Shot play on 1st down. If the safety stays middle, take X or Z up the sideline.'
  },
  {
    id: 'bunch-switch', name: 'Bunch Switch', formation: 'bunch', tags: ['pass', 'intermediate', 'vs-man'],
    players: {
      Z: { route: { pts: [[20, 5], [15, 9]] } },
      Y: { route: { pts: [[18.5, 1], [23.5, 3]] } },
      X: { route: { pts: [[22, 6], [24, 14]] } },
      C: { route: { pts: [[12.5, 4], [6, 6]], delay: 0.3 } },
      QB: { route: { pts: [[12.5, -6.5]] } }
    },
    events: [{ t: 1.9, type: 'pass', from: 'QB', to: 'Z' }],
    reads: ['Z slant inside', 'Y flat', 'X corner', 'C drag backside'],
    notes: 'Bunch creates natural space vs man — but release cleanly. No rubbing defenders (screening).'
  },

  /* ---------------- TRICK (handoff first = 7-sec clock off, everyone can rush) ---------------- */
  {
    id: 'hb-pass', name: 'Halfback Pass', formation: 'gun', tags: ['pass', 'trick', 'deep'],
    players: {
      Y: { route: { pts: [[12.5, -5.8], [6, -4]], speed: 5 } },
      QB: { route: { pts: [[19, -2], [24, 3]], delay: 0.8, speed: 6 } },
      Z: { route: { pts: [[23, 10], [15, 20]] } },
      X: { route: { pts: [[2, 6], [4, 5]] } },
      C: { route: { pts: [[12.5, 3], [18, 4]], delay: 0.3 } }
    },
    events: [{ t: 0.6, type: 'handoff', from: 'QB', to: 'Y' }, { t: 2.6, type: 'pass', from: 'Y', to: 'Z' }],
    reads: ['Z post deep', 'QB leak to the flat', 'X curl'],
    notes: 'Sell the run. Y throws on the run — if Z is covered, hit the QB leaking out.'
  },
  {
    id: 'qb-throwback', name: 'QB Throwback', formation: 'gun', tags: ['pass', 'trick'],
    players: {
      Y: { route: { pts: [[13, -5.4], [20, -3], [21, -3]], speed: 5 } },
      QB: { route: { pts: [[8, -1], [5, 6], [5, 16]], delay: 0.7, speed: 6.5 } },
      X: { route: { pts: [[2, 20]] } },
      Z: { route: { pts: [[23, 6], [21, 5]] } },
      C: { route: { pts: [[16, 5]], delay: 0.3 } }
    },
    events: [{ t: 0.5, type: 'handoff', from: 'QB', to: 'Y' }, { t: 2.8, type: 'pass', from: 'Y', to: 'QB' }],
    reads: ['QB wheel up the left side', 'Z curl', 'C hook'],
    notes: 'After the handoff the QB is an eligible receiver. Defense always forgets him.'
  },
  {
    id: 'flea-flicker', name: 'Flea Flicker', formation: 'gun', tags: ['pass', 'trick', 'deep'],
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
      { t: 2.9, type: 'pass', from: 'QB', to: 'X' }
    ],
    reads: ['X stutter-go', 'Z post', 'C seam'],
    notes: 'Y must pitch BACK to the QB while still behind the line. Expect the whole defense to rush after the handoff — get it out fast.'
  },

  /* ---------------- RUNS (illegal in no-run zones) ---------------- */
  {
    id: 'jet-sweep', name: 'Jet Sweep', formation: 'spread', tags: ['run', 'perimeter'],
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
    notes: 'Z motions 1 yd behind and parallel to the LOS. X and Y run off defenders with routes — no blocking or running alongside the carrier.'
  },
  {
    id: 'counter', name: 'Counter', formation: 'gun', tags: ['run', 'misdirection'],
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
    id: 'reverse', name: 'Reverse', formation: 'gun', tags: ['run', 'trick', 'misdirection'],
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

  /* ---------------- RED ZONE / PAT ---------------- */
  {
    id: 'rz-slant-corner', name: 'RZ Slant Corner', formation: 'spread', ytg: 5, tags: ['pass', 'red-zone', 'quick'],
    players: {
      X: { route: { pts: [[3, 4], [3, 12]] } },
      Y: { route: { pts: [[7, 4], [3, 10]] } },
      Z: { route: { pts: [[23, 1.5], [16, 6]] } },
      C: { route: { pts: [[12.5, 3], [12, 3]], delay: 0.3 } },
      QB: { route: { pts: [[12.5, -6]] } }
    },
    events: [{ t: 1.3, type: 'pass', from: 'QB', to: 'Z' }],
    reads: ['Z slant', 'Y corner', 'X fade', 'C sit'],
    notes: 'Inside the 5 = no-run zone. Pass only, even after a handoff.'
  },
  {
    id: 'pat1-snag', name: 'PAT-1 Snag', formation: 'trips', ytg: 5, tags: ['pass', 'pat1', 'red-zone', 'quick'],
    players: {
      X: { route: { pts: [[23.5, 4], [22.5, 4]] } },
      Z: { route: { pts: [[20, 4], [24, 9]] } },
      Y: { route: { pts: [[18, 0.5], [23, 1.5]] } },
      C: { route: { pts: [[12.5, 2], [10, 7]], delay: 0.3 } },
      QB: { route: { pts: [[12.5, -6]] } }
    },
    events: [{ t: 1.8, type: 'pass', from: 'QB', to: 'Z' }],
    reads: ['Z corner', 'X snag (sit)', 'Y flat', 'C backside slant'],
    notes: '1-point try from the 5: pass only. Triangle read — someone is always open vs zone.'
  },
  {
    id: 'pat2-cross', name: 'PAT-2 Cross', formation: 'spread', ytg: 10, tags: ['pass', 'pat2', 'red-zone'],
    players: {
      X: { route: { pts: [[2, 7], [8, 14]] } },
      Z: { route: { pts: [[23, 8], [14, 8]] } },
      Y: { route: { pts: [[4, 1], [2, 6], [2, 14]] } },
      C: { route: { pts: [[12.5, 4], [12, 4]], delay: 0.3 } },
      QB: { route: { pts: [[12.5, -6.5]] } }
    },
    events: [{ t: 2.2, type: 'pass', from: 'QB', to: 'X' }],
    reads: ['X post into the end zone', 'Z dig at the goal line', 'Y wheel', 'C sit'],
    notes: '2-point try from the 10. Runs ARE legal on a 2-pt try (snap is outside the no-run zone), but this is our go-to pass.'
  }
];
if (typeof module !== 'undefined') module.exports = B2A_PLAYS;
