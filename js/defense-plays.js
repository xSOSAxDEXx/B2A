/* B2A defensive playbook. x 0..25 across (ball at 12.5), y = yards off the LOS.
   job: blitz (declared blitzer, 7+ yds, hand up) | man (on: strongOut / strongSlot / weakOut / C) | zone (drop + radius r) | spy.
   Drawn with the offense's STRONG side (2 receivers) on the RIGHT; the sim mirrors it when they're strong left.
   SC / WC = strong-side / weak-side corner (shown as C when all receivers are to one side or it's balanced).
   vs: default offensive play used to demonstrate the coverage (change it in the viewer). */
var B2A_DEF_PLAYS = [
  {
    id: 'cover0', name: 'Cover 0 Blitz', front: '1 blitzer · 4 man', vs: 'smash', tags: ['man', 'blitz', 'short-yardage', 'third-down', 'pressure'],
    defenders: [
      { id: 'B', label: 'B', job: 'blitz', start: [14, 7.5] },
      { id: 'WC', label: 'WC', job: 'man', on: 'weakOut' },
      { id: 'SC', label: 'SC', job: 'man', on: 'strongOut' },
      { id: 'N', label: 'N', job: 'man', on: 'strongSlot' },
      { id: 'M', label: 'M', job: 'man', on: 'C', cushion: 4.5 }
    ],
    when: ['3rd and short', 'Inside a no-run zone (they must pass)', 'Vs a nervous or slow-reading QB'],
    strengths: 'Everyone is covered and the QB is under pressure immediately.',
    weaknesses: 'No deep help — a double move, a rub, or one missed flag pull goes the distance.',
    keys: ['SC on the strong #1, WC on the weak #1, N on the strong slot — 5 yds off with inside shade, take away the slant first', 'M plays tight on the center: the quick C release is the #1 hot read', 'Blitzer aims at the throwing shoulder and gets hands up when he can’t reach the flag']
  },
  {
    id: 'cover1', name: 'Cover 1 Free', front: '1 blitzer · 3 man · free safety', vs: 'four-verts', tags: ['man', 'blitz', 'deep-help'],
    defenders: [
      { id: 'B', label: 'B', job: 'blitz', start: [14, 7.5] },
      { id: 'WC', label: 'WC', job: 'man', on: 'weakOut' },
      { id: 'SC', label: 'SC', job: 'man', on: 'strongOut' },
      { id: 'N', label: 'N', job: 'man', on: 'strongSlot' },
      { id: 'FS', label: 'FS', job: 'zone', start: [12.5, 11], drop: [12.5, 16], r: 7, zone: 'Free' }
    ],
    when: ['Base call on 1st down', 'Vs a team with one deep threat'],
    strengths: 'Man pressure underneath with a safety over the top for posts and go routes.',
    weaknesses: 'The center is only covered by the free safety’s zone — a quick C hook or seam is open.',
    keys: ['FS reads the QB’s eyes and drives on anything in the middle', 'Man defenders play outside-in: FS helps inside']
  },
  {
    id: 'robber', name: 'Cover 1 Robber', front: 'No blitz · 4 man · robber', vs: 'mesh', tags: ['man', 'no-blitz', 'vs-crossers', 'third-down'],
    defenders: [
      { id: 'WC', label: 'WC', job: 'man', on: 'weakOut' },
      { id: 'SC', label: 'SC', job: 'man', on: 'strongOut' },
      { id: 'N', label: 'N', job: 'man', on: 'strongSlot' },
      { id: 'M', label: 'M', job: 'man', on: 'C', cushion: 4 },
      { id: 'RB', label: 'RB', job: 'zone', start: [12.5, 9], drop: [12.5, 7], r: 6, zone: 'Rob' }
    ],
    when: ['Vs a strong QB with time to read', 'Vs mesh / crossers', '3rd and medium'],
    strengths: 'Five in coverage, with a robber sitting on crossers and digs at 6–8 yds.',
    weaknesses: 'No pressure — the QB has the full 7 seconds. Deep sideline routes are one-on-one.',
    keys: ['Robber reads the QB and jumps the first crosser into his area', 'Man defenders can play tighter knowing help is inside']
  },
  {
    id: 'cover2', name: 'Cover 2', front: '1 blitzer · 2 flats · 2 deep halves', vs: 'curl-flat', tags: ['zone', 'blitz', 'base', 'vs-deep'],
    defenders: [
      { id: 'B', label: 'B', job: 'blitz', start: [14, 7.5] },
      { id: 'WC', label: 'WC', job: 'zone', start: [4, 5], drop: [4, 5], r: 5.5, zone: 'Weak flat' },
      { id: 'SC', label: 'SC', job: 'zone', start: [21, 5], drop: [21, 5], r: 5.5, zone: 'Strong flat' },
      { id: 'S1', label: 'S1', job: 'zone', start: [7, 11], drop: [6.5, 17], r: 7, zone: 'Deep ½ weak' },
      { id: 'S2', label: 'S2', job: 'zone', start: [18, 11], drop: [18.5, 17], r: 7, zone: 'Deep ½ strong' }
    ],
    when: ['Base call', 'Vs fast receivers', 'Long yardage'],
    strengths: 'Both sidelines and both deep halves covered; keeps everything in front.',
    weaknesses: 'Soft in the short middle and in the seam between the safeties (center seam, smash corner).',
    keys: ['SC and WC re-route the outside receiver on their side, then sink under the corner route', 'Safeties: nobody behind you', 'Change-up: blitzer drops to the short middle instead']
  },
  {
    id: 'cover3', name: 'Cover 3', front: '1 blitzer · 3 deep thirds · 1 hook', vs: 'post-wheel', tags: ['zone', 'blitz', 'vs-deep', 'prevent-first-down'],
    defenders: [
      { id: 'B', label: 'B', job: 'blitz', start: [14, 7.5] },
      { id: 'WC', label: 'WC', job: 'zone', start: [4, 7], drop: [4, 16], r: 6, zone: 'Deep ⅓ weak' },
      { id: 'FS', label: 'FS', job: 'zone', start: [12.5, 10], drop: [12.5, 17], r: 6, zone: 'Deep ⅓ middle' },
      { id: 'SC', label: 'SC', job: 'zone', start: [21, 7], drop: [21, 16], r: 6, zone: 'Deep ⅓ strong' },
      { id: 'M', label: 'M', job: 'zone', start: [12.5, 5], drop: [12.5, 5], r: 7, zone: 'Hook' }
    ],
    when: ['Vs deep passing teams', 'Protecting a lead'],
    strengths: 'Very hard to throw over; M takes away the center and short middle.',
    weaknesses: 'Flats are empty — Flood, Stick and quick outs eat it up.',
    keys: ['M drifts toward where the QB looks', 'Deep thirds stay deeper than the deepest receiver in their third']
  },
  {
    id: 'three-one', name: '3-1 Zone', front: '1 blitzer · 2 squat corners · M · FS', vs: 'snag', tags: ['zone', 'blitz', 'vs-bunch', 'vs-handoffs'],
    defenders: [
      { id: 'B', label: 'B', job: 'blitz', start: [14, 7.5] },
      { id: 'WC', label: 'WC', job: 'zone', start: [2.5, 4], drop: [3.5, 7], r: 6, zone: 'Squat weak' },
      { id: 'SC', label: 'SC', job: 'zone', start: [22.5, 4], drop: [21.5, 7], r: 6, zone: 'Squat strong' },
      { id: 'M', label: 'M', job: 'zone', start: [12.5, 6], drop: [12.5, 6], r: 6, zone: 'Middle' },
      { id: 'FS', label: 'FS', job: 'zone', start: [12.5, 12], drop: [12.5, 16], r: 8, zone: 'Deep' }
    ],
    when: ['Vs bunch and stack', 'Vs teams that like handoffs and reverses', 'Long down-and-distance'],
    strengths: 'Outside corners kill sweeps and quick routes; FS rotates to the flood side.',
    weaknesses: 'Needs practice; spread formations stretch it horizontally.',
    keys: ['SC / WC: jump anything quick in front, otherwise bail deep', 'M kills throwbacks to the middle', 'FS rotates toward the side with more receivers']
  },
  {
    id: 'diamond', name: 'Diamond (1-2-1)', front: '1 blitzer · hook · 2 curl/flat · deep', vs: 'stick', tags: ['zone', 'blitz', 'base'],
    defenders: [
      { id: 'B', label: 'B', job: 'blitz', start: [14, 7.5] },
      { id: 'M', label: 'M', job: 'zone', start: [12.5, 4], drop: [12.5, 4.5], r: 5.5, zone: 'Hook' },
      { id: 'WW', label: 'WW', job: 'zone', start: [6, 7], drop: [5.5, 8], r: 6, zone: 'Curl/flat weak' },
      { id: 'SW', label: 'SW', job: 'zone', start: [19, 7], drop: [19.5, 8], r: 6, zone: 'Curl/flat strong' },
      { id: 'FS', label: 'FS', job: 'zone', start: [12.5, 12], drop: [12.5, 17], r: 7.5, zone: 'Deep' }
    ],
    when: ['Balanced base zone', 'Vs teams that live on 5–8 yd routes'],
    strengths: 'Layered — short, middle and deep all have a defender.',
    weaknesses: 'Seams between the wings and the deep safety; deep sidelines.',
    keys: ['Wings (SW / WW): widen with #1, sink under anything at 8–10', 'M takes the center']
  },
  {
    id: 'double-blitz', name: 'Double Blitz', front: '2 blitzers · M · 2 deep', vs: 'four-verts', tags: ['zone', 'blitz', 'pressure', 'third-down', 'vs-bunch'],
    defenders: [
      { id: 'B1', label: 'B1', job: 'blitz', start: [9, 7.5] },
      { id: 'B2', label: 'B2', job: 'blitz', start: [16, 7.5], speed: 5.2 },
      { id: 'M', label: 'M', job: 'zone', start: [12.5, 5], drop: [12.5, 5], r: 6, zone: 'Short middle' },
      { id: 'S1', label: 'S1', job: 'zone', start: [6, 11], drop: [6, 16], r: 7, zone: 'Deep ½ weak' },
      { id: 'S2', label: 'S2', job: 'zone', start: [19, 11], drop: [19, 16], r: 7, zone: 'Deep ½ strong' }
    ],
    when: ['Big 3rd downs', 'Vs bunch / slow QBs', 'Never vs a quick-throwing spread team'],
    strengths: 'Fastest pressure allowed. Forces a throw before routes develop.',
    weaknesses: 'Only three in coverage — the flats and the center hot route are open.',
    keys: ['B1 goes for the flag / hands in the throwing lane', 'B2 keeps contain and watches for the pump fake or pitch', 'M jumps the center']
  },
  {
    id: 'cover4', name: 'Cover 4 Prevent', front: '1 blitzer · 4 deep quarters', vs: 'four-verts', tags: ['zone', 'blitz', 'prevent', 'red-zone', 'two-minute'],
    defenders: [
      { id: 'B', label: 'B', job: 'blitz', start: [14, 7.5] },
      { id: 'Q1', label: 'Q1', job: 'zone', start: [3.5, 9], drop: [3.5, 14], r: 5, zone: '¼' },
      { id: 'Q2', label: 'Q2', job: 'zone', start: [9.5, 9], drop: [9.5, 14], r: 5, zone: '¼' },
      { id: 'Q3', label: 'Q3', job: 'zone', start: [15.5, 9], drop: [15.5, 14], r: 5, zone: '¼' },
      { id: 'Q4', label: 'Q4', job: 'zone', start: [21.5, 9], drop: [21.5, 14], r: 5, zone: '¼' }
    ],
    when: ['End of half / protecting a lead', 'Goal line ("4 across" just inside the end zone)'],
    strengths: 'Nothing deep. At the goal line it walls off the end zone.',
    weaknesses: 'Gives up everything short — flags must be pulled immediately after the catch.',
    keys: ['Pass crossers off to the next quarter', 'Rally to the ball the moment it’s caught']
  }
];
if (typeof module !== 'undefined') module.exports = B2A_DEF_PLAYS;
