/* Tests firestore.rules in Google's local Firestore emulator — never the real project.
   Run (from the B2A-tests folder, after `npm i` there once):
     npx firebase emulators:exec --only firestore --project demo-b2a "node rules-test.js ../B2A/firestore.rules"
   Every save the site makes is tried as coach / editor / player / outsider, with good and bad data. */
const fs = require('fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');

const RULES = fs.readFileSync(process.argv[2] || '../B2A/firestore.rules', 'utf8');
let failed = 0, n = 0;
async function t(name, p, ok) {
  n++;
  try { await (ok ? assertSucceeds(p) : assertFails(p)); console.log('PASS ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + '  →  ' + (e.message || e).split('\n')[0]); }
}

// shapes copied from what the site writes (cloud.js units())
const GAME = { id: 'g1', opp: 'Sharks', date: '2026-11-07', us: 0, them: 0, notes: '', plan: { off: ['slant-flat'], def: [] }, assign: { off: {}, def: {} }, series: { down: 1, sit: 'own' }, half: 1, to: { 1: false, 2: false } };
const LOG = (by) => ({ side: 'off', play: 'slant-flat', vs: '', down: 1, sit: 'own', result: 'gain', yds: 6, id: 'l1', ts: '2026-11-07T15:00:00Z', game: 'g1', by, byName: 'Pat' });
const ROSTER = { id: 'p1', name: 'Pat', number: '7', offPos: 'WR', defPos: 'CB', offAlt: [], defAlt: [], strengths: ['speed'], weaknesses: [], notes: '' };
const RAW = { id: 'team-a', name: 'Alpha', cat: 'team', formation: 'spread', tags: ['pass'], players: { QB: { route: { pts: [[12.5, -6]] } } }, events: [{ type: 'pass', from: 'QB', to: 'X', brk: 0 }], reads: [], notes: '', created: '2026-11-05T10:00:00Z' };
const PLAY = { name: 'Alpha', created: RAW.created, data: JSON.stringify(RAW) };   // packed, as cloud.js stores it

(async () => {
  const env = await initializeTestEnvironment({ projectId: 'demo-b2a', firestore: { rules: RULES, host: '127.0.0.1', port: 8089 } });
  // starting data, written with rules switched off
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc('teams/b2a').set({ ownerUid: 'coach', opponents: ['Sharks'], activeGame: 'g1', ratings: { x: 1 }, teamPlays: [Object.assign({ id: 'team-a' }, PLAY)], updated: 'x' });
    await db.doc('teams/b2a/members/coach@x.com').set({ role: 'coach', name: 'Coach' });
    await db.doc('teams/b2a/members/ed@x.com').set({ role: 'editor', name: 'Ed' });
    await db.doc('teams/b2a/members/pat@x.com').set({ role: 'player', name: 'Pat', playerId: 'p1' });
    await db.doc('teams/b2a/roster/p1').set(ROSTER);
    await db.doc('teams/b2a/roster/p2').set(Object.assign({}, ROSTER, { id: 'p2', name: 'Sam' }));
    await db.doc('teams/b2a/games/g1').set(GAME);
    await db.doc('teams/b2a/log/l0').set(Object.assign(LOG('ed'), { id: 'l0' }));
  });
  const as = (uid, email, verified = true) => env.authenticatedContext(uid, { email, email_verified: verified }).firestore();
  const coach = as('coach', 'coach@x.com'), ed = as('ed', 'ed@x.com'), pat = as('pat', 'pat@x.com');
  const out = as('zed', 'zed@x.com'), unver = as('pat', 'pat@x.com', false), anon = env.unauthenticatedContext().firestore();
  const del = require('firebase/compat/app').default.firestore.FieldValue.delete;

  console.log('-- who can read');
  await t('player reads the team', pat.doc('teams/b2a').get(), true);
  await t('player reads team plays', pat.collection('teams/b2a/plays').get(), true);
  await t('player reads ratings', pat.collection('teams/b2a/ratings').get(), true);
  await t('outsider can’t read the team', out.doc('teams/b2a').get(), false);
  await t('outsider can’t read plays', out.collection('teams/b2a/plays').get(), false);
  await t('unverified email can’t read', unver.doc('teams/b2a').get(), false);
  await t('signed-out can’t read', anon.collection('teams/b2a/log').get(), false);

  console.log('-- team doc');
  await t('editor updates opponents/activeGame (merge)', ed.doc('teams/b2a').set({ opponents: ['Sharks', 'Jets'], activeGame: 'g1', updated: 'y' }, { merge: true }), true);
  await t('old-layout save (ratings + teamPlays fields) still allowed', ed.doc('teams/b2a').set({ ratings: { x: -1 }, teamPlays: [Object.assign({ id: 'team-a' }, PLAY)] }, { merge: true }), true);
  await t('player can’t change the team doc', pat.doc('teams/b2a').set({ activeGame: null }, { merge: true }), false);
  await t('editor can’t take over ownership', ed.doc('teams/b2a').set({ ownerUid: 'ed' }, { merge: true }), false);
  await t('opponents must be a list', ed.doc('teams/b2a').set({ opponents: 'Sharks' }, { merge: true }), false);
  await t('the move: editor clears the old fields', ed.doc('teams/b2a').set({ teamPlays: del(), ratings: del() }, { merge: true }), true);

  console.log('-- team plays');
  await t('editor saves a team play', ed.doc('teams/b2a/plays/team-a').set(PLAY), true);
  await t('coach saves a team play', coach.doc('teams/b2a/plays/team-b').set(Object.assign({}, PLAY, { name: 'Bravo' })), true);
  await t('player can’t save a team play', pat.doc('teams/b2a/plays/team-c').set(PLAY), false);
  await t('play without a name is rejected', ed.doc('teams/b2a/plays/team-d').set(Object.assign({}, PLAY, { name: null })), false);
  await t('play with extra fields is rejected', ed.doc('teams/b2a/plays/team-d').set(Object.assign({}, PLAY, { junk: 1 })), false);
  await t('unpacked play (lists inside lists) can’t be stored at all', Promise.resolve().then(() => ed.doc('teams/b2a/plays/team-e').set(RAW)).then(() => { throw new Error('stored'); }, (e) => { if (!/Nested arrays/.test(e.message)) throw e; }), true);
  await t('player can’t delete a team play', pat.doc('teams/b2a/plays/team-a').delete(), false);
  await t('editor deletes a team play', ed.doc('teams/b2a/plays/team-b').delete(), true);

  console.log('-- ratings');
  await t('editor rates 👍', ed.doc('teams/b2a/ratings/slant-flat').set({ v: 1 }), true);
  await t('coach rates 👎', coach.doc('teams/b2a/ratings/stick').set({ v: -1 }), true);
  await t('rating of 2 is rejected', ed.doc('teams/b2a/ratings/x').set({ v: 2 }), false);
  await t('rating with extra fields is rejected', ed.doc('teams/b2a/ratings/x').set({ v: 1, note: 'hi' }), false);
  await t('player can’t rate', pat.doc('teams/b2a/ratings/x').set({ v: 1 }), false);
  await t('editor removes a rating', ed.doc('teams/b2a/ratings/stick').delete(), true);

  console.log('-- opponent rosters (scout)');
  const SCOUT = { name: 'Sharks', notes: 'fast', players: [{ id: 'a', name: 'Gunner', number: '', off: 'QB', def: '', speed: 0, arm: 2 }] };
  await t('editor saves an opponent roster', ed.doc('teams/b2a/scout/o1').set(SCOUT), true);
  await t('coach updates it', coach.doc('teams/b2a/scout/o1').set(Object.assign({}, SCOUT, { notes: 'very fast' })), true);
  await t('player reads opponent rosters', pat.collection('teams/b2a/scout').get(), true);
  await t('outsider can’t read them', out.collection('teams/b2a/scout').get(), false);
  await t('player can’t edit an opponent roster', pat.doc('teams/b2a/scout/o1').set(SCOUT), false);
  await t('opponent without a name is rejected', ed.doc('teams/b2a/scout/o2').set(Object.assign({}, SCOUT, { name: '' })), false);
  await t('opponent with extra fields is rejected', ed.doc('teams/b2a/scout/o2').set(Object.assign({}, SCOUT, { id: 'o2' })), false);
  await t('more than 30 players is rejected', ed.doc('teams/b2a/scout/o2').set(Object.assign({}, SCOUT, { players: Array.from({ length: 31 }, (_, i) => ({ id: 'p' + i })) })), false);
  await t('player can’t delete an opponent roster', pat.doc('teams/b2a/scout/o1').delete(), false);
  await t('editor deletes an opponent roster', ed.doc('teams/b2a/scout/o1').delete(), true);

  console.log('-- roster');
  await t('editor adds a player', ed.doc('teams/b2a/roster/p3').set(Object.assign({}, ROSTER, { id: 'p3', name: 'Lee' })), true);
  await t('blank name is rejected', ed.doc('teams/b2a/roster/p4').set(Object.assign({}, ROSTER, { id: 'p4', name: '' })), false);
  await t('player edits own profile', pat.doc('teams/b2a/roster/p1').set(Object.assign({}, ROSTER, { strengths: ['hands'] })), true);
  await t('player can’t edit someone else', pat.doc('teams/b2a/roster/p2').set(Object.assign({}, ROSTER, { id: 'p2' })), false);
  await t('player can’t remove a roster entry', pat.doc('teams/b2a/roster/p1').delete(), false);

  console.log('-- games');
  await t('editor creates a game', ed.doc('teams/b2a/games/g2').set(Object.assign({}, GAME, { id: 'g2', opp: 'Jets' })), true);
  await t('negative score is rejected', ed.doc('teams/b2a/games/g2').set(Object.assign({}, GAME, { us: -6 })), false);
  await t('score as text is rejected', ed.doc('teams/b2a/games/g2').set(Object.assign({}, GAME, { us: '6' })), false);
  await t('player runs the scoreboard + downs', pat.doc('teams/b2a/games/g1').set(Object.assign({}, GAME, { us: 6, series: { down: 2, sit: 'past' }, half: 2 })), true);
  await t('player can’t change the game plan', pat.doc('teams/b2a/games/g1').set(Object.assign({}, GAME, { us: 6, series: { down: 2, sit: 'past' }, half: 2, plan: { off: [], def: [] } })), false);
  await t('player can’t delete a game', pat.doc('teams/b2a/games/g1').delete(), false);

  console.log('-- results log');
  await t('player logs a play', pat.doc('teams/b2a/log/l1').set(LOG('pat')), true);
  await t('player can’t log as someone else', pat.doc('teams/b2a/log/l2').set(LOG('ed')), false);
  await t('log with an unknown side is rejected', pat.doc('teams/b2a/log/l3').set(Object.assign(LOG('pat'), { side: 'special' })), false);
  await t('player removes own log entry', pat.doc('teams/b2a/log/l1').delete(), true);
  await t('player can’t remove someone else’s entry', pat.doc('teams/b2a/log/l0').delete(), false);
  await t('editor removes any entry', ed.doc('teams/b2a/log/l0').delete(), true);

  console.log('-- team access');
  await t('coach adds a player', coach.doc('teams/b2a/members/new@x.com').set({ role: 'player', playerId: null, name: '', addedAt: 'x', addedBy: 'coach@x.com' }), true);
  await t('made-up role is rejected', coach.doc('teams/b2a/members/new2@x.com').set({ role: 'admin' }), false);
  await t('editor can’t add people', ed.doc('teams/b2a/members/new3@x.com').set({ role: 'player' }), false);
  await t('player can’t make themselves coach', pat.doc('teams/b2a/members/pat@x.com').update({ role: 'coach' }), false);
  await t('coach links a member to a roster player', coach.doc('teams/b2a/members/pat@x.com').update({ playerId: 'p1', name: 'Pat' }), true);

  console.log('-- first-time setup');
  await t('new coach can see an unclaimed team doesn’t exist', as('n', 'n@x.com').doc('teams/other').get(), true);
  await t('new coach claims an empty team', as('n', 'n@x.com').doc('teams/other').set({ ownerUid: 'n', opponents: [], activeGame: null, ratings: {}, teamPlays: [], updated: 'x' }), true);

  await env.cleanup();
  console.log('\n' + (failed ? failed + ' of ' + n + ' rule checks FAILED' : 'All ' + n + ' rule checks passed.'));
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
