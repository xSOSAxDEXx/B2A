/* B2A Playbook browser tests — run before every push to main.
   Usage:  node run-all.js [path-to-site]      (default: ../B2A)
   Needs Playwright with Chromium (preinstalled in Claude Code cloud sessions).
   Serves the site on its own little web server, runs every check in headless Chromium,
   prints PASS/FAIL per check, and exits with code 1 if anything failed. Never touches real Firebase:
   checks run either with logins switched off or against an in-memory fake (mockfb.js). */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const SITE = path.resolve(process.argv[2] || path.join(__dirname, '..', 'B2A'));
const MOCK = fs.readFileSync(path.join(__dirname, 'mockfb.js'), 'utf8');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

let failed = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || detail === undefined ? '' : '  →  ' + JSON.stringify(detail)));
  if (!ok) failed++;
}

function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      let f = path.join(SITE, decodeURIComponent(req.url.split('?')[0]));
      if (f.endsWith('/')) f += 'index.html';
      if (!f.startsWith(SITE) || !fs.existsSync(f)) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(rsp);
    }).listen(0, () => res(srv));
  });
}

const NO_LOGIN = () => { Object.defineProperty(window, 'B2A_FIREBASE_CONFIG', { get() { return null; }, set() { } }); };

async function page(b, url, opts = {}) {
  const ctx = await b.newContext({ viewport: opts.viewport || { width: 1366, height: 900 }, timezoneId: 'America/New_York' });
  const p = await ctx.newPage();
  p.errs = [];
  p.on('pageerror', e => p.errs.push(e.message));
  p.on('dialog', d => d.accept());
  if (opts.mock) await p.route(/gstatic\.com\/firebasejs/, r => r.fulfill({ contentType: 'text/javascript', body: r.request().url().includes('firebase-app') ? MOCK : '' }));
  await p.addInitScript(opts.init || NO_LOGIN, opts.arg);
  await p.goto(url); await p.waitForTimeout(500);
  return p;
}

(async () => {
  if (!fs.existsSync(path.join(SITE, 'index.html'))) { console.error('No index.html in ' + SITE); process.exit(2); }
  const srv = await serve(), URL = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch();
  console.log('Testing ' + SITE + '\n');

  /* 1. every tab loads without errors or sideways scroll, desktop and phone */
  for (const vp of [{ width: 1366, height: 900 }, { width: 390, height: 844 }]) {
    const p = await page(b, URL, { viewport: vp }), bad = [];
    for (const t of ['plays', 'gameday', 'stats', 'quiz', 'roster', 'designer', 'guide', 'help']) {
      await p.click(`.tab[data-tab="${t}"]`); await p.waitForTimeout(200);
      const ow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (ow > 0) bad.push(t + ' scrolls sideways ' + ow + 'px');
    }
    check(`all tabs load cleanly at ${vp.width}px`, !bad.length && !p.errs.length, bad.concat(p.errs));
    if (vp.width === 1366) {
      const v = await p.evaluate(() => [...document.querySelectorAll('script[src^="js/"], link[href^="css/"]')].map(e => (e.src || e.href).split('?v=')[1]));
      check('every script/stylesheet has the same ?v= version', v.length > 10 && v.every(x => x && x === v[0]), v);
    }
    await p.context().close();
  }

  /* 2. playbook: rules check (flipped too) and the simulated outcome mix */
  {
    const p = await page(b, URL);
    const r = await p.evaluate(() => {
      const A = APP, E = A.E, D = A.D, bad = [], mix = {}; let n = 0;
      A.offPlays().forEach(pl => [pl, E.flipPlay(pl)].forEach((q, k) => { if (!E.validate(q).legal) bad.push(pl.id + (k ? ' (flipped)' : '')); }));
      A.offPlays().forEach(pl => A.defPlays().forEach(d => { const k = D.simulate(d, E.buildSim(pl)).result.kind; mix[k] = (mix[k] || 0) + 1; n++; }));
      Object.keys(mix).forEach(k => mix[k] = +(100 * mix[k] / n).toFixed(1));
      const blitz = A.defPlays().flatMap(d => d.defenders.filter(x => x.job === 'blitz').map(x => [d.id, x.start]))
        .filter(([, s]) => !(s[1] >= 7 && Math.abs(s[0] - 12.5) >= 1)).map(([id]) => id);
      return { bad, mix, blitz, nOff: A.offPlays().length, nDef: A.defPlays().length };
    });
    check(`all ${r.nOff} plays pass the rules check (and flipped)`, !r.bad.length, r.bad);
    check('every blitzer lines up 7+ yds deep and 1+ yd off the ball', !r.blitz.length, r.blitz);
    console.log('     outcome mix (%): ' + JSON.stringify(r.mix));
    check('interceptions 3–15% and incompletions 20–50% across plays × coverages', r.mix.int >= 3 && r.mix.int <= 15 && r.mix.inc >= 20 && r.mix.inc <= 50, r.mix);
    const words = await p.evaluate(() => /\brush(er|ing|es)?\b/i.test(document.body.innerText + document.documentElement.innerHTML));
    check('no "rush/rusher" wording anywhere on the page', !words);
    check('no script errors', !p.errs.length, p.errs);
    await p.context().close();
  }

  /* 3. Plays tab: animation keeps running through a data change */
  {
    const p = await page(b, URL);
    await p.click('#v-play'); await p.waitForTimeout(300);
    await p.click('#v-rate button[data-r="1"]'); await p.waitForTimeout(200);
    check('rating a play doesn’t restart the running animation', (await p.textContent('#v-play')).includes('Pause'));
    await p.context().close();
  }

  /* 4. Game Day flow */
  {
    const p = await page(b, URL, { viewport: { width: 390, height: 844 } });
    await p.click('.tab[data-tab="gameday"]'); await p.click('#gd-new-game');
    const date = await p.inputValue('#gd-date-in');
    check('new game defaults to a local date in YYYY-MM-DD', /^\d{4}-\d\d-\d\d$/.test(date), date);
    await p.fill('#gd-opp-in', 'Sharks'); await p.click('#gd-create'); await p.waitForTimeout(100);
    const series = () => p.evaluate(() => JSON.stringify(APP.ST.game().series));
    await p.selectOption('#gd-sit', 'own'); await p.click('#downs button[data-down="1"]');
    await p.click('#lg-results [data-k="gain"]'); await p.waitForTimeout(80);
    check('a gain moves 1st → 2nd down', (await series()).includes('"down":2'), await series());
    await p.click('#lg-results [data-k="first"]'); await p.waitForTimeout(80);
    check('1st down in our half → past midfield, 1st down', /"down":1.*"sit":"past"|"sit":"past".*"down":1/.test(await series()), await series());
    await p.click('#downs button[data-down="2"]');
    await p.click('#lg-results [data-k="first"]'); await p.waitForTimeout(80);
    check('"1st down" past midfield counts as the next down (3 downs to score)', (await series()).includes('"down":3'), await series());
    await p.click('#lg-results [data-k="short"]'); await p.waitForTimeout(80);
    check('3rd-down miss = turnover on downs (back to own half, 1st)', /"down":1/.test(await series()) && /"sit":"own"/.test(await series()), await series());
    await p.click('#lg-results [data-k="td"]'); await p.waitForTimeout(80);
    check('our TD adds 6 and sets up the try', (await p.textContent('#sc-us')) === '6' && (await series()).includes('pat1'));
    await p.click('#lg-results [data-k="td"]'); await p.waitForTimeout(80);
    check('good 1-pt try adds 1', (await p.textContent('#sc-us')) === '7');
    await p.selectOption('#lg-side', 'def'); await p.click('#lg-results [data-k="td"]'); await p.waitForTimeout(80);
    check('"Gave up TD" adds 6 to their score', (await p.textContent('#sc-them')) === '6');
    await p.click('#gd-notes'); await p.type('#gd-notes', 'they blitz a lot'); await p.waitForTimeout(900);
    await p.evaluate(() => APP.ST.save());
    check('scouting notes survive a re-render while typing', (await p.inputValue('#gd-notes')) === 'they blitz a lot');
    const n0 = await p.evaluate(() => APP.ST.game().log.length);
    await p.click('#lg-list [data-del]'); await p.waitForTimeout(100);
    check('✕ removes a logged play (after confirming)', (await p.evaluate(() => APP.ST.game().log.length)) === n0 - 1);
    await p.click('.tab[data-tab="stats"]'); await p.waitForTimeout(100);
    const tds = await p.evaluate(() => [...document.querySelectorAll('#st-tiles .tile')].find(t => /TDs/.test(t.textContent)).querySelector('b').textContent);
    check('Stats: the PAT isn’t counted as a touchdown', tds === '1', tds);
    await p.reload(); await p.waitForTimeout(500);
    check('reload comes back to the same tab', (await p.evaluate(() => document.querySelector('.tab.active').dataset.tab)) === 'stats');
    check('no script errors in Game Day / Stats', !p.errs.length, p.errs);
    await p.click('.tab[data-tab="gameday"]');
    check('test mode: yellow banner shows; no Publish/token/Discard controls', await p.isVisible('#test-banner') && !(await p.$('#ck-publish, #ck-token, #ck-discard')));
    await p.context().close();
  }

  /* 5. Designer: save, edit, delete a team play */
  {
    const p = await page(b, URL);
    await p.click('#v-edit'); await p.fill('#d-name', 'Test Slant'); await p.click('#d-save'); await p.waitForTimeout(200);
    check('Designer saves a team play and opens it', (await p.textContent('#v-name')).includes('Test Slant'));
    await p.click('#v-del'); await p.waitForTimeout(200);
    check('team play can be deleted', (await p.evaluate(() => APP.ST.S.data.teamPlays.length)) === 0);
    check('no script errors in the Designer', !p.errs.length, p.errs);
    await p.context().close();
  }

  /* 6. Quiz builds full quizzes for every position */
  {
    const p = await page(b, URL), short = [];
    for (const pos of ['QB', 'C', 'X', 'Y', 'Z', 'DEF', 'BLITZ']) {
      await p.click('.tab[data-tab="quiz"]'); if (await p.isVisible('#qz-quit')) await p.click('#qz-quit');
      await p.selectOption('#qz-src', 'all'); await p.selectOption('#qz-n', '10'); await p.click(`.pos[data-pos="${pos}"]`);
      const n = await p.evaluate(() => +document.querySelector('.qz-top span:nth-child(2)').textContent.match(/\/ (\d+)/)[1]);
      if (n < 8) short.push(pos + ':' + n);
      for (let i = 0; i < n; i++) { await p.click('.qz-opt >> nth=0'); await p.click('#qz-next'); }
    }
    check('every position gets a 8–10 question quiz and finishes', !short.length && await p.isVisible('.quiz.done'), short);
    check('no script errors in the Quiz', !p.errs.length, p.errs);
    await p.context().close();
  }

  /* 7. Login + live sync, against the fake Firebase */
  {
    const init = () => {
      window.__mockUser = { uid: 'u2', email: 'Pat@x.com', displayName: 'Google Pat', emailVerified: true, providerData: [{ providerId: 'password' }], reload: () => Promise.resolve(), getIdToken: () => Promise.resolve() };
      window.__fs = { 'teams/b2a': { ownerUid: 'u1', opponents: ['Sharks'], activeGame: 'g1', ratings: {}, teamPlays: [] },
        'teams/b2a/members/pat@x.com': { role: 'player', playerId: 'p1', name: 'Pat Roster' },
        'teams/b2a/roster/p1': { id: 'p1', name: 'Pat Roster', number: '7', offPos: 'WR', defPos: 'CB' },
        'teams/b2a/games/g1': { id: 'g1', opp: 'Sharks', date: '2026-11-07', us: 0, them: 0, plan: { off: [], def: [] }, assign: { off: {}, def: {} }, series: { down: 1, sit: 'own' }, half: 1, to: {} } };
      Object.defineProperty(navigator, 'standalone', { get: () => true });
      localStorage.setItem('b2a.ghtoken', '"github_pat_old"');
    };
    const p = await page(b, URL, { viewport: { width: 390, height: 844 }, mock: true, init });
    check('old GitHub publish token is wiped from the device', (await p.evaluate(() => localStorage.getItem('b2a.ghtoken'))) === null);
    check('signed-in site never shows the test-mode banner', !(await p.isVisible('#test-banner')));
    check('sign-in screen shows (with the iPhone home-screen note)', await p.isVisible('#g-email') && await p.isVisible('.gate-note'));
    await p.fill('#g-email', 'pat@x.com'); await p.fill('#g-pass', 'secret1'); await p.press('#g-pass', 'Enter'); await p.waitForTimeout(800);
    check('Enter signs in; player role applied', (await p.evaluate(() => document.body.className)).includes('role-player'));
    await p.click('.tab[data-tab="gameday"]'); await p.click('#lg-results [data-k="gain"]'); await p.waitForTimeout(300);
    const log = await p.evaluate(() => Object.keys(__fs).filter(k => k.includes('/log/')).map(k => __fs[k]));
    check('player’s logged play is saved with their roster name', log.length === 1 && log[0].by === 'u2' && log[0].byName === 'Pat Roster', log);
    check('downs advance in the shared game', (await p.evaluate(() => __fs['teams/b2a/games/g1'].series.down)) === 2);
    await p.click('.tab[data-tab="plays"]'); await p.click('#v-play'); await p.waitForTimeout(300);
    await p.evaluate(() => firebase.firestore().collection('teams').doc('b2a').update({ ratings: { x: 1 } }));
    await p.waitForTimeout(200);
    check('a teammate’s live change doesn’t restart the animation', (await p.textContent('#v-play')).includes('Pause'));
    await p.click('.tab[data-tab="roster"]'); await p.click('.ro-card[data-id="p1"]');
    check('player can open own profile but sees no Remove button', await p.isVisible('#rf-save') && !(await p.isVisible('#rf-del')));
    check('no script errors when signed in', !p.errs.length, p.errs);
    await p.context().close();
  }

  /* 8. Phase 3: team plays + ratings in their own documents, old-rules fallback, offline */
  {
    const seed = (args) => {
      window.__mockUser = { uid: 'u1', email: args.email, displayName: 'Coach', emailVerified: true, providerData: [{ providerId: 'google.com' }], reload: () => Promise.resolve(), getIdToken: () => Promise.resolve() };
      window.__denyNew = args.deny;
      const play = (id, name) => ({ id, name, cat: 'team', formation: 'spread', tags: ['pass'], players: {}, events: [{ type: 'pass', from: 'QB', to: 'X', brk: 0 }] });
      window.__fs = { 'teams/b2a': { ownerUid: 'u1', opponents: [], activeGame: null, ratings: { 'slant-flat': 1, 'team-a': -1 }, teamPlays: [play('team-a', 'Alpha'), play('team-b', 'Bravo')] },
        'teams/b2a/members/coach@x.com': { role: 'coach', name: 'Coach' }, 'teams/b2a/members/pat@x.com': { role: 'player', name: 'Pat' } };
    };
    const signIn = async (p) => { await p.fill('#g-email', 'x@x.com'); await p.fill('#g-pass', 'secret1'); await p.press('#g-pass', 'Enter'); await p.waitForTimeout(900); };
    const names = (p) => p.evaluate(() => APP.offPlays().filter(x => x.custom).map(x => x.name).join(','));

    // (a) rules not published yet: everything keeps working on the old layout
    let p = await page(b, URL, { mock: true, init: seed, arg: { email: 'coach@x.com', deny: true } });
    await signIn(p);
    check('old rules: coach still gets in (no lock-out)', !(await p.evaluate(() => document.body.classList.contains('gated'))));
    check('old rules: team plays + ratings still load from the old fields', (await names(p)) === 'Alpha,Bravo' && (await p.evaluate(() => APP.ST.rating('slant-flat'))) === 1);
    await p.click('#v-rate button[data-r="-1"]'); await p.waitForTimeout(300);
    check('old rules: a rating saves to the old field', (await p.evaluate(() => __fs['teams/b2a'].ratings['slant-flat'])) === -1);
    await p.click('#v-edit'); await p.fill('#d-name', 'Routes'); await p.click('#d-save'); await p.waitForTimeout(400);
    check('old rules: a team play with real routes saves (stored packed)', (await p.evaluate(() => (__fs['teams/b2a'].teamPlays || []).map(x => x.name).join())) === 'Alpha,Bravo,Routes');
    check('old rules: nothing written to the new places', (await p.evaluate(() => Object.keys(__fs).some(k => /\/(plays|ratings)\//.test(k)))) === false);
    check('no script errors (old rules)', !p.errs.length, p.errs);
    await p.context().close();

    // (b) new rules: the coach's first visit moves plays + ratings into their own documents
    p = await page(b, URL, { mock: true, init: seed, arg: { email: 'coach@x.com', deny: false } });
    await signIn(p); await p.waitForTimeout(400);
    const st = await p.evaluate(() => ({ meta: Object.keys(__fs['teams/b2a']), plays: Object.keys(__fs).filter(k => k.includes('/plays/')).sort(), ratings: Object.keys(__fs).filter(k => k.includes('/ratings/')).map(k => k.split('/').pop() + '=' + __fs[k].v).sort() }));
    check('new rules: old fields removed from the team doc', !st.meta.includes('teamPlays') && !st.meta.includes('ratings'), st.meta);
    check('new rules: each team play is its own document', st.plays.join() === 'teams/b2a/plays/team-a,teams/b2a/plays/team-b', st.plays);
    check('new rules: each rating is its own document', st.ratings.join() === 'slant-flat=1,team-a=-1', st.ratings);
    check('new rules: plays keep their order (T1 Alpha, T2 Bravo)', (await names(p)) === 'Alpha,Bravo');
    await p.click('#v-rate button[data-r="1"]'); await p.waitForTimeout(300);
    check('rating toggled off deletes its document', !(await p.evaluate(() => 'teams/b2a/ratings/slant-flat' in __fs)));
    await p.click('#v-edit'); await p.fill('#d-name', 'Charlie'); await p.click('#d-save'); await p.waitForTimeout(400);
    check('a new team play is saved as its own document, listed last', (await names(p)) === 'Alpha,Bravo,Charlie' && (await p.evaluate(() => Object.keys(__fs).filter(k => k.includes('/plays/')).length)) === 3);
    await p.click('#v-del'); await p.waitForTimeout(400);
    check('deleting a team play deletes its document', (await p.evaluate(() => Object.keys(__fs).filter(k => k.includes('/plays/')).length)) === 2);
    // a save Firestore refuses must say so and must not block the next save
    const toasts = []; await p.exposeFunction('__toast', m => toasts.push(m));
    await p.evaluate(() => { const o = APP.toast; APP.toast = m => { __toast(m); o(m); }; APP.ST.S.data.roster.push({ id: 'px', name: 'Bad', weird: [[1, 2]] }); APP.ST.save(); });
    await p.waitForTimeout(300);
    check('a refused save shows "Couldn’t save" instead of failing silently', toasts.some(m => /Couldn’t save/.test(m)), toasts);
    await p.evaluate(() => { APP.ST.S.data.opponents.push('Jets'); APP.ST.save(); }); await p.waitForTimeout(300);
    check('…and the next save still goes through', (await p.evaluate(() => (__fs['teams/b2a'].opponents || []).includes('Jets'))));
    // offline indicator + offline cache
    check('offline cache is switched on', await p.evaluate(() => window.__persistence === true));
    await p.context().setOffline(true); await p.waitForTimeout(200);
    check('no signal: "Offline" badge shows in the header', (await p.isVisible('#sync-badge')) && /Offline/.test(await p.textContent('#sync-badge')));
    await p.context().setOffline(false); await p.waitForTimeout(200);
    check('signal back: badge goes away', !(await p.isVisible('#sync-badge')));
    await p.evaluate(() => { window.confirm = () => true; }); await p.click('#uc-out'); await p.waitForTimeout(600);
    check('sign out wipes the team data saved on the device', (await p.evaluate(() => sessionStorage.getItem('__cleared'))) === '1');
    check('no script errors (new rules)', !p.errs.length, p.errs);
    await p.context().close();

    // (c) a player on the new rules before any coach has visited: sees everything, moves nothing
    p = await page(b, URL, { mock: true, init: seed, arg: { email: 'pat@x.com', deny: false } });
    await signIn(p);
    check('player sees team plays from the old fields while waiting for the coach', (await names(p)) === 'Alpha,Bravo');
    check('player doesn’t try to move the data (not allowed to)', (await p.evaluate(() => 'teamPlays' in __fs['teams/b2a'] && !Object.keys(__fs).some(k => k.includes('/plays/')))));
    check('no script errors (player)', !p.errs.length, p.errs);
    await p.context().close();
  }

  /* 9. Opponent scouting: roster + ratings, used by the simulation */
  {
    const p = await page(b, URL);
    await p.click('.tab[data-tab="roster"]');
    await p.click('#op-add'); await p.fill('#of-name', 'Sharks'); await p.fill('#of-notes', 'Fast secondary');
    const row = (i) => `#of-players .op-prow >> nth=${i}`;
    await p.fill(row(0) + ' >> [data-f="name"]', 'Gunner'); await p.selectOption(row(0) + ' >> [data-f="off"]', 'QB');
    check('arm rating only shows for a QB', await p.isVisible(row(0) + ' >> [data-f="arm"]'));
    await p.selectOption(row(0) + ' >> [data-f="arm"]', '2');
    await p.click('#of-addp'); await p.fill(row(1) + ' >> [data-f="name"]', 'Flash'); await p.selectOption(row(1) + ' >> [data-f="def"]', 'S'); await p.selectOption(row(1) + ' >> [data-f="speed"]', '2');
    await p.click('#of-addp'); await p.fill(row(2) + ' >> [data-f="name"]', 'Slow Joe'); await p.selectOption(row(2) + ' >> [data-f="def"]', 'CB'); await p.selectOption(row(2) + ' >> [data-f="speed"]', '-2');
    await p.click('#of-save'); await p.waitForTimeout(200);
    const o = await p.evaluate(() => APP.ST.S.data.scout[0]);
    check('opponent saved with 3 rated players', o && o.name === 'Sharks' && o.players.length === 3 && o.players[0].arm === 2 && o.players[1].speed === 2, o);
    check('opponents list shows the summary', /Safeties much faster/.test(await p.textContent('#op-list')) && /QB much stronger arm/.test(await p.textContent('#op-list')));
    check('their name joins the opponent list for Game Day', await p.evaluate(() => APP.ST.S.data.opponents.includes('Sharks')));
    // the simulation: their safety runs faster, their corner slower, their QB's passes arrive sooner
    const sim = await p.evaluate(() => {
      const A = APP, S = A.scout, o = A.ST.S.data.scout[0], def = A.findDef('cover2'), off = A.findOff('smash');
      const t = S.tuneDef(def, o.id), sp = (d, pos) => d.defenders.filter(x => A.D.posOf(x) === pos).map(x => x.spd);
      const q = A.findOff('slant-flat'), f0 = A.E.buildSim(q).P.events[0].flight, f1 = A.E.buildSim(S.tuneOff(q, o.id)).P.events[0].flight;
      return { S: sp(t, 'S'), CB: sp(t, 'CB'), f0, f1 };
    });
    check('their safeties run faster, corners slower in the sim', sim.S.every(v => v > 1.1) && sim.CB.every(v => v < 0.9), sim);
    check('a strong-armed QB gets the ball there sooner', sim.f1 < sim.f0, sim);
    // Game Day links to it, and the Plays viewer defaults to this week's opponent
    await p.click('.tab[data-tab="gameday"]'); await p.click('#gd-new-game'); await p.fill('#gd-opp-in', 'sharks'); await p.click('#gd-create'); await p.waitForTimeout(200);
    check('Game Day shows their roster summary (name matched ignoring case)', /Their roster: 3 players/.test(await p.textContent('#gd-scout-line')));
    await p.click('.tab[data-tab="plays"]'); await p.selectOption('#v-vs', 'cover2'); await p.waitForTimeout(200);
    check('Plays: "Their players" defaults to this week’s opponent', (await p.isVisible('#v-opp')) && (await p.inputValue('#v-opp')) !== '' && /Sharks/.test(await p.textContent('#v-opp-note')));
    await p.selectOption('#v-opp', ''); await p.waitForTimeout(150);
    check('…and can be switched back to league average', (await p.isHidden('#v-opp-note')));
    await p.click('#side-switch button[data-side="def"]'); await p.waitForTimeout(200); await p.selectOption('#v-opp', { label: 'Sharks' }); await p.waitForTimeout(150);
    check('Defense side: their offense runs with their QB’s arm', /QB much stronger arm/.test(await p.textContent('#v-opp-note')));
    await p.click('.tab[data-tab="roster"]'); await p.click('.op-card[data-name="Sharks"]'); await p.fill('#of-name', 'Sharks FC'); await p.click('#of-save'); await p.waitForTimeout(150);
    check('renaming the team updates its games too', await p.evaluate(() => APP.ST.S.data.games.every(g => g.opp === 'Sharks FC')));
    check('no script errors (opponents)', !p.errs.length, p.errs);
    await p.context().close();
  }
  /* 9b. Opponent rosters in Firebase: saved as their own documents; before the rules allow it, nothing breaks */
  for (const deny of [false, true]) {
    const init = (a) => {
      window.__mockUser = { uid: 'u1', email: 'coach@x.com', displayName: 'Coach', emailVerified: true, providerData: [{ providerId: 'google.com' }], reload: () => Promise.resolve(), getIdToken: () => Promise.resolve() };
      window.__denyScout = a.deny;
      window.__fs = { 'teams/b2a': { ownerUid: 'u1', opponents: ['Jets'], activeGame: null }, 'teams/b2a/members/coach@x.com': { role: 'coach', name: 'Coach' },
        'teams/b2a/scout/o1': { name: 'Jets', notes: '', players: [{ id: 'a', name: 'Rocket', def: 'B', speed: 2 }] } };
    };
    const p = await page(b, URL, { mock: true, init, arg: { deny } });
    await p.fill('#g-email', 'coach@x.com'); await p.fill('#g-pass', 'secret1'); await p.press('#g-pass', 'Enter'); await p.waitForTimeout(900);
    await p.click('.tab[data-tab="roster"]'); await p.waitForTimeout(200);
    if (!deny) {
      check('cloud: opponent rosters load from scout/', /Blitzer much faster/.test(await p.textContent('#op-list')));
      await p.click('.op-card[data-name="Jets"]'); await p.selectOption('#of-players .op-prow >> nth=0 >> [data-f="speed"]', '1'); await p.click('#of-save'); await p.waitForTimeout(300);
      check('cloud: an edit saves to that opponent’s document', await p.evaluate(() => __fs['teams/b2a/scout/o1'].players[0].speed === 1 && !('id' in __fs['teams/b2a/scout/o1'])));
    } else {
      check('rules not published: coach is told to publish them', /publish the updated/.test(await p.textContent('#op-warn')));
      check('…and the rest of the team data still loads', !(await p.evaluate(() => document.body.classList.contains('gated'))) && (await p.evaluate(() => APP.ST.S.data.opponents.includes('Jets'))));
      await p.click('.tab[data-tab="gameday"]'); await p.click('#gd-new-game'); await p.fill('#gd-opp-in', 'Owls'); await p.click('#gd-create'); await p.waitForTimeout(300);
      check('…other saves still go through', await p.evaluate(() => Object.keys(__fs).some(k => k.startsWith('teams/b2a/games/') && __fs[k].opp === 'Owls')));
    }
    check('no script errors (cloud opponents' + (deny ? ', old rules)' : ')'), !p.errs.length, p.errs);
    await p.context().close();
  }

  /* adjust mode: the 📍 pin is the CATCH spot — the ball line must end where the pin sits, even when dragged early */
  {
    const p = await page(b, URL);
    await p.click('#v-adjust'); await p.waitForTimeout(200);
    await p.$eval('#field', e => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(200);
    const geo = () => p.evaluate(() => {
      const svg = document.querySelector('#field'), m = svg.getScreenCTM();
      const toScr = (x, y) => { const q = svg.createSVGPoint(); q.x = x; q.y = y; const r = q.matrixTransform(m); return [r.x, r.y]; };
      const body = svg.querySelector('.pin-body'), line = svg.querySelector('.pass-line');
      if (!body || !line) return null;
      const t = body.getAttribute('d').match(/M([\d.-]+),([\d.-]+)/);
      return { pin: toScr(+t[1], +t[2]), ball: toScr(+line.getAttribute('x2'), +line.getAttribute('y2')), early: !!svg.querySelector('.pin-track.too-early') };
    });
    const g0 = await geo();
    check('adjust mode shows the 📍 pin and the ball line', !!g0, g0);
    const near = (g) => Math.hypot(g.pin[0] - g.ball[0], g.pin[1] - g.ball[1]) < 12;
    check('pin sits on the catch spot before dragging', g0 && near(g0), g0);
    const drag = async (from, dx, dy) => {   // small steps, like a finger
      await p.mouse.move(from[0], from[1] - 10); await p.mouse.down();
      for (let i = 1; i <= 15; i++) await p.mouse.move(from[0] + i * dx, from[1] - 10 + i * dy);
      await p.mouse.up(); await p.waitForTimeout(300);
      return geo();
    };
    const g1 = await drag(g0.pin, 2, -6);   // downfield along the slant
    check('dragged downfield: the catch moves with the pin', g1 && near(g1) && Math.hypot(g1.ball[0] - g0.ball[0], g1.ball[1] - g0.ball[1]) > 20, [g0, g1]);
    const g2 = await drag(g1.pin, -3, 12);  // way back toward the line, past where a throw can get there
    check('dragged too early: pin stops where the ball can first reach him (pin = catch, not throw)', g2 && near(g2), g2);
    check('the too-early start of the route is shown dimmed', g2 && g2.early, g2);
    check('no script errors (adjust mode)', !p.errs.length, p.errs);
    await p.context().close();
  }

  await b.close(); srv.close();
  console.log('\n' + (failed ? failed + ' check(s) FAILED' : 'All checks passed.'));
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
