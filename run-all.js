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
    };
    const p = await page(b, URL, { viewport: { width: 390, height: 844 }, mock: true, init });
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

  await b.close(); srv.close();
  console.log('\n' + (failed ? failed + ' check(s) FAILED' : 'All checks passed.'));
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
