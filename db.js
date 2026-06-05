// Durable local queue for visits saved offline (or before they reach the server).
// IndexedDB is used because it's robust, async, and survives reloads. A record is
// only removed after the server confirms the write, so nothing is ever lost.
(function () {
  "use strict";
  const DB_NAME = "fieldaudit";
  const STORE = "pending_visits";
  const VERSION = 1;
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function put(record) {
    return open().then((db) => new Promise((resolve, reject) => {
      const t = db.transaction(STORE, "readwrite");
      t.objectStore(STORE).put(record);
      t.oncomplete = () => resolve(record);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    }));
  }

  function remove(id) {
    return open().then((db) => new Promise((resolve, reject) => {
      const t = db.transaction(STORE, "readwrite");
      t.objectStore(STORE).delete(id);
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    }));
  }

  function all() {
    return open().then((db) => new Promise((resolve, reject) => {
      const out = [];
      const t = db.transaction(STORE, "readonly");
      const cur = t.objectStore(STORE).openCursor();
      cur.onsuccess = (e) => { const c = e.target.result; if (c) { out.push(c.value); c.continue(); } };
      t.oncomplete = () => resolve(out.sort((a, b) => a.created_at - b.created_at));
      t.onerror = () => reject(t.error);
    }));
  }

  function count() {
    return open().then((db) => new Promise((resolve, reject) => {
      const t = db.transaction(STORE, "readonly");
      const r = t.objectStore(STORE).count();
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    }));
  }

  window.AuditDB = { put, remove, all, count };
})();
