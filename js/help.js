/* Help tab: how to use the site. Sections are collapsible; coach/editor sections show a badge. */
(function () {
  'use strict';
  var A = window.APP, $ = A.$;
  var SITE = 'https://xsosaxdexx.github.io/B2A/';

  var SECTIONS = [
    { id: 'start', icon: 'play', title: 'Getting started', open: true, body:
      '<ol>' +
      '<li><b>Get added.</b> The coach adds your email under Roster → Team access. You can’t get in until that happens.</li>' +
      '<li><b>Open the site:</b> <a href="' + SITE + '">' + SITE + '</a></li>' +
      '<li><b>Sign in</b> with the exact email the coach added:<ul>' +
      '<li><b>Gmail</b> → tap <b>Sign in with Google</b>.</li>' +
      '<li><b>Any other email</b> → type it, pick a password, tap <b>Create account</b>. Open the verification email from Firebase (check spam), tap the link, then come back and tap <b>“I’ve verified — continue”</b>.</li></ul></li>' +
      '<li><b>Save it to your home screen</b> so it opens like an app: iPhone Safari → Share → <i>Add to Home Screen</i>; Android Chrome → ⋮ → <i>Add to Home screen</i>.</li>' +
      '</ol><p class="hint">Your name and role show at the top right. Tap <b>Sign out</b> there if you share a device.</p>' },

    { id: 'roles', icon: 'users', title: 'Roles — what you can do', body:
      '<table class="pen-table help-table"><tr><td>Player</td><td>See everything, take quizzes, log play results, run the scoreboard and downs, edit <b>your own</b> roster profile.</td></tr>' +
      '<tr><td>Editor</td><td>Everything a player can do, plus edit plays, the game plan, assignments, the roster and ratings.</td></tr>' +
      '<tr><td>Coach</td><td>Everything, plus <b>Team access</b> — who can sign in and their role.</td></tr></table>' +
      '<p class="hint">Changes save instantly for the whole team. If you try something your role can’t do, you’ll see a message and it won’t save.</p>' },

    { id: 'player', icon: 'bolt', title: 'Player quick-start (do this before every game)', body:
      '<ol>' +
      '<li><b>Game Day</b> → check the opponent and <b>this week’s game plan</b>.</li>' +
      '<li><b>Plays</b> → open each play in the plan and tap <b>▶ Run play</b>. Watch <i>your</i> letter. Try the <b>Against defense</b> dropdown to see how it plays out vs different coverages, and <b>QB throws to</b> to see what happens if the ball goes to another receiver (pick <i>Best read</i> to let it find the open man). <b>QB after the snap</b> rolls the QB out left or right so he throws on the run. Tap <b>✎ Adjust routes &amp; catch spot</b> to drag the <b>📍 pin</b> along the target’s route (where he catches it) and drag the dots to reshape routes — the result updates as you drag. It’s all view-only until someone taps <b>Edit copy</b>; <b>Reset changes</b> puts it back.</li>' +
      '<li>Look at the <b>Who’s playing it</b> card on each play to see your spot.</li>' +
      '<li><b>Quiz</b> → <b>Quiz me on my spots</b> → pick your name. It only asks about the spots you’re assigned this week.</li>' +
      '<li><b>Roster</b> → tap your own card to update your positions, strengths and weaknesses.</li>' +
      '</ol>' },

    { id: 'tabs', icon: 'clipboard', title: 'What each tab does', body:
      '<dl class="help-dl">' +
      '<dt>' + ICON('football') + ' Plays</dt><dd>The playbook. Switch <b>Offense / Defense</b> at the top. Filter by <b>Category</b>, sort by success or rating. Each play has an animation, the read progression, coaching points, our results, and a rules check. <b>Flip</b> mirrors it to the other side.</dd>' +
      '<dt>' + ICON('clipboard') + ' Game Day</dt><dd>This week’s opponent and game plan, the scoreboard, the current down and field position, suggested calls for the situation, and the <b>Log the last play</b> panel.</dd>' +
      '<dt>' + ICON('chart') + ' Stats</dt><dd>Record, matchups, which plays work (success %), results by down, and takeaways. Filter by opponent and offense/defense. Tap a play to open it.</dd>' +
      '<dt>' + ICON('brain') + ' Quiz</dt><dd><b>Quiz me on my spots</b> (by your name) or quiz by position. Routes, reads, timing, coverage jobs, and league rules.</dd>' +
      '<dt>' + ICON('users') + ' Roster</dt><dd>Players, their positions and strengths/weaknesses, and who plays each spot on every play in this week’s plan. Coach also manages <b>Team access</b> here.</dd>' +
      '<dt>' + ICON('pen') + ' Designer</dt><dd>Draw new plays (editors and coach). Saved plays show up for everyone under <b>Team plays</b>.</dd>' +
      '<dt>' + ICON('book') + ' Guide</dt><dd>Strategy (QB play, using the center, situations, defense), a coverage cheat sheet, and our league rules.</dd>' +
      '</dl>' },

    { id: 'diagrams', icon: 'target', title: 'Reading the play diagrams', body:
      '<ul>' +
      '<li><b>Circles</b> are our offense: <b>QB</b> gold, <b>C</b> white, <b>X</b> blue, <b>Y</b> pink, <b>Z</b> purple. The line from each is their route; a thick line is the ball carrier on a run.</li>' +
      '<li><b>Yellow dot</b> on a route = where the QB lets the ball go (the receiver’s break). <b>Yellow circle</b> = where it’s caught. <b>Dotted tail</b> = run after the catch.</li>' +
      '<li>Dashed line behind a player = <b>pre-snap motion</b>.</li>' +
      '<li><b>Defense:</b> ' + (A.D && A.D.legendHTML ? A.D.legendHTML() : '') + '. Lime dashed ovals are each zone defender’s area, labeled with the zone name.</li>' +
      '<li><b>SC / WC</b> = strong-side / weak-side corner (strong side has 2 receivers). They show as <b>C</b> vs trips or a balanced set. <b>B</b> = blitzer, <b>M</b> = middle, <b>S / FS</b> = safety, <b>N</b> = nickel on the slot.</li>' +
      '<li><b>Blue line</b> = line of scrimmage. <b>Pink dashed line</b> = 7-yard blitz line. <b>Orange shading</b> = no-run zone. <b>Yellow line</b> = midfield (1st down).</li>' +
      '<li>The <b>QB clock</b> (top right) counts the 7 seconds; it shows <b>OFF</b> after a handoff. <b>PRESSURE</b> flashes when the blitzer is close.</li>' +
      '<li><b>INTERCEPTED</b> = a defender undercut the throw or beat the receiver to the spot. <b>INCOMPLETE</b> = the receiver was covered and the pass got broken up — check the next read.</li><li>Results after a play (FLAG +8, SACK, TOUCHDOWN, INCOMPLETE, INTERCEPTED, separation) come from a <b>simplified simulation</b> — a guide, not a guarantee.</li>' +
      '</ul>' },

    { id: 'coach', icon: 'shield', title: 'Coach & editor: running game day', staff: true, body:
      '<ol>' +
      '<li><b>Before the week:</b> Game Day → <b>＋ New game</b> (opponent + date). It copies your last plan vs that team if there is one.</li>' +
      '<li><b>Build the plan:</b> add offensive and defensive plays with the dropdowns, or tap <b>＋ Game plan</b> on any play. Add scouting notes.</li>' +
      '<li><b>Assign spots:</b> Roster → Game plan assignments → <b>Auto-assign best fits</b>, then adjust. ⚠ warnings mean a spot needs something that’s listed as that player’s weakness, he’s out of position, or he’s in two spots.</li>' +
      '<li><b>During the game:</b> set the down and field position, check <b>Call this</b> for suggestions, and after each snap pick the play + result in <b>Log the last play</b> (add yards if you know them). Downs, first downs, touchdowns and turnovers on downs update automatically.</li>' +
      '<li><b>After:</b> Stats shows what worked. Rate plays 👍/👎 on the play page — ratings feed the suggestions.</li>' +
      '<li><b>Backups:</b> Game Day → Coach tools → <i>Download backup</i>.</li>' +
      '</ol>' },

    { id: 'access', icon: 'users', title: 'Coach: adding teammates', staff: true, body:
      '<ol><li>Roster → <b>Team access</b> → enter their email, pick a role, link their roster player → <b>Add</b>.</li>' +
      '<li>Send them the link: <a href="' + SITE + '">' + SITE + '</a></li>' +
      '<li>Remove someone with ✕ — access ends immediately.</li></ol>' +
      '<p class="hint">Linking the roster player is what makes “Quiz me on my spots” and editing their own profile work.</p>' },

    { id: 'faq', icon: 'warn', title: 'Troubleshooting', body:
      '<dl class="help-dl">' +
      '<dt>“Not on the team list yet”</dt><dd>The email you signed in with isn’t the one the coach added (Gmail vs another address is the usual cause). Tap <i>Use a different account</i>, or ask the coach to add that exact email.</dd>' +
      '<dt>“Can’t reach the team data” / “client is offline”</dt><dd>You’re signed in — the phone just can’t reach the team database. Switch to Wi-Fi or better signal, turn off any ad blocker or VPN, and on Samsung/Android set <i>Settings → Connections → More connection settings → Private DNS</i> to <b>Automatic</b>. Then tap Retry.</dd><dt>Never got the verification email</dt><dd>Check spam/junk, then tap <i>Resend email</i> on the sign-in screen.</dd>' +
      '<dt>Forgot password</dt><dd>Type your email on the sign-in screen and tap <i>Forgot password?</i></dd>' +
      '<dt>“You don’t have permission to change that”</dt><dd>Your role can’t edit that item. Ask the coach for Editor access if you need it.</dd>' +
      '<dt>Something looks out of date</dt><dd>Pull down to refresh or reload the page. Changes from others appear live once you’re signed in.</dd>' +
      '<dt>“Quiz me on my spots” doesn’t show my name</dt><dd>You need to be linked to a roster player and assigned to at least one spot in this week’s plan — ask the coach.</dd>' +
      '</dl>' }
  ];

  var done = false;
  function render() {
    if (done) return; done = true;
    var CL = window.B2A_CLOUD, staff = !CL || !CL.enabled || CL.role === 'coach' || CL.role === 'editor';
    $('#help-root').innerHTML = '<div class="help-head"><h1>How to use the playbook</h1><p class="hint">Tap a section to open it.' + (CL && CL.enabled && CL.role ? ' You’re signed in as <b>' + A.esc(CL.role) + '</b>.' : '') + '</p></div>' +
      SECTIONS.map(function (s) {
        return '<details class="card help-sec' + (s.staff ? ' staff' : '') + '"' + ((s.open || (s.staff && staff && s.id === 'coach')) ? ' open' : '') + '><summary>' + ICON(s.icon) + '<span>' + s.title + '</span>' + (s.staff ? '<span class="pill">coach / editor</span>' : '') + '</summary><div class="help-body">' + s.body + '</div></details>';
      }).join('');
  }
  A.tabHooks.help = render;
})();
