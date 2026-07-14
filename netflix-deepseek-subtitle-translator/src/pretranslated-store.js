"use strict";

(function exposePretranslatedStore(global) {
  const DB_NAME = "netflix-deepseek-pretranslated";
  const DB_VERSION = 1;
  const SET_STORE = "subtitleSets";
  const CUE_STORE = "cues";

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(SET_STORE)) {
          db.createObjectStore(SET_STORE, { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains(CUE_STORE)) {
          const cueStore = db.createObjectStore(CUE_STORE, { keyPath: ["setKey", "cueId"] });
          cueStore.createIndex("setKey", "setKey", { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function buildSetKey({ videoKey, targetLanguage, model }) {
    return [videoKey, targetLanguage, model].map((part) => encodeURIComponent(String(part || ""))).join("|");
  }

  async function savePretranslatedCues({ videoKey, fileName, targetLanguage, model, cues }) {
    const setKey = buildSetKey({ videoKey, targetLanguage, model });
    const now = Date.now();
    const normalizedCues = (cues || []).map((cue, index) => ({
      setKey,
      cueId: String(cue.id || index + 1),
      start: Number(cue.start),
      end: Number(cue.end),
      sourceText: String(cue.sourceText || cue.text || ""),
      translation: String(cue.translation || "")
    }));
    const duration = normalizedCues.reduce((max, cue) => Math.max(max, cue.end || 0), 0);

    const db = await openDb();
    await runTransaction(db, [SET_STORE, CUE_STORE], "readwrite", async (transaction) => {
      const setStore = transaction.objectStore(SET_STORE);
      const cueStore = transaction.objectStore(CUE_STORE);

      await requestToPromise(setStore.put({
        key: setKey,
        videoKey,
        fileName,
        targetLanguage,
        model,
        createdAt: now,
        updatedAt: now,
        cueCount: normalizedCues.length,
        duration
      }));

      await deleteCuesForSet(cueStore, setKey);
      for (const cue of normalizedCues) {
        await requestToPromise(cueStore.put(cue));
      }
    });

    return {
      key: setKey,
      videoKey,
      fileName,
      targetLanguage,
      model,
      cueCount: normalizedCues.length,
      duration
    };
  }

  async function loadPretranslatedCues({ videoKey, targetLanguage, model }) {
    const setKey = buildSetKey({ videoKey, targetLanguage, model });
    const db = await openDb();
    const transaction = db.transaction([SET_STORE, CUE_STORE], "readonly");
    const set = await requestToPromise(transaction.objectStore(SET_STORE).get(setKey));
    if (!set) return { set: null, cues: [] };
    const cues = await getCuesForSet(transaction.objectStore(CUE_STORE), setKey);
    return { set, cues };
  }

  async function getPretranslatedMeta() {
    const db = await openDb();
    const transaction = db.transaction(SET_STORE, "readonly");
    const sets = await requestToPromise(transaction.objectStore(SET_STORE).getAll());
    return sets.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  async function deletePretranslatedCues({ key, videoKey, targetLanguage, model }) {
    const setKey = key || buildSetKey({ videoKey, targetLanguage, model });
    const db = await openDb();
    await runTransaction(db, [SET_STORE, CUE_STORE], "readwrite", async (transaction) => {
      await requestToPromise(transaction.objectStore(SET_STORE).delete(setKey));
      await deleteCuesForSet(transaction.objectStore(CUE_STORE), setKey);
    });
    return { key: setKey };
  }

  function getCuesForSet(cueStore, setKey) {
    const index = cueStore.index("setKey");
    return requestToPromise(index.getAll(setKey)).then((cues) =>
      cues.sort((a, b) => a.start - b.start)
    );
  }

  function deleteCuesForSet(cueStore, setKey) {
    return new Promise((resolve, reject) => {
      const index = cueStore.index("setKey");
      const request = index.openKeyCursor(IDBKeyRange.only(setKey));
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve();
          return;
        }
        cueStore.delete(cursor.primaryKey);
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });
  }

  function runTransaction(db, stores, mode, callback) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(stores, mode);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
      Promise.resolve(callback(transaction)).catch((error) => {
        transaction.abort();
        reject(error);
      });
    });
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  global.NDSTPretranslatedStore = {
    buildSetKey,
    savePretranslatedCues,
    loadPretranslatedCues,
    getPretranslatedMeta,
    deletePretranslatedCues
  };
})(typeof self !== "undefined" ? self : window);
