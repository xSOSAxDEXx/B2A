// in-memory Firebase compat mock (app/auth/firestore) — enough for cloud.js
(function(){
  if (window.firebase) return;
  const store = window.__fs = window.__fs || {};   // path -> data
  const listeners = [];
  const user0 = window.__mockUser;
  let authCb = null, cur = null;
  function notify(){ listeners.forEach(l => l()); }
  function docRef(path){ return {
    path, id: path.split('/').pop(),
    collection: n => collRef(path + '/' + n),
    get: () => Promise.resolve(snap(path)),
    set: (d, o) => { store[path] = o && o.merge ? Object.assign({}, store[path], d) : JSON.parse(JSON.stringify(d)); notify(); return Promise.resolve(); },
    update: d => { store[path] = Object.assign({}, store[path], d); notify(); return Promise.resolve(); },
    delete: () => { delete store[path]; notify(); return Promise.resolve(); },
    onSnapshot: (cb) => { const l = () => cb(snap(path)); listeners.push(l); setTimeout(l, 0); return () => listeners.splice(listeners.indexOf(l),1); },
    get ref(){ return docRef(path); }
  };}
  function snap(path){ return { exists: path in store, id: path.split('/').pop(), data: () => store[path] ? JSON.parse(JSON.stringify(store[path])) : undefined, ref: docRef(path) }; }
  function collRef(path){ return {
    doc: id => docRef(path + '/' + id),
    onSnapshot: (cb) => { let prev = {}; const l = () => {
        const docs = Object.keys(store).filter(k => k.startsWith(path + '/') && k.slice(path.length+1).indexOf('/') < 0);
        const ch = []; docs.forEach(k => { const j = JSON.stringify(store[k]); if (prev[k] !== j) ch.push({ type: prev[k] ? 'modified':'added', doc: snap(k) }); });
        Object.keys(prev).forEach(k => { if (!(k in store)) ch.push({ type:'removed', doc: { id: k.split('/').pop(), data: () => ({}) } }); });
        prev = {}; docs.forEach(k => prev[k] = JSON.stringify(store[k]));
        cb({ docChanges: () => ch, docs: docs.map(snap) }); };
      listeners.push(l); setTimeout(l, 0); return () => listeners.splice(listeners.indexOf(l),1); }
  };}
  const db = { settings(){}, collection: n => collRef(n), batch(){ const ops=[]; return { set:(r,d,o)=>ops.push(()=>r.set(d,o)), delete:r=>ops.push(()=>r.delete()), commit:()=>{ window.__batches=(window.__batches||0)+1; ops.forEach(f=>f()); return Promise.resolve(); } }; } };
  const auth = {
    get currentUser(){ return cur; },
    onAuthStateChanged(cb){ authCb = cb; setTimeout(() => cb(cur), 0); },
    signInWithEmailAndPassword(e){ window.__signInCalls = (window.__signInCalls||0)+1; cur = user0; setTimeout(()=>authCb(cur),0); return Promise.resolve({ user: cur }); },
    signInWithPopup(){ return Promise.reject({ code: 'auth/popup-closed-by-user' }); },
    getRedirectResult(){ return Promise.resolve(); }, signOut(){ cur = null; authCb(null); return Promise.resolve(); }
  };
  window.firebase = { initializeApp(){}, auth: Object.assign(() => auth, { GoogleAuthProvider: function(){} }), firestore: () => db };
})();
