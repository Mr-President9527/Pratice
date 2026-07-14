"use strict";

importScripts("pretranslated-store.js");

const STORAGE_KEYS = {
  settings: "settings",
  cache: "translationCache"
};

const CACHE_VERSION = "v6";
const CACHE_LIMIT = 1000;
const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";
const API_REQUEST_TIMEOUT_MS = 8000;
const API_MAX_ATTEMPTS = 2;
const API_RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const TEXTTRACK_GUARD_BUILD_ID = "2026-07-10-audit-62";
const CONTENT_BUILD_ID = "2026-07-10-audit-62";
const NATIVE_SUPPRESSOR_BUILD_ID = "2026-07-10-audit-62";

const DEFAULT_SETTINGS = {
  enabled: true,
  apiKey: "",
  model: "deepseek-v4-flash",
  targetLanguage: "zh-CN",
  displayMode: "chinese",
  replaceOriginal: true,
  hideNativeSubtitles: true,
  subtitleSourceMode: "live",
  subtitleOffsetMs: 0,
  advancedSubtitleFallback: false,
  scanDebounceMs: 250,
  fontSize: 30,
  bottomOffset: 9,
  backgroundOpacity: 0
};

const memoryCache = new Map();
const inFlightRequests = new Map();
const injectionThrottle = new Map();
const injectionScheduleThrottle = new Map();
let cacheMutationQueue = Promise.resolve();
let cacheGeneration = 0;

chrome.runtime.onInstalled.addListener(async () => {
  const { settings } = await chrome.storage.local.get(STORAGE_KEYS.settings);
  if (!settings) {
    await chrome.storage.local.set({ [STORAGE_KEYS.settings]: DEFAULT_SETTINGS });
  }
  scheduleExistingNetflixPagesInjection();
});

chrome.runtime.onStartup.addListener(() => {
  scheduleExistingNetflixPagesInjection();
});

if (chrome.webNavigation && chrome.webNavigation.onBeforeNavigate) {
  chrome.webNavigation.onBeforeNavigate.addListener(handleNetflixNavigation, {
    url: [{ hostEquals: "www.netflix.com" }]
  });
}

if (chrome.webNavigation && chrome.webNavigation.onCommitted) {
  chrome.webNavigation.onCommitted.addListener(handleNetflixNavigation, {
    url: [{ hostEquals: "www.netflix.com" }]
  });
}

if (chrome.webNavigation && chrome.webNavigation.onHistoryStateUpdated) {
  chrome.webNavigation.onHistoryStateUpdated.addListener(handleNetflixNavigation, {
    url: [{ hostEquals: "www.netflix.com" }]
  });
}

function handleNetflixNavigation(details) {
  if (!details || details.frameId !== 0 || !isNetflixWatchUrl(details.url)) return;
  prehideNetflixPage(details.tabId);
  scheduleNetflixPageInjection(details.tabId, 60);
}

function isNetflixWatchUrl(url) {
  return /^https:\/\/www\.netflix\.com\/watch\//.test(String(url || ""));
}

async function prehideNetflixPage(tabId) {
  if (!Number.isInteger(tabId) || !chrome.scripting) return;
  const settings = await getSettings().catch(() => DEFAULT_SETTINGS);
  if (settings.hideNativeSubtitles === false) return;
  await markNetflixPageNativeHidden(tabId).catch(() => {});
  await chrome.scripting.insertCSS({
    target: { tabId },
    files: ["src/overlay.css"]
  }).catch(() => {});
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["src/texttrack-guard-main.js"],
    world: "MAIN"
  }).catch(() => {});
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["src/native-suppressor.js"]
  }).catch(() => {});
}

async function markNetflixPageNativeHidden(tabId) {
  if (!Number.isInteger(tabId) || !chrome.scripting) return;
  await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      if (!/^\/watch\//.test(location.pathname)) return;
      document.documentElement.dataset.ndstHideNativeSubtitles = "true";
      document.documentElement.dataset.ndstNativeMask = "true";
      try {
        window.dispatchEvent(new Event("ndst-texttrack-guard-sync"));
      } catch (error) {
        // Ignore dispatch failures in restricted pages.
      }
    }
  });
}

function scheduleExistingNetflixPagesInjection() {
  if (!chrome.tabs || !chrome.tabs.query) return;
  setTimeout(() => {
    chrome.tabs.query({ url: "https://www.netflix.com/watch/*" }, (tabs) => {
      if (chrome.runtime.lastError || !Array.isArray(tabs)) return;
      tabs.forEach((tab) => {
        if (Number.isInteger(tab.id)) {
          prehideNetflixPage(tab.id);
          scheduleNetflixPageInjection(tab.id, 60);
        }
      });
    });
  }, 100);
}

function scheduleNetflixPageInjection(tabId, delayMs = 80) {
  if (!Number.isInteger(tabId)) return;
  const now = Date.now();
  const lastScheduledAt = injectionScheduleThrottle.get(tabId) || 0;
  if (now - lastScheduledAt < 1000) return;
  injectionScheduleThrottle.set(tabId, now);
  setTimeout(() => {
    ensureNetflixPageInjected(tabId).catch((error) => {
      console.warn("[Netflix DeepSeek Translator] auto inject skipped", error);
    });
  }, Math.max(0, Math.min(1000, Number(delayMs) || 0)));
}

async function ensureNetflixPageInjected(tabId) {
  if (!Number.isInteger(tabId) || !chrome.scripting) return;
  const now = Date.now();
  const lastAt = injectionThrottle.get(tabId) || 0;
  if (now - lastAt < 5000) return;
  injectionThrottle.set(tabId, now);

  const state = await readInjectedPageState(tabId).catch(() => ({
    textTrackGuardLoaded: false,
    nativeSuppressorLoaded: false,
    contentLoaded: false,
    textTrackGuardBuildId: "",
    nativeSuppressorBuildId: "",
    buildId: ""
  }));
  const textTrackGuardCurrent = state.textTrackGuardBuildId === TEXTTRACK_GUARD_BUILD_ID;
  const nativeCurrent = state.nativeSuppressorLoaded &&
    state.nativeSuppressorBuildId === NATIVE_SUPPRESSOR_BUILD_ID;
  const contentCurrent = state.contentLoaded &&
    state.buildId === CONTENT_BUILD_ID;
  if (textTrackGuardCurrent && nativeCurrent && contentCurrent) return;

  const settings = await getSettings().catch(() => DEFAULT_SETTINGS);
  if (settings.hideNativeSubtitles !== false) {
    await markNetflixPageNativeHidden(tabId).catch(() => {});
  }

  await chrome.scripting.insertCSS({
    target: { tabId },
    files: ["src/overlay.css"]
  }).catch(() => {});
  if (!textTrackGuardCurrent) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["src/texttrack-guard-main.js"],
      world: "MAIN"
    });
  }
  if (!nativeCurrent) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["src/native-suppressor.js"]
    });
  }
  if (!contentCurrent) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["src/content-netflix.js"]
    });
  }
}

async function readInjectedPageState(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const dataset = document.documentElement.dataset;
      return {
        textTrackGuardLoaded: dataset.ndstTextTrackGuard === "loaded",
        nativeSuppressorLoaded: dataset.ndstNativeSuppressor === "loaded",
        contentLoaded: dataset.ndstContentNetflix === "loaded",
        textTrackGuardBuildId: dataset.ndstTextTrackGuardBuildId || "",
        nativeSuppressorBuildId: dataset.ndstNativeSuppressorBuildId || "",
        buildId: dataset.ndstBuildId || ""
      };
    }
  });
  return results && results[0] && results[0].result
    ? results[0].result
    : {
      textTrackGuardLoaded: false,
      nativeSuppressorLoaded: false,
      contentLoaded: false,
      textTrackGuardBuildId: "",
      nativeSuppressorBuildId: "",
      buildId: ""
    };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => {
      if (!error || error.message !== "EXTENSION_DISABLED") {
        console.error("[Netflix DeepSeek Translator]", error);
      }
      sendResponse({
        ok: false,
        error: toUserError(error),
        details: error && error.message ? error.message : String(error)
      });
    });
  return true;
});

async function handleMessage(message, sender) {
  switch (message && message.type) {
    case "GET_SETTINGS":
      return { settings: await getSettings() };
    case "SAVE_SETTINGS":
      return { settings: await saveSettings(message.settings || {}) };
    case "TRANSLATE_SUBTITLE":
      return {
        translation: await translateSubtitle({
          sourceText: message.sourceText,
          context: message.context,
          forceNetwork: message.forceNetwork === true,
          requestId: message.requestId
        })
      };
    case "GET_CACHED_TRANSLATION":
      return {
        translation: await getCachedTranslation(message.sourceText)
      };
    case "TRANSLATE_BATCH":
      return {
        items: await translateBatch(message.items || [], message.options || {})
      };
    case "GET_PRETRANSLATED_META":
      return {
        sets: await self.NDSTPretranslatedStore.getPretranslatedMeta()
      };
    case "SAVE_PRETRANSLATED_CUES":
      return {
        set: await self.NDSTPretranslatedStore.savePretranslatedCues(message.payload || {})
      };
    case "LOAD_PRETRANSLATED_CUES":
      return await self.NDSTPretranslatedStore.loadPretranslatedCues(message.query || {});
    case "DELETE_PRETRANSLATED_CUES":
      return {
        deleted: await self.NDSTPretranslatedStore.deletePretranslatedCues(message.query || {})
      };
    case "TEST_API":
      return {
        translation: await translateSubtitle({
          sourceText: message.sourceText || "Hello, how are you?",
          forceNetwork: true,
          ignoreEnabled: true,
          requestId: `test-${Date.now()}`
        })
      };
    case "CLEAR_CACHE":
      await clearTranslationCache();
      return { cacheCount: 0 };
    case "GET_STATUS":
      return { status: await getStatus() };
    default:
      throw new Error("Unknown message type.");
  }
}

async function getSettings() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.settings);
  const stored = data[STORAGE_KEYS.settings] || {};
  const settings = { ...DEFAULT_SETTINGS, ...stored };
  if (!Object.prototype.hasOwnProperty.call(stored, "hideNativeSubtitles")) {
    settings.hideNativeSubtitles = DEFAULT_SETTINGS.hideNativeSubtitles;
  }
  if (!settings.subtitleSourceMode) {
    settings.subtitleSourceMode = DEFAULT_SETTINGS.subtitleSourceMode;
  }
  settings.hideNativeSubtitles = true;
  settings.replaceOriginal = true;
  return settings;
}

async function saveSettings(nextSettings) {
  const current = await getSettings();
  const settings = {
    ...current,
    ...sanitizeSettings(nextSettings)
  };
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: settings });
  return settings;
}

function sanitizeSettings(settings) {
  const model = ["deepseek-v4-flash", "deepseek-v4-pro"].includes(settings.model)
    ? settings.model
    : DEFAULT_SETTINGS.model;
  const targetLanguage = ["zh-CN", "zh-TW"].includes(settings.targetLanguage)
    ? settings.targetLanguage
    : DEFAULT_SETTINGS.targetLanguage;
  const displayMode = ["chinese", "bilingual"].includes(settings.displayMode)
    ? settings.displayMode
    : DEFAULT_SETTINGS.displayMode;
  const subtitleSourceMode = ["live", "pretranslated"].includes(settings.subtitleSourceMode)
    ? settings.subtitleSourceMode
    : DEFAULT_SETTINGS.subtitleSourceMode;

  return {
    enabled: Boolean(settings.enabled),
    apiKey: typeof settings.apiKey === "string" ? settings.apiKey.trim() : "",
    model,
    targetLanguage,
    displayMode,
    hideNativeSubtitles: true,
    subtitleSourceMode,
    subtitleOffsetMs: clampNumber(settings.subtitleOffsetMs, -10000, 10000, DEFAULT_SETTINGS.subtitleOffsetMs),
    advancedSubtitleFallback: Boolean(settings.advancedSubtitleFallback),
    replaceOriginal: true,
    scanDebounceMs: clampNumber(settings.scanDebounceMs, 100, 800, DEFAULT_SETTINGS.scanDebounceMs),
    fontSize: clampNumber(settings.fontSize, 18, 42, DEFAULT_SETTINGS.fontSize),
    bottomOffset: clampNumber(settings.bottomOffset, 4, 20, DEFAULT_SETTINGS.bottomOffset),
    backgroundOpacity: clampNumber(
      settings.backgroundOpacity,
      0,
      0.8,
      DEFAULT_SETTINGS.backgroundOpacity
    )
  };
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

async function translateSubtitle({ sourceText, context = [], forceNetwork = false, ignoreEnabled = false }) {
  const normalizedSource = normalizeSourceText(sourceText);
  if (!normalizedSource) {
    throw new Error("EMPTY_SOURCE");
  }

  const settings = await getSettings();
  if (!settings.enabled && !ignoreEnabled) {
    throw new Error("EXTENSION_DISABLED");
  }
  if (!settings.apiKey) {
    throw new Error("NO_API_KEY");
  }

  return translateWithSettings(normalizedSource, settings, forceNetwork, context);
}

async function getCachedTranslation(sourceText) {
  const normalizedSource = normalizeSourceText(sourceText);
  if (!normalizedSource) return "";
  const settings = await getSettings();
  const cacheKey = buildCacheKey(normalizedSource, settings.targetLanguage, settings.model);
  return readCacheEntry(cacheKey);
}

async function translateWithSettings(normalizedSource, settings, forceNetwork = false, context = []) {
  const cacheKey = buildCacheKey(normalizedSource, settings.targetLanguage, settings.model);
  if (!forceNetwork) {
    const cached = await readCacheEntry(cacheKey);
    if (cached) return cached;
  }

  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  const requestCacheGeneration = cacheGeneration;
  const requestPromise = requestDeepSeek(normalizedSource, settings, context)
    .then(async (translation) => {
      const cleanTranslation = sanitizeTranslationText(translation, settings.targetLanguage, normalizedSource);
      if (!cleanTranslation) throw new Error("EMPTY_TRANSLATION");
      await writeCacheEntry(cacheKey, {
        sourceText: normalizedSource,
        translation: cleanTranslation,
        targetLanguage: settings.targetLanguage,
        model: settings.model,
        createdAt: Date.now(),
        lastUsedAt: Date.now()
      }, requestCacheGeneration);
      return cleanTranslation;
    })
    .finally(() => inFlightRequests.delete(cacheKey));

  inFlightRequests.set(cacheKey, requestPromise);
  return requestPromise;
}

async function requestDeepSeek(sourceText, settings, context = []) {
  const data = await requestDeepSeekJson({
    model: settings.model,
    thinking: { type: "disabled" },
    temperature: 0.1,
    max_tokens: 96,
    stream: false,
    messages: [
      {
        role: "system",
        content: buildSystemPrompt(settings.targetLanguage)
      },
      {
        role: "user",
        content: buildUserPrompt(sourceText, context, settings.targetLanguage)
      }
    ]
  }, settings.apiKey, "API");
  const content = data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : "";
  return typeof content === "string" ? content.trim() : "";
}

async function requestDeepSeekJson(payload, apiKey, requestKind) {
  let lastError = null;
  for (let attempt = 1; attempt <= API_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await requestDeepSeekJsonAttempt(payload, apiKey, requestKind);
    } catch (error) {
      lastError = normalizeDeepSeekRequestError(error, requestKind);
      if (attempt >= API_MAX_ATTEMPTS || !lastError.retryable) throw lastError;
      await waitForRetry(getRetryDelayMs(lastError, attempt));
    }
  }
  throw lastError || new Error(`${requestKind}_REQUEST_FAILED`);
}

async function requestDeepSeekJsonAttempt(payload, apiKey, requestKind) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);
  try {
    let response;
    try {
      response = await fetch(DEEPSEEK_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw createDeepSeekError(`${requestKind}_TIMEOUT`, "request timed out", {
          retryable: true
        });
      }
      throw createDeepSeekError(`${requestKind}_NETWORK_ERROR`, safeErrorMessage(error), {
        retryable: true
      });
    }

    const rawBody = await response.text().catch(() => "");
    const data = parseJsonSafely(rawBody);
    if (!response.ok) {
      const apiMessage = extractDeepSeekErrorMessage(data, rawBody);
      const status = Number(response.status) || 0;
      throw createDeepSeekError(`${requestKind}_REQUEST_FAILED`, apiMessage, {
        status,
        retryable: API_RETRYABLE_STATUS_CODES.has(status),
        retryAfterMs: readRetryAfterMs(response)
      });
    }
    if (!data || typeof data !== "object") {
      throw createDeepSeekError(`${requestKind}_INVALID_RESPONSE`, "response was not valid JSON", {
        retryable: true
      });
    }
    const finishReason = data.choices && data.choices[0] && data.choices[0].finish_reason;
    if (finishReason === "insufficient_system_resource") {
      throw createDeepSeekError(`${requestKind}_SERVER_BUSY`, finishReason, {
        status: 503,
        retryable: true
      });
    }
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}

function createDeepSeekError(code, message, details = {}) {
  const status = Number(details.status) || 0;
  const cleanMessage = String(message || "unknown error").replace(/\s+/g, " ").slice(0, 240);
  const error = new Error(`${code}${status ? ` ${status}` : ""}: ${cleanMessage}`);
  error.code = code;
  error.status = status;
  error.retryable = details.retryable === true;
  error.retryAfterMs = Number(details.retryAfterMs) || 0;
  return error;
}

function normalizeDeepSeekRequestError(error, requestKind) {
  if (error && typeof error === "object" && error.code) return error;
  return createDeepSeekError(`${requestKind}_NETWORK_ERROR`, safeErrorMessage(error), {
    retryable: true
  });
}

function safeErrorMessage(error) {
  return String(error && error.message ? error.message : error || "network request failed")
    .replace(/\s+/g, " ")
    .slice(0, 160);
}

function parseJsonSafely(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function extractDeepSeekErrorMessage(data, rawBody) {
  const apiMessage = data && data.error && (data.error.message || data.error.code || data.error.type);
  if (apiMessage) return String(apiMessage);
  return String(rawBody || "DeepSeek API request failed").replace(/\s+/g, " ").slice(0, 240);
}

function readRetryAfterMs(response) {
  if (!response || !response.headers || typeof response.headers.get !== "function") return 0;
  const value = response.headers.get("Retry-After");
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.min(1500, Math.max(0, seconds * 1000));
  const dateMs = Date.parse(value);
  return Number.isFinite(dateMs) ? Math.min(1500, Math.max(0, dateMs - Date.now())) : 0;
}

function getRetryDelayMs(error, attempt) {
  if (error && error.retryAfterMs > 0) return error.retryAfterMs;
  return Math.min(800, 250 * attempt);
}

function waitForRetry(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function buildSystemPrompt(targetLanguage) {
  const languageName = getTargetLanguageName(targetLanguage);
  return `你是影视字幕翻译器。任务只有一个：把用户给出的“当前字幕”翻译成自然、简洁的${languageName}。只输出${languageName}译文，不解释，不加引号，不续写对白，不回答角色。结合上文理解代词、语气、梗、美国俚语和口语；必要时意译成自然中文，不逐字硬译。保留人名和专有名词。字幕要短，适合屏幕显示。`;
}

function buildUserPrompt(sourceText, context = [], targetLanguage = "zh-CN") {
  const safeContext = normalizeTranslationContext(context);
  const languageName = getTargetLanguageName(targetLanguage);
  const current = `当前字幕只需翻译，不要续写或回答：\n${sourceText}\n\n只输出${languageName}译文：`;
  if (!safeContext.length) return current;
  const contextText = safeContext
    .map((item, index) => `${index + 1}. ${item.sourceText} => ${item.translation}`)
    .join("\n");
  return `上文仅供理解，不要翻译上文：\n${contextText}\n\n${current}`;
}

function getTargetLanguageName(targetLanguage) {
  return targetLanguage === "zh-TW" ? "繁体中文" : "简体中文";
}

function normalizeTranslationContext(context) {
  if (!Array.isArray(context)) return [];
  return context
    .slice(-3)
    .map((item) => ({
      sourceText: normalizeSourceText(item && item.sourceText).slice(0, 140),
      translation: normalizeSourceText(item && item.translation).slice(0, 140)
    }))
    .filter((item) => item.sourceText && item.translation);
}

function normalizeSourceText(text) {
  return String(text || "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeTranslationText(text, targetLanguage = "zh-CN", sourceText = "") {
  const raw = String(text || "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim();
  if (isStructuredTranslationLeak(raw)) return "";
  let value = normalizeSourceText(raw)
    .replace(/^\s*\d+\.\s+/, "")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/^["'\u201c\u201d\u2018\u2019\u300c\u300e]+|["'\u201c\u201d\u2018\u2019\u300d\u300f]+$/g, "")
    .trim();
  if (isCorruptTranslationText(value)) return "";
  if (isTargetLanguageMismatch(value, targetLanguage, sourceText)) return "";
  return value;
}

function isCorruptTranslationText(text) {
  const value = String(text || "");
  if (!value.trim()) return true;
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\uFFFD\uE000-\uF8FF]/.test(value)) return true;
  if (/ï¿½|Ã|Â/.test(value) && value.length >= 6) return true;
  if (/-->|WEBVTT\b|Kind:\s*|Language:\s*/i.test(value)) return true;
  if (/\b\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}\b/.test(value)) return true;
  if (/\b(?:[2-9]\d|\d{3,}):[0-5]\d\b/.test(value)) return true;
  const compact = value.replace(/\s+/g, "");
  if (!compact) return true;
  const suspicious = (compact.match(/[\uFFFD\u00a4\u00c3\u00c2\u00e5\u00e6\u00e7\u00f0\u00fe\u00d0\u00de]/g) || []).length;
  const readable = (compact.match(/[A-Za-z0-9\u3040-\u30ff\u3400-\u9fff]/g) || []).length;
  if (compact.length >= 8 && suspicious >= 2) return true;
  if (compact.length >= 12 && /\d{1,2}:\d{2}/.test(compact) && suspicious >= 1) return true;
  if (compact.length >= 12 && suspicious / compact.length > 0.18 && readable / compact.length < 0.65) return true;
  const symbols = (compact.match(/[^\w\u3040-\u30ff\u3400-\u9fff.,!?'"]+/g) || []).join("").length;
  return compact.length >= 18 && symbols / compact.length > 0.45;
}

function isTargetLanguageMismatch(text, targetLanguage, sourceText = "") {
  if (!String(targetLanguage || "").startsWith("zh")) return false;
  const compact = String(text || "").replace(/\s+/g, "");
  if (!compact) return true;
  if (/[\u3400-\u9fff]/.test(compact)) return false;
  if (isShortPreservedName(compact, sourceText)) return false;
  if (/^(OK|O\.K\.|Yeah|Yep|No|Hi|Hello|Thanks?)\.?$/i.test(compact)) return true;
  if (/^(Sure|Of course|No problem|Here(?:'| i)s|The translation|I(?:'| a)m|As an AI)\b/i.test(text)) {
    return true;
  }
  const latin = (compact.match(/[A-Za-z]/g) || []).length;
  return compact.length >= 4 && latin / compact.length > 0.55;
}

function isShortPreservedName(text, sourceText = "") {
  const source = String(sourceText || "").replace(/\s+/g, " ").trim();
  return (
    text.length <= 18 &&
    source.length <= 18 &&
    /^[A-Z][A-Za-z.'’ -]*[.!?]?$/.test(source) &&
    /^[A-Z][A-Za-z.'’ -]*[.!?]?$/.test(text)
  );
}

function isStructuredTranslationLeak(text) {
  const raw = String(text || "");
  if (!raw.trim()) return false;
  if (/```|^\s*[\[{]|\b(?:sourceText|translation|targetLanguage|model)\b\s*[:=]/i.test(raw)) return true;
  if (/(?:\u539f\u6587|\u8bd1\u6587|\u5f53\u524d\u5b57\u5e55|\u4e0a\u6587)\s*[:\uff1a]/.test(raw)) return true;
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length > 2) return true;
  const listLines = lines.filter((line) => /^(?:[-*]\s+|\d+[.)]\s+)/.test(line)).length;
  if (listLines >= 2) return true;
  if (/\*\*.*\*\*.*\*\*/s.test(raw)) return true;
  return false;
}

function buildCacheKey(normalizedText, targetLanguage, model) {
  return `${CACHE_VERSION}:${targetLanguage}:${model}:${hashText(normalizedText)}:${encodeURIComponent(normalizedText)}`;
}

function hashText(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

async function readCacheEntry(cacheKey) {
  const memoryEntry = memoryCache.get(cacheKey);
  if (memoryEntry && memoryEntry.translation) {
    const clean = sanitizeTranslationText(
      memoryEntry.translation,
      memoryEntry.targetLanguage,
      memoryEntry.sourceText
    );
    if (clean) {
      memoryEntry.translation = clean;
      memoryEntry.lastUsedAt = Date.now();
      return clean;
    }
    memoryCache.delete(cacheKey);
  }

  const readGeneration = cacheGeneration;
  const cache = await getCache();
  if (readGeneration !== cacheGeneration) return "";
  const entry = cache[cacheKey];
  if (!entry || !entry.translation) return "";
  const clean = sanitizeTranslationText(entry.translation, entry.targetLanguage, entry.sourceText);
  if (!clean) {
    memoryCache.delete(cacheKey);
    await mutatePersistentCache((latestCache) => {
      delete latestCache[cacheKey];
    });
    return "";
  }
  entry.translation = clean;
  entry.lastUsedAt = Date.now();
  memoryCache.set(cacheKey, entry);
  trimMemoryCache();
  await mutatePersistentCache((latestCache) => {
    const latestEntry = latestCache[cacheKey];
    if (latestEntry && latestEntry.translation) {
      latestEntry.lastUsedAt = entry.lastUsedAt;
    }
  });
  return clean;
}

async function writeCacheEntry(cacheKey, entry, expectedGeneration = cacheGeneration) {
  if (expectedGeneration !== cacheGeneration) return;
  const clean = sanitizeTranslationText(
    entry && entry.translation,
    entry && entry.targetLanguage,
    entry && entry.sourceText
  );
  if (!clean) return;
  const cleanEntry = { ...entry, translation: clean };
  if (expectedGeneration !== cacheGeneration) return;
  memoryCache.set(cacheKey, cleanEntry);
  trimMemoryCache();
  await mutatePersistentCache(async (cache) => {
    if (expectedGeneration !== cacheGeneration) return;
    cache[cacheKey] = cleanEntry;
    await trimCache(cache);
  });
}

async function clearTranslationCache() {
  cacheGeneration += 1;
  memoryCache.clear();
  await mutatePersistentCache((cache) => {
    for (const key of Object.keys(cache)) delete cache[key];
  });
}

function mutatePersistentCache(mutator) {
  const operation = cacheMutationQueue
    .catch(() => {})
    .then(async () => {
      const cache = await getCache();
      await mutator(cache);
      await chrome.storage.local.set({ [STORAGE_KEYS.cache]: cache });
    });
  cacheMutationQueue = operation.catch(() => {});
  return operation;
}

async function getCache() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.cache);
  return data[STORAGE_KEYS.cache] && typeof data[STORAGE_KEYS.cache] === "object"
    ? data[STORAGE_KEYS.cache]
    : {};
}

async function trimCache(cache) {
  const entries = Object.entries(cache);
  if (entries.length <= CACHE_LIMIT) return;

  entries
    .sort((a, b) => {
      const aTime = a[1].lastUsedAt || a[1].createdAt || 0;
      const bTime = b[1].lastUsedAt || b[1].createdAt || 0;
      return aTime - bTime;
    })
    .slice(0, entries.length - CACHE_LIMIT)
    .forEach(([key]) => {
      delete cache[key];
    });
}

function trimMemoryCache() {
  if (memoryCache.size <= CACHE_LIMIT) return;
  const entries = Array.from(memoryCache.entries());
  entries
    .sort((a, b) => {
      const aTime = a[1].lastUsedAt || a[1].createdAt || 0;
      const bTime = b[1].lastUsedAt || b[1].createdAt || 0;
      return aTime - bTime;
    })
    .slice(0, entries.length - CACHE_LIMIT)
    .forEach(([key]) => memoryCache.delete(key));
}

async function translateBatch(items, options = {}) {
  const settings = { ...(await getSettings()), ...sanitizeBatchOptions(options) };
  const requestCacheGeneration = cacheGeneration;
  if (!settings.apiKey) {
    throw new Error("NO_API_KEY");
  }
  const safeItems = items
    .slice(0, 30)
    .map((item) => ({
      id: String(item.id || ""),
      text: normalizeSourceText(item.text)
    }))
    .filter((item) => item.id && item.text);

  const results = [];
  const missing = [];

  for (const item of safeItems) {
    const cacheKey = buildCacheKey(item.text, settings.targetLanguage, settings.model);
    const cached = await readCacheEntry(cacheKey);
    if (cached) {
      results.push({ id: item.id, text: cached });
    } else {
      missing.push({ ...item, cacheKey });
    }
  }

  if (!missing.length) return results;

  try {
    const translated = await requestDeepSeekBatch(missing, settings);
    const sourceById = new Map(missing.map((item) => [String(item.id), item.text]));
    const translatedById = new Map(translated.map((item) => [
      String(item.id),
      sanitizeTranslationText(item.text, settings.targetLanguage, sourceById.get(String(item.id)) || "")
    ]));

    for (const item of missing) {
      const text = translatedById.get(item.id);
      if (!text) throw new Error("BATCH_TRANSLATION_MISSING_ITEM");
      await writeCacheEntry(item.cacheKey, {
        sourceText: item.text,
        translation: text,
        targetLanguage: settings.targetLanguage,
        model: settings.model,
        createdAt: Date.now(),
        lastUsedAt: Date.now()
      }, requestCacheGeneration);
      results.push({ id: item.id, text });
    }
  } catch (error) {
    console.error("[Netflix DeepSeek Translator] batch fallback", error);
    for (const item of missing) {
      results.push({
        id: item.id,
        text: await translateWithSettings(item.text, settings)
      });
    }
  }

  return sortBatchResults(results, safeItems);
}

function sanitizeBatchOptions(options) {
  const sanitized = {};
  if (["deepseek-v4-flash", "deepseek-v4-pro"].includes(options.model)) {
    sanitized.model = options.model;
  }
  if (["zh-CN", "zh-TW"].includes(options.targetLanguage)) {
    sanitized.targetLanguage = options.targetLanguage;
  }
  return sanitized;
}

async function requestDeepSeekBatch(items, settings) {
  const data = await requestDeepSeekJson({
    model: settings.model,
    thinking: { type: "disabled" },
    temperature: 0.1,
    max_tokens: Math.min(1200, Math.max(120, items.length * 80)),
    stream: false,
    messages: [
      {
        role: "system",
        content: buildBatchSystemPrompt(settings.targetLanguage)
      },
      {
        role: "user",
        content: JSON.stringify(items.map(({ id, text }) => ({ id, text })))
      }
    ]
  }, settings.apiKey, "BATCH_API");
  const content = data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : "";
  return parseBatchJson(content);
}


function buildBatchSystemPrompt(targetLanguage) {
  const languageName = targetLanguage === "zh-TW" ? "繁体中文" : "简体中文";
  return `你是影视字幕翻译器。把字幕翻译成自然、简洁的${languageName}。理解口语、美国俚语、梗和语气，必要时意译，不逐字硬译。只输出 JSON 数组，每项格式为 {"id":"原id","text":"译文"}。不要解释，不要添加额外文字。字幕要短，适合屏幕显示。`;
}
function parseBatchJson(content) {
  const trimmed = String(content || "").trim();
  const jsonText = trimmed.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
  const parsed = JSON.parse(jsonText);
  if (!Array.isArray(parsed)) throw new Error("BATCH_JSON_NOT_ARRAY");
  return parsed
    .map((item) => ({ id: String(item.id || ""), text: normalizeSourceText(item.text) }))
    .filter((item) => item.id && item.text);
}

function sortBatchResults(results, originalItems) {
  const byId = new Map(results.map((item) => [item.id, item]));
  return originalItems.map((item) => byId.get(item.id)).filter(Boolean);
}

async function getStatus() {
  const settings = await getSettings();
  const cache = await getCache();
  return {
    enabled: settings.enabled,
    hasApiKey: Boolean(settings.apiKey),
    model: settings.model,
    targetLanguage: settings.targetLanguage,
    displayMode: settings.displayMode,
    hideNativeSubtitles: settings.hideNativeSubtitles,
    subtitleSourceMode: settings.subtitleSourceMode,
    subtitleOffsetMs: settings.subtitleOffsetMs,
    advancedSubtitleFallback: settings.advancedSubtitleFallback,
    scanDebounceMs: settings.scanDebounceMs,
    cacheCount: Object.keys(cache).length
  };
}

function toUserError(error) {
  const message = error && error.message ? error.message : String(error);
  const status = Number(error && error.status) || Number((message.match(/(?:FAILED|ERROR)\s+(\d{3})/) || [])[1]) || 0;
  if (message.includes("NO_API_KEY")) {
    return "请先在插件设置中填写 DeepSeek API Key";
  }
  if (message.includes("EXTENSION_DISABLED")) {
    return "插件已暂停";
  }
  if (message.includes("EMPTY_SOURCE")) {
    return "当前没有可翻译的字幕";
  }
  if (message.includes("EMPTY_TRANSLATION")) {
    return "DeepSeek 没有返回有效译文，已跳过";
  }
  if (status === 400) {
    return "DeepSeek 请求格式错误（400），请更新插件或切换模型";
  }
  if (status === 401) {
    return "DeepSeek API Key 无效或已失效（401）";
  }
  if (status === 402) {
    return "DeepSeek 账户余额不足（402），请充值后重试";
  }
  if (status === 403) {
    return "DeepSeek 拒绝访问（403），请检查账户或 Key 权限";
  }
  if (status === 422) {
    return "DeepSeek 请求参数不兼容（422），请更新插件或切换模型";
  }
  if (status === 429) {
    return "DeepSeek 请求过于频繁（429），已重试，请稍后再试";
  }
  if (status >= 500) {
    return `DeepSeek 服务繁忙（${status}），已重试，请稍后再试`;
  }
  if (message.includes("_TIMEOUT")) {
    return "DeepSeek 响应超时，已自动重试";
  }
  if (message.includes("_NETWORK_ERROR")) {
    return "无法连接 DeepSeek API，请检查代理、防火墙或 DNS";
  }
  if (message.includes("_INVALID_RESPONSE")) {
    return "DeepSeek 返回了无效数据，已自动重试";
  }
  return "翻译请求失败，请打开设置页测试 API 查看原因";
}

