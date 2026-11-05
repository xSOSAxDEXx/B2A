/* Style comparison: renders ~58 screens (every tab, desktop/tablet/phone, print, signed in) in an OLD and a NEW copy of the site and reports any computed-style difference on any element. Use before shipping a CSS cleanup.
   Usage: node style-compare.js <old-site-folder> <new-site-folder>   (ONLY=plays,gameday … limits the screens; web fonts are blocked so text sizes are identical every run) */
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const SITES = [path.resolve(process.argv[2]), path.resolve(process.argv[3])];
const MOCK = fs.readFileSync('/home/user/B2A-tests/mockfb.js', 'utf8');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const mk = (SITE) => http.createServer((q, r) => { let f = path.join(SITE, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html'; if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'text/plain' }); fs.createReadStream(f).pipe(r); });
const SEED = () => { let s = 12345; Math.random = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; Date.now = () => 1762300000000; };
const NOLOGIN = () => { Object.defineProperty(window, 'B2A_FIREBASE_CONFIG', { get() { return null; }, set() { } }); };
const DUMP = () => {
  const out = {}; const props = [...getComputedStyle(document.body)].filter(p => !/^(transition|animation)/.test(p));
  // skip the insides of small thumbnail diagrams (hundreds of identical SVG shapes each) — the big field and every other element are checked
  const els = [...document.querySelectorAll('body *')].filter(e => !e.closest('.thumb svg *, .cell svg *, .qz-opt svg *, .cov svg *'));
  const key = e => { let k = [], n = e; while (n && n !== document.body) { const i = n.parentNode ? [...n.parentNode.children].indexOf(n) : 0; k.unshift(n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + ':' + i); n = n.parentNode; } return k.join('>'); };
  for (const e of [...document.querySelectorAll('html, body')].concat(els)) { const cs = getComputedStyle(e); const o = {}; for (let i = 0; i < props.length; i++) o[props[i]] = cs.getPropertyValue(props[i]); out[e === document.documentElement ? 'html' : e === document.body ? 'body' : key(e)] = o; }
  return out;
};
const diffs = []; let total = 0;
function compare(name, A, B) {
  for (const e of new Set([...Object.keys(A), ...Object.keys(B)])) {
    if (!A[e] || !B[e]) { diffs.push(name + ' element only in ' + (A[e] ? 'OLD' : 'NEW') + ': ' + e.slice(-90)); continue; }
    for (const p of Object.keys(A[e])) if (A[e][p] !== B[e][p]) diffs.push(name + ' ' + p + ': ' + A[e][p] + ' → ' + B[e][p] + '  [' + e.split('>').slice(-2).join('>') + ']');
  }
  total += Object.keys(A).length;
}
async function state(b, name, vp, setup, opts = {}) {
  const A = await state1(URLS[0], b, name, vp, setup, opts), B = await state1(URLS[1], b, name, vp, setup, opts);
  compare(A[0], A[1], B[1]); process.stdout.write(A[0] + ' ' + Object.keys(A[1]).length + '\n'); return [A[0], {}];
}
async function state1(URL, b, name, vp, setup, opts = {}) {
  const ctx = await b.newContext({ viewport: vp, timezoneId: 'America/New_York' }); const p = await ctx.newPage();
  p.on('dialog', d => d.accept());
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());   // same fallback font every run, so text sizes can't wobble
  if (opts.mock) await p.route(/gstatic\.com\/firebasejs/, r => r.fulfill({ contentType: 'text/javascript', body: r.request().url().includes('firebase-app') ? MOCK : '' }));
  await p.addInitScript(SEED); await p.addInitScript(opts.init || NOLOGIN, opts.arg);
  await p.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '*{transition:none!important;animation:none!important;caret-color:transparent!important}'; document.head.appendChild(s); }); });
  await p.goto(URL); await p.waitForTimeout(400);
  await setup(p); await p.waitForTimeout(250);
  if (opts.print) await p.emulateMedia({ media: 'print' });
  await p.mouse.move(0, 0);
  const d = await p.evaluate(DUMP); await ctx.close(); return [name + '@' + vp.width, d];
}
let URLS;
(async () => {
  const srvs = SITES.map(mk); await Promise.all(srvs.map(sv => new Promise(r => sv.listen(0, r))));
  URLS = srvs.map(sv => 'http://localhost:' + sv.address().port + '/');
  const b = await chromium.launch(), res = {};
  const seedData = async (p) => { await p.evaluate(() => {
    const ST = APP.ST; ST.S.data.roster = [{ id: 'p1', name: 'Al', number: '1', offPos: 'QB', defPos: 'B', offAlt: [], defAlt: ['S'], strengths: ['arm'], weaknesses: ['speed'], notes: 'n' }, { id: 'p2', name: 'Bo', number: '2', offPos: 'WR', defPos: 'CB', offAlt: ['C'], defAlt: [], strengths: ['hands'], weaknesses: [], notes: '' }];
    const g = ST.newGame('Sharks', '2026-11-07'); g.plan.off = APP.offPlays().slice(0, 3).map(x => x.id); g.plan.def = APP.defPlays().slice(0, 2).map(x => x.id);
    g.assign.off[g.plan.off[0]] = { QB: 'p1', X: 'p1' };
    ['td', 'gain', 'inc'].forEach((r, i) => ST.logPlay({ side: 'off', play: g.plan.off[i], down: 1 + i, sit: 'own', result: r, yds: 5 }));
    ST.logPlay({ side: 'def', play: g.plan.def[0], down: 1, sit: 'own', result: 'stop', yds: null });
    ST.rate(g.plan.off[0], 1); ST.save(); }); };
  const S = [
    ['plays', async p => { }],
    ['plays-vs', async p => { await p.selectOption('#v-vs', { index: 2 }); await p.click('#v-adjust'); await p.click('#v-flip'); }],
    ['plays-def', async p => { await p.click('#side-switch [data-side="def"]'); }],
    ['plays-data', async p => { await seedData(p); await p.click('.tab[data-tab="plays"]'); }],
    ['gameday-empty', async p => { await p.click('.tab[data-tab="gameday"]'); await p.click('#gd-new-game'); }],
    ['gameday', async p => { await seedData(p); await p.click('.tab[data-tab="gameday"]'); await p.click('#gd-recs .rec'); await p.selectOption('#lg-side', 'def'); }],
    ['stats', async p => { await seedData(p); await p.click('.tab[data-tab="stats"]'); }],
    ['quiz', async p => { await seedData(p); await p.click('.tab[data-tab="quiz"]'); }],
    ['quiz-q', async p => { await p.click('.tab[data-tab="quiz"]'); await p.selectOption('#qz-src', 'all'); await p.click('.pos[data-pos="X"]'); await p.click('.qz-opt >> nth=0'); }],
    ['quiz-done', async p => { await p.click('.tab[data-tab="quiz"]'); await p.selectOption('#qz-src', 'all'); await p.selectOption('#qz-n', '5'); await p.click('.pos[data-pos="QB"]'); for (let i = 0; i < 5; i++) { await p.click('.qz-opt >> nth=0'); await p.click('#qz-next'); } }],
    ['roster', async p => { await seedData(p); await p.click('.tab[data-tab="roster"]'); await p.click('.ro-card'); }],
    ['designer', async p => { await p.click('.tab[data-tab="designer"]'); await p.click('#d-add-ev'); await p.click('#d-tags .chip'); }],
    ['guide', async p => { await p.click('.tab[data-tab="guide"]'); }],
    ['guide-cov', async p => { await p.click('.tab[data-tab="guide"]'); await p.click('#guide-switch [data-g="coverages"]'); }],
    ['guide-rules', async p => { await p.click('.tab[data-tab="guide"]'); await p.click('#guide-switch [data-g="rules"]'); }],
    ['help', async p => { await p.click('.tab[data-tab="help"]'); }],
    ['toast', async p => { await p.evaluate(() => APP.toast('Hello')); }],
  ];
  for (const vp of [{ width: 1366, height: 900 }, { width: 390, height: 844 }, { width: 800, height: 900 }]) {
    for (const [n, f] of S) if (!process.env.ONLY || process.env.ONLY.split(',').includes(n)) await state(b, n, vp, f);
  }
  if (process.env.ONLY && !process.env.ONLY.includes('print')) { console.log('\nelements compared: ' + total + ', differences: ' + diffs.length + (diffs.length ? '' : '  → IDENTICAL')); [...new Set(diffs)].slice(0, 40).forEach(d => console.log('  ' + d)); process.exit(0); }
  const pr = await state(b, 'print', { width: 1000, height: 900 }, async p => { await p.evaluate(() => { window.print = () => { }; window.confirm = () => false; }); await p.click('#print-btn'); }, { print: true }); res[pr[0]] = pr[1];
  // signed in (fake Firebase): gate, coach view with access card, offline badge
  const init = (a) => { window.__mockUser = { uid: 'u1', email: a.email, displayName: 'Coach', emailVerified: true, providerData: [], reload: () => Promise.resolve(), getIdToken: () => Promise.resolve() };
    window.__fs = { 'teams/b2a': { ownerUid: 'u1', opponents: ['Sharks'], activeGame: 'g1' }, 'teams/b2a/members/coach@x.com': { role: 'coach', name: 'Coach' }, 'teams/b2a/members/pat@x.com': { role: 'player', name: 'Pat', playerId: 'p1' },
      'teams/b2a/roster/p1': { id: 'p1', name: 'Pat', number: '7', offPos: 'WR', defPos: 'CB' },
      'teams/b2a/games/g1': { id: 'g1', opp: 'Sharks', date: '2026-11-07', us: 0, them: 0, plan: { off: [], def: [] }, assign: { off: {}, def: {} }, series: { down: 1, sit: 'own' }, half: 1, to: {} } }; };
  for (const vp of [{ width: 1366, height: 900 }, { width: 390, height: 844 }]) {
    let r = await state(b, 'gate', vp, async p => { }, { mock: true, init, arg: { email: 'coach@x.com' } }); res[r[0]] = r[1];
    const login = async p => { await p.fill('#g-email', 'c@x.com'); await p.fill('#g-pass', 'secret1'); await p.click('#g-in'); await p.waitForTimeout(700); };
    r = await state(b, 'coach-roster', vp, async p => { await login(p); await p.click('.tab[data-tab="roster"]'); }, { mock: true, init, arg: { email: 'coach@x.com' } }); res[r[0]] = r[1];
    r = await state(b, 'player-gameday-offline', vp, async p => { await login(p); await p.click('.tab[data-tab="gameday"]'); await p.context().setOffline(true); await p.evaluate(() => { B2A_CLOUD.pending = 2; APP.onSyncChange(); }); }, { mock: true, init, arg: { email: 'pat@x.com' } }); res[r[0]] = r[1];
  }
  const uniq = [...new Set(diffs.map(d => d.replace(/^\S+ /, '')))];
  console.log('\nelements compared: ' + total + ', differences: ' + diffs.length + (diffs.length ? '' : '  → IDENTICAL'));
  uniq.slice(0, 80).forEach(d => console.log('  ' + d));
  fs.writeFileSync('diffs.txt', diffs.join('\n'));
  await b.close(); srvs.forEach(sv => sv.close());
})();
