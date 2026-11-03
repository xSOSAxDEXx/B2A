/* Coaching guide — summarized in our own words from 5v5 coaching research (sources listed in the Guide tab). */
var B2A_GUIDE = [
  {
    title: 'What wins 5v5', icon: 'trophy',
    items: [
      'Quick, accurate throws ARE the offense. With no blocking and a blitzer coming from 7 yds, separation comes from timing and sharp cuts, not size.',
      'Keep the book small and run it from 2–3 formations, flipped both ways. Everyone should know every concept cold.',
      'QB–center chemistry first: a bad shotgun snap kills a drive, and the center is a receiver on every play.',
      'Speed after the catch and good flag-pull angles decide more games here than in 7v7 — every stop is a possession.',
      'Practice order: snap rhythm → 4–6 core concepts vs a live blitzer → reading the flat defender (man or zone?) → 7-second clock & no-run-zone drills → flag pulling.',
      'Game management: wristband numbers (no long huddles), track what coverage they show each down, save your best man-beater for 3rd down, and know your PAT calls before kickoff.'
    ]
  },
  {
    title: 'Quarterback', icon: 'target',
    items: [
      '<b>Throw on the break.</b> The ball leaves as the receiver plants for his cut and meets him in stride. Every beat you wait lets the defender close.',
      'Footwork: shotgun at 5. Quick game = catch, one step, throw. Intermediate = 3-step shuffle. Rollouts curve back-and-out, then square the shoulders to the target.',
      'Clock in your head: 1st read out by ~2s, 2nd by 3–4s, by 5s it’s the center / check-down / throw-away. Holding it to 7 is a sack — on 3 downs that’s nearly a lost possession.',
      'Know the read before the snap: one side of the field, max 3 reads (high-low or triangle), center is the last read in almost every concept.',
      'Man or zone? Motion a receiver: if a defender follows him across, it’s man (throw crossers, rubs, quick breaks). If they just shift, it’s zone (sit in the holes, high-low a defender).',
      'Vs the blitzer: a blitzer from 7 yds needs ~1.5–2.5s. Have the hot read ready immediately, slide one step away from his path (stay behind the LOS), and throw where he left — usually the center.',
      'Ball placement: vs man, away from the defender’s leverage; vs zone, lead into the window. Hooks/sticks low and away; corners and fades over the outside shoulder.',
      'Never throw late over the middle. Pump fakes eat up blitzers who jump to block the pass.'
    ]
  },
  {
    title: 'Using the center', icon: 'magnet',
    items: [
      'Same snap every time (silent count or QB clap). Snap, then release straight upfield — he’s eligible right away.',
      '<b>Hot read vs blitz:</b> one count, then sit at 4–6 yds where the blitzer started, facing the QB, hands up.',
      'Seam: splits two deep safeties (Cover 2) and holds the deep middle defender.',
      'Flat / arrow at 2–3 yds: the low read in Flood and Smash.',
      'Wheel or corner: when a slow defender is stuck on him in man.',
      'Defenses often put their weakest cover player on the center — make them pay. Tricks: Center Throwback (everyone floods right, C leaks back left).'
    ]
  },
  {
    title: 'Play design principles', icon: 'ruler',
    items: [
      'Spacing: 5–7 yds between receivers on a 25-yd field, 3–4 yds off the sideline. Never two receivers at the same depth in the same area.',
      '<b>High-low:</b> two routes stretch one defender vertically (flat at 2 + corner at 10–12; shallow at 2 + dig at 8). QB reads that one defender.',
      '<b>Triangle:</b> three routes vs two defenders — corner / snag / flat. Works vs man and zone.',
      'Legal traffic: bunch and stack releases, mesh crossers, switch releases. Every receiver runs a real route at full speed and never stops in or steers into a defender’s path — that’s screening.',
      'One motion per play: to diagnose man vs zone, to start a runner, or to get into a stack vs press.',
      'Keep 1–2 runs and a reverse/return so defenses must respect the run outside the no-run zones.'
    ]
  },
  {
    title: 'Situations (3 downs)', icon: 'compass',
    items: [
      'With only 3 downs each first down is worth more: play 1st and 2nd down for 4+ yds so 3rd is manageable.',
      '3rd and short: man-beaters — Mesh, Stack Switch, Slant Flat, Center Hot. 3rd and long: Flood / Smash with routes stemmed past the line to gain.',
      'Throw past the marker — a catch short of it ends the drive.',
      'No-run zones (5 before midfield and the goal line): defenses know you must pass — expect zone or a 2-man blitz. Quick game (Stick, Slant Flat, Snag, Mesh) and the center hot route.',
      'Near the goal line the field shrinks: back-shoulder fades, corners to the pylon, pivots. No long-developing shots.',
      'Ahead late: in-bounds throws (hitches, sits, digs) and runs outside the no-run zones. Behind: outs, corners, sideline throws, wristband no-huddle.'
    ]
  },
  {
    title: 'Defense principles', icon: 'shield',
    items: [
      'Have one base defense and 1–2 change-ups. Complexity makes your own players slow.',
      'Disguise: show the same pre-snap look (e.g. everyone ~7 yds) and rotate into 2–3 coverages at the snap. Keep the blitzer hidden until the hand goes up.',
      'Communicate: a strength call as they break the huddle, “switch/banjo” vs stacks, call out motion (zone shifts, man follows).',
      'Zone rules: one receiver in your area — cover him; two — split them; none — help a teammate. Deep players: nobody behind you.',
      'Always account for the center — a quick center release is the most common open man in 5v5.',
      'Spread formation → man. Bunch/stack → zone or double blitz. Inside a no-run zone they must pass: play tight.',
      'Handoffs: the moment there’s a handoff or pitch, everyone can blitz — outside defenders kill sweeps; deep players stay home vs trick passes; backside watches the throwback.'
    ]
  },
  {
    title: 'Blitzing & flag pulling', icon: 'blitz',
    items: [
      'Max 2 blitzers, 7+ yds back, hand up until the snap, then go immediately and straight. React to the ball, not the cadence.',
      'Aim at the QB’s throwing shoulder; take a slight angle around the center. Close the last steps under control — chop your feet so he can’t side-step you.',
      'Can’t reach the flag? Hands up in the throwing lane. Two blitzers: one goes for the flag, the other contains and watches the pump fake / pitch.',
      'Flag pulling: get low and wide, eyes on the hips (not the ball or feet), grab near the belt and rip. Shuffle to square up — don’t lunge.',
      'Pursuit: once the ball is caught or crosses the line, EVERYONE runs to where the carrier is going, not where he is.'
    ]
  }
];
var B2A_GUIDE_SOURCES = [
  ['NFL FLAG 5v5 playbook', 'https://nflflag.com/flag-football-plays/5-on-5-flag-football-playbook'],
  ['NFL FLAG positions', 'https://nflflag.com/flag-football-rules/football-positions'],
  ['NFL FLAG 5v5 defense', 'https://nflflag.com/flag-football-plays/5-on-5-flag-football-defense'],
  ['USA Flag defense strategy guide', 'https://usaflag.org/the-best-5-on-5-flag-football-defense-strategy-guide/'],
  ['FirstDown PlayBook coaches community', 'https://firstdown.playbooktech.com/coaches-community/adult-flag-football-defense-101'],
  ['YouthFootballOnline coverage beaters', 'https://youthfootballonline.com/7v7-flag-football-coverage-beaters/'],
  ['Coach Z zone rules', 'https://flagfootball.substack.com/p/rules-for-mastering-zone-coverage'],
  ['MOJO flag pulling', 'https://mojo.sport/coachs-corner/the-fine-art-of-flag-pulling/'],
  ['USA Football no-run zone planning', 'https://blogs.usafootball.com/blog/958/planning-within-the-no-run-zone-and-short-yardage-for-flag-football']
];
