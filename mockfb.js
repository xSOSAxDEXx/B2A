// in-memory Firebase compat mock (app/auth/firestore) — enough for cloud.js
(function(){
  if (window.firebase) return;
  const store = window.__fs = window.__fs || {};   // path -> data
  const listeners = [];
  const user0 = window.__mockUser;
  let authCb = null, cur = null;
  function notify(){ listeners.slice().forEach(l => l()); }
  const DEL = { __delete: true };
  function apply(base, d){ const out = Object.assign({}, base); Object.keys(d).forEach(k => { if (d[k] && d[k].__delete) delete out[k]; else out[k] = JSON.parse(JSON.stringify(d[k])); }); return out; }
  // window.__denyNew = true acts like the old rules: plays/ and ratings/ are off limits
  function denied(path){ return window.__denyNew && /\/(plays|ratings)(\/|$)/.test(path); }
  const DENY = { code: 'permission-denied', message: 'Missing or insufficient permissions.' };
  // like real Firestore: a list directly inside a list can't be stored
  function nested(v, inList){ if (Array.isArray(v)) return inList || v.some(x => nested(x, true)); if (v && typeof v === 'object') return Object.keys(v).some(k => nested(v[k], false)); return false; }
  function guard(path, d){ if (nested(d, false)) throw Object.assign(new Error('Function DocumentReference.set() called with invalid data. Nested arrays are not supported (found in document ' + path + ')'), { code: 'invalid-argument' }); }
  function docRef(path){ return {
    path, id: path.split('/').pop(),
    collection: n => collRef(path + '/' + n),
    get: () => Promise.resolve(snap(path)),
    set: (d, o) => { guard(path, d); store[path] = o && o.merge ? apply(store[path], d) : apply({}, d); notify(); return Promise.resolve(); },
    update: d => { store[path] = Object.assign({}, store[path], d); notify(); return Promise.resolve(); },
    delete: () => { delete store[path]; notify(); return Promise.resolve(); },
    onSnapshot: (cb) => { const l = () => cb(snap(path)); listeners.push(l); setTimeout(l, 0); return () => listeners.splice(listeners.indexOf(l),1); },
    get ref(){ return docRef(path); }
  };}
  function snap(path){ return { exists: path in store, id: path.split('/').pop(), data: () => store[path] ? JSON.parse(JSON.stringify(store[path])) : undefined, ref: docRef(path) }; }
  function collRef(path){ return {
    doc: id => docRef(path + '/' + id),
    onSnapshot: (cb, err) => { if (denied(path)) { setTimeout(() => err && err(DENY), 0); return () => {}; } let prev = {}; const l = () => {
        const docs = Object.keys(store).filter(k => k.startsWith(path + '/') && k.slice(path.length+1).indexOf('/') < 0);
        const ch = []; docs.forEach(k => { const j = JSON.stringify(store[k]); if (prev[k] !== j) ch.push({ type: prev[k] ? 'modified':'added', doc: snap(k) }); });
        Object.keys(prev).forEach(k => { if (!(k in store)) ch.push({ type:'removed', doc: { id: k.split('/').pop(), data: () => ({}) } }); });
        prev = {}; docs.forEach(k => prev[k] = JSON.stringify(store[k]));
        cb({ docChanges: () => ch, docs: docs.map(snap), metadata: { fromCache: false } }); };
      listeners.push(l); setTimeout(l, 0); return () => listeners.splice(listeners.indexOf(l),1); }
  };}
  const db = { settings(){}, collection: n => collRef(n), batch(){ const ops=[]; return { set:(r,d,o)=>{ guard(r.path, d); const f=()=>r.set(d,o); f.deny=denied(r.path); ops.push(f); }, delete:r=>{ const f=()=>r.delete(); f.deny=denied(r.path); ops.push(f); }, commit:()=>{ window.__batches=(window.__batches||0)+1; if (ops.some(o => o.deny)) return Promise.reject(DENY); ops.forEach(f=>f()); return Promise.resolve(); } }; },
    enablePersistence(){ window.__persistence = true; return Promise.resolve(); },
    terminate(){ return Promise.resolve(); }, clearPersistence(){ window.__cleared = true; try { sessionStorage.setItem('__cleared', '1'); } catch (e) { } return Promise.resolve(); } };
  const auth = {
    get currentUser(){ return cur; },
    onAuthStateChanged(cb){ authCb = cb; setTimeout(() => cb(cur), 0); },
    signInWithEmailAndPassword(e){ window.__signInCalls = (window.__signInCalls||0)+1; cur = user0; setTimeout(()=>authCb(cur),0); return Promise.resolve({ user: cur }); },
    signInWithPopup(){ return Promise.reject({ code: 'auth/popup-closed-by-user' }); },
    getRedirectResult(){ return Promise.resolve(); }, signOut(){ cur = null; authCb(null); return Promise.resolve(); }
  };
  window.firebase = { initializeApp(){}, auth: Object.assign(() => auth, { GoogleAuthProvider: function(){} }), firestore: Object.assign(() => db, { FieldValue: { delete: () => DEL } }) };
})();
