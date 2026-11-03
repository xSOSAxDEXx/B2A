/* League rules cheat sheet — paraphrased summary. "league" = our house rule, "diff" = sources disagree. */
var B2A_RULES = [
  {
    title: 'Downs & possession', icon: 'hash',
    items: [
      { league: true, t: '<b>3 downs</b> to cross midfield from your own 5-yard line. Cross it and you get a fresh <b>3 downs</b> to score.' },
      { t: 'Crossing midfield is the only first down of a drive.' },
      { t: 'No kickoffs — coin toss winner picks offense/defense; the other side picks direction. Possession flips to start the 2nd half.' },
      { t: 'After a score or turnover on downs, the new offense starts on its own 5. Interceptions are the only change of possession that doesn’t restart at the 5.' },
      { league: true, t: '<b>Turnover on downs:</b> the other team takes over at <b>its own 5-yard line</b> (no punts).' }
    ]
  },
  {
    title: 'Field', icon: 'ruler',
    items: [
      { t: '70 yards long: a 50-yard field of play plus two 10-yard end zones. Line to gain is midfield.' },
      { league: true, t: 'Field is <b>25 yards wide</b>.' },
      { league: true, t: '<b>No-run zones</b>: the 5 yards before <b>midfield</b> and the 5 yards before <b>each goal line</b>. From inside one, every play must be a pass — even if you hand off first.' }
    ]
  },
  {
    title: 'Scoring', icon: 'football',
    items: [
      { t: 'Touchdown = 6.' },
      { t: 'Extra point: <b>1 pt from the 5</b> (pass only — it’s in the no-run zone) or <b>2 pts from the 10</b> (run or pass). Declare it before the snap.' },
      { t: 'Safety = 2. Pick-6 on a try = 2 for the defense.' },
      { t: 'Interceptions can be returned for a score.' },
      { t: 'Mercy: a 30-point lead ends the game (USA Flag).' }
    ]
  },
  {
    title: 'Clock & timeouts', icon: 'clock',
    items: [
      { t: 'Two 20-minute halves, 5-minute halftime (league play). Clock only stops for timeouts, injuries, or ref discretion.' },
      { t: 'For 18+, a pro clock (stops on incompletions, out of bounds, scores, penalties, change of possession) is recommended in the last 2 minutes of each half.' },
      { t: '30 seconds to snap after the ball is spotted — one warning, then delay of game (−5).' },
      { league: true, t: '<b>1 timeout per half</b> per team.' },
      { t: 'QB may spike to stop the clock with 2:00 or less — costs a down.' }
    ]
  },
  {
    title: 'Offense: QB & snap', icon: 'target',
    items: [
      { t: 'Center must be on the line and snap between the legs to a player in the backfield. QB must line up off the line.' },
      { t: '<b>QB cannot run</b> the ball across the line. He can hand off/pitch and then go out for a pass, or get a second handoff back.' },
      { t: '<b>7-second clock</b> from the snap to a pass or handoff. If it runs out, it’s a dead ball and a lost down. A handoff turns the clock off.' },
      { t: 'Everyone is eligible to catch a pass, including the center (after the snap) and the QB (after handing off).' },
      { t: '<b>Center can’t take a handoff</b> (no center sneak).' }
    ]
  },
  {
    title: 'Offense: passing & running', icon: 'arrow',
    items: [
      { t: 'One forward pass per play, thrown from behind the line, caught beyond it.' },
      { t: 'Unlimited handoffs and backward pitches — but only behind the line. Any backward pass or handoff past the line is a penalty.' },
      { t: 'Shovel passes are fine if caught past the line.' },
      { t: '<b>No blocking or screening.</b> Teammates must stop running with the ball carrier once the ball crosses the line.' },
      { t: 'Ball carriers can spin but can’t jump, dive, stiff-arm, or cover their flags (flag guarding).' },
      { t: 'Motion: one player at a time, at least 1 yard behind and parallel to the line. No motion toward the line.' }
    ]
  },
  {
    title: 'Defense', icon: 'shield',
    items: [
      { t: 'Up to <b>2 blitzers</b>. Each must start 7+ yards off the line with a hand raised before the snap, and blitz straight and immediately.' },
      { league: true, t: 'A blitzer must line up at least <b>3 feet (1 yd) to the left or right</b> of the ball — never directly over the center.' },
      { t: 'Any other defender can’t cross the line until there’s a handoff, pitch, or pass. After a handoff <b>everyone</b> can blitz.' },
      { t: 'A blitzer running in a straight line at the QB has right of way. If a receiver (or the center) moves into his path, it’s <b>impeding the blitzer: −5 and loss of down</b>. A player standing still has right of place — the blitzer must go around him.' },
      { t: 'No contact with the QB, no holding, no stripping the ball, no pulling flags of a player without the ball.' }
    ]
  },
  {
    title: 'Dead ball', icon: 'stop',
    items: [
      { t: 'Ball hits the ground (no fumbles — dead where it lands).' },
      { t: 'Ball carrier’s flag is pulled or falls off, or they step out of bounds.' },
      { t: 'Any body part other than hands or feet touches the ground.' },
      { t: 'A receiver who catches it with one or no flags is down at the catch.' },
      { t: 'Ball is spotted where the ball is when the flag comes off, not the feet.' }
    ]
  },
  {
    title: 'Overtime (league)', icon: 'hourglass',
    items: [
      { t: 'Coin toss (visitors call). Each team gets one series from midfield, including its try.' },
      { t: 'Still tied: alternate 1-point tries from the 5 until someone wins a round.' },
      { t: 'No timeouts in OT.' }
    ]
  }
];

var B2A_PENALTIES = [
  ['Defense', 'Offsides / illegal blitz / illegal signal', '+5 from LOS'],
  ['Defense', 'Pass interference', '+10 from LOS, auto 1st'],
  ['Defense', 'Roughing the passer', '+10 from LOS, auto 1st'],
  ['Defense', 'Holding', '+10 from spot, auto 1st'],
  ['Defense', 'Stripping', '+10, auto 1st'],
  ['Defense', 'Illegal flag pull (before catch)', '+5 from spot'],
  ['Defense', 'Unnecessary roughness / unsportsmanlike', '+10, auto 1st'],
  ['Offense', 'False start / delay of game', '−5 from LOS'],
  ['Offense', 'Illegal motion, impeding blitzer, center sneak, illegal backward pass', '−5 & loss of down'],
  ['Offense', 'Illegal forward pass', '−5 & loss of down'],
  ['Offense', 'Flag guarding', '−5 from spot & loss of down'],
  ['Offense', 'Screening / blocking / holding / running with carrier', '−10 & loss of down'],
  ['Offense', 'Charging', '−10 & loss of down'],
  ['Offense', 'Pass interference', '−10 & loss of down'],
  ['Offense', 'Unsportsmanlike conduct', '−10']
];
