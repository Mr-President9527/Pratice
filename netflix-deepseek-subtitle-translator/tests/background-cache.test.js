"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const backgroundPath = path.join(__dirname, "..", "src", "background.js");
const storageData = {};
let delayNextCacheGet = false;
let releaseDelayedCacheGet = null;
const event = { addListener() {} };
const chrome = {
  runtime: {
    onInstalled: event,
    onStartup: event,
    onMessage: event
  },
  webNavigation: {
    onBeforeNavigate: event,
    onCommitted: event,
    onHistoryStateUpdated: event
  },
  storage: {
    local: {
      async get(key) {
        if (typeof key === "string") {
          const snapshot = structuredClone({ [key]: storageData[key] });
          if (key === "translationCache" && delayNextCacheGet) {
            delayNextCacheGet = false;
            await new Promise((resolve) => { releaseDelayedCacheGet = resolve; });
          }
          return snapshot;
        }
        return { ...storageData };
      },
      async set(values) {
        Object.assign(storageData, structuredClone(values));
      }
    }
  },
  tabs: { query() {} },
  scripting: null
};

const sandbox = {
  chrome,
  self: { NDSTPretranslatedStore: {} },
  console,
  setTimeout,
  clearTimeout,
  structuredClone,
  fetch: async () => { throw new Error("unexpected fetch"); }
};

const source = fs.readFileSync(backgroundPath, "utf8")
  .replace('importScripts("pretranslated-store.js");', "")
  .concat(`\n;globalThis.helpers = {
    memoryCache,
    buildCacheKey,
    writeCacheEntry,
    readCacheEntry,
    clearTranslationCache,
    getCacheGeneration: () => cacheGeneration
  };`);
vm.runInNewContext(source, sandbox);

(async () => {
  const {
    memoryCache,
    buildCacheKey,
    writeCacheEntry,
    readCacheEntry,
    clearTranslationCache,
    getCacheGeneration
  } = sandbox.helpers;
  const makeEntry = (sourceText, translation) => ({
    sourceText,
    translation,
    targetLanguage: "zh-CN",
    model: "deepseek-v4-flash",
    createdAt: Date.now(),
    lastUsedAt: Date.now()
  });
  const keyA = buildCacheKey("Hello", "zh-CN", "deepseek-v4-flash");
  const keyB = buildCacheKey("Goodbye", "zh-CN", "deepseek-v4-flash");

  await Promise.all([
    writeCacheEntry(keyA, makeEntry("Hello", "你好")),
    writeCacheEntry(keyB, makeEntry("Goodbye", "再见"))
  ]);
  assert.equal(memoryCache.size, 2);
  assert.equal(Object.keys(storageData.translationCache).length, 2);

  const oldGeneration = getCacheGeneration();
  await clearTranslationCache();
  assert.equal(memoryCache.size, 0);
  assert.deepEqual(storageData.translationCache, {});

  await writeCacheEntry(keyA, makeEntry("Hello", "你好"), oldGeneration);
  assert.equal(memoryCache.size, 0);
  assert.deepEqual(storageData.translationCache, {});

  await writeCacheEntry(keyA, makeEntry("Hello", "你好"));
  memoryCache.clear();
  delayNextCacheGet = true;
  const staleRead = readCacheEntry(keyA);
  await new Promise((resolve) => setTimeout(resolve, 0));
  await clearTranslationCache();
  releaseDelayedCacheGet();
  assert.equal(await staleRead, "");
  assert.equal(memoryCache.size, 0);

  console.log("background cache regression test passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
