"use strict";

(() => {
  const BUILD_ID = "2026-07-11-youtube-2";
  const OVERLAY_ID = "ndst-youtube-subtitle-overlay";
  const CLEANUP_KEY = "__NDST_YOUTUBE_CLEANUP__";
  const CAPTION_CONTAINER_SELECTOR = ".ytp-caption-window-container, #ytp-caption-window-container, .caption-window";
  const CAPTION_SEGMENT_SELECTOR = ".ytp-caption-segment";
  const MAX_SUBTITLE_LENGTH = 240;

  document.documentElement.dataset.ndstYoutubeHideNative = "true";
  if (typeof window[CLEANUP_KEY] === "function") {
    try {
      window[CLEANUP_KEY]();
    } catch (error) {
      // A stale instance should not prevent the replacement from starting.
    }
  }

  const state = {
    settings: null,
    player: null,
    overlay: null,
    observer: null,
    observerRoot: null,
    watchdogTimer: 0,
    translateTimer: 0,
    clearTimer: 0,
    errorTimer: 0,
    requestSequence: 0,
    lastSourceText: "",
    lastTranslation: "",
    lastTranslationSourceText: "",
    pendingSourceText: "",
    ignoredSourceText: "",
    translationContext: [],
    pretranslatedCues: [],
    pretranslatedSet: null,
    lastPretranslatedCueId: "",
    pretranslatedLoadSequence: 0,
    storageChangeHandler: null,
    navigationHandler: null,
    fullscreenHandler: null,
    extensionContextInvalidated: false
  };

  window[CLEANUP_KEY] = cleanup;
  init();

  async function init() {
    document.documentElement.dataset.ndstYoutubeTranslator = "loaded";
    document.documentElement.dataset.ndstYoutubeBuildId = BUILD_ID;
    state.settings = await requestSettings();
    await reloadPretranslatedCues();
    applySettings();
    bindEvents();
    refreshPlayerBinding();
    scanCaption();
    state.watchdogTimer = window.setInterval(() => {
      if (state.extensionContextInvalidated) return;
      refreshPlayerBinding();
      scanCaption();
    }, 500);
  }

  async function requestSettings() {
    try {
      const response = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
      if (response && response.ok && response.settings) return response.settings;
    } catch (error) {
      if (quiesceInvalidatedContext(error)) return null;
    }
    return {
      enabled: true,
      hideNativeSubtitles: true,
      displayMode: "chinese",
      scanDebounceMs: 250,
      fontSize: 30,
      bottomOffset: 9
    };
  }

  function bindEvents() {
    state.navigationHandler = () => {
      state.player = null;
      state.ignoredSourceText = "";
      clearOverlayState();
      state.lastPretranslatedCueId = "";
      refreshPlayerBinding();
      reloadPretranslatedCues().then(scanCaption);
      scanCaption();
    };
    window.addEventListener("yt-navigate-finish", state.navigationHandler);

    state.fullscreenHandler = () => {
      ensureOverlay();
      scanCaption();
    };
    document.addEventListener("fullscreenchange", state.fullscreenHandler);

    state.storageChangeHandler = (changes, areaName) => {
      if (areaName !== "local" || !changes.settings || !changes.settings.newValue) return;
      const previousSourceMode = state.settings && state.settings.subtitleSourceMode;
      state.settings = { ...state.settings, ...changes.settings.newValue };
      if (previousSourceMode !== state.settings.subtitleSourceMode) clearOverlayState();
      applySettings();
      reloadPretranslatedCues().then(scanCaption);
    };
    chrome.storage.onChanged.addListener(state.storageChangeHandler);

    chrome.runtime.onMessage.addListener(handleMessage);
  }

  function handleMessage(message, sender, sendResponse) {
    if (!message || !message.type) return false;
    if (message.type === "CLEAR_OVERLAY") {
      state.ignoredSourceText = readCurrentCaptionText() || state.lastSourceText;
      clearOverlayState();
      sendResponse({ ok: true });
      return false;
    }
    if (message.type === "PREHIDE_NATIVE_SUBTITLES") {
      document.documentElement.dataset.ndstYoutubeHideNative = "true";
      sendResponse({ ok: true });
      return false;
    }
    if (message.type === "GET_PAGE_DIAGNOSTICS") {
      sendResponse({ ok: true, diagnostics: getDiagnostics() });
      return false;
    }
    return false;
  }

  function refreshPlayerBinding() {
    if (!isYouTubePlaybackPage()) {
      disconnectObserver();
      state.player = null;
      removeOverlay();
      return;
    }

    const player = findActivePlayer();
    if (!player) return;
    state.player = player;
    ensureOverlay();
    if (state.observer && state.observerRoot === player) return;
    disconnectObserver();
    state.observerRoot = player;
    state.observer = new MutationObserver((mutations) => {
      if (!mutations.some(isCaptionMutation)) return;
      scanCaption();
    });
    state.observer.observe(player, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "style"]
    });
  }

  function isCaptionMutation(mutation) {
    const target = mutation.target && mutation.target.nodeType === Node.TEXT_NODE
      ? mutation.target.parentElement
      : mutation.target;
    if (isCaptionNode(target)) return true;
    for (const node of mutation.addedNodes || []) {
      if (isCaptionNode(node)) return true;
    }
    for (const node of mutation.removedNodes || []) {
      if (isCaptionNode(node)) return true;
    }
    return false;
  }

  function isCaptionNode(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
    if (node.matches && node.matches(`${CAPTION_CONTAINER_SELECTOR}, ${CAPTION_SEGMENT_SELECTOR}`)) return true;
    return Boolean(node.closest && node.closest(CAPTION_CONTAINER_SELECTOR));
  }

  async function scanCaption() {
    if (state.extensionContextInvalidated) return;
    ensureOverlay();
    if (!state.settings || !state.settings.enabled || !isYouTubePlaybackPage()) {
      document.documentElement.dataset.ndstYoutubeHideNative = "false";
      clearOverlayState();
      return;
    }

    document.documentElement.dataset.ndstYoutubeHideNative = shouldHideNativeSubtitles() ? "true" : "false";
    if (state.settings.subtitleSourceMode === "pretranslated") {
      renderPretranslatedSubtitle(getPretranslatedCueByCurrentTime(getCurrentVideoTime()));
      return;
    }
    const sourceText = readCurrentCaptionText();
    if (!sourceText) {
      state.ignoredSourceText = "";
      scheduleClear();
      return;
    }
    if (state.ignoredSourceText) {
      if (sourceText === state.ignoredSourceText) return;
      state.ignoredSourceText = "";
    }

    cancelClear();
    if (sourceText === state.lastSourceText) return;
    state.lastSourceText = sourceText;
    state.pendingSourceText = sourceText;
    const sequence = ++state.requestSequence;
    renderLoading(sourceText);

    try {
      const cached = await chrome.runtime.sendMessage({
        type: "GET_CACHED_TRANSLATION",
        sourceText
      });
      if (!isCurrentRequest(sourceText, sequence)) return;
      if (cached && cached.ok && cached.translation) {
        acceptTranslation(sourceText, cached.translation);
        return;
      }
    } catch (error) {
      if (quiesceInvalidatedContext(error)) return;
    }

    if (!isCurrentRequest(sourceText, sequence)) return;
    window.clearTimeout(state.translateTimer);
    state.translateTimer = window.setTimeout(() => {
      translateCaption(sourceText, sequence);
    }, getTranslationDebounceMs());
  }

  async function translateCaption(sourceText, sequence) {
    if (!isCurrentRequest(sourceText, sequence)) return;
    try {
      const response = await chrome.runtime.sendMessage({
        type: "TRANSLATE_SUBTITLE",
        sourceText,
        context: state.translationContext.slice(-3),
        requestId: `youtube-${sequence}`,
        seq: sequence
      });
      if (!isCurrentRequest(sourceText, sequence)) return;
      if (!response || !response.ok || !response.translation) {
        showTemporaryError(response && response.error ? response.error : "翻译失败");
        return;
      }
      acceptTranslation(sourceText, response.translation);
    } catch (error) {
      if (quiesceInvalidatedContext(error)) return;
      if (isCurrentRequest(sourceText, sequence)) showTemporaryError("翻译失败");
    }
  }

  function acceptTranslation(sourceText, translation) {
    const cleanTranslation = normalizeSubtitleText(translation);
    if (!cleanTranslation || sourceText !== state.lastSourceText) return;
    state.pendingSourceText = "";
    state.lastTranslation = cleanTranslation;
    state.lastTranslationSourceText = sourceText;
    rememberTranslationContext(sourceText, cleanTranslation);
    renderOverlay(sourceText, cleanTranslation, "ready");
  }

  async function reloadPretranslatedCues() {
    const loadSequence = ++state.pretranslatedLoadSequence;
    state.pretranslatedCues = [];
    state.pretranslatedSet = null;
    state.lastPretranslatedCueId = "";
    if (!state.settings || state.settings.subtitleSourceMode !== "pretranslated") return;
    const videoKey = getCurrentVideoKey();
    if (!videoKey) return;
    try {
      const response = await chrome.runtime.sendMessage({
        type: "LOAD_PRETRANSLATED_CUES",
        query: {
          videoKey,
          targetLanguage: state.settings.targetLanguage || "zh-CN",
          model: state.settings.model || "deepseek-v4-flash"
        }
      });
      if (loadSequence !== state.pretranslatedLoadSequence) return;
      if (response && response.ok && response.set && Array.isArray(response.cues)) {
        state.pretranslatedSet = response.set;
        state.pretranslatedCues = response.cues.slice().sort((a, b) => Number(a.start) - Number(b.start));
      }
    } catch (error) {
      if (quiesceInvalidatedContext(error)) return;
    }
  }

  function getPretranslatedCueByCurrentTime(currentTime) {
    if (!Number.isFinite(currentTime)) return null;
    const offsetSeconds = Number((state.settings && state.settings.subtitleOffsetMs) || 0) / 1000;
    const adjustedTime = currentTime + offsetSeconds;
    let low = 0;
    let high = state.pretranslatedCues.length - 1;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const cue = state.pretranslatedCues[middle];
      if (adjustedTime < Number(cue.start)) {
        high = middle - 1;
      } else if (adjustedTime > Number(cue.end)) {
        low = middle + 1;
      } else {
        return cue;
      }
    }
    return null;
  }

  function renderPretranslatedSubtitle(cue) {
    if (!cue) {
      state.lastPretranslatedCueId = "";
      scheduleClear();
      return;
    }
    const cueId = String(cue.cueId || cue.id || `${cue.start}-${cue.end}`);
    if (cueId === state.lastPretranslatedCueId) return;
    state.lastPretranslatedCueId = cueId;
    state.requestSequence += 1;
    cancelClear();
    state.lastSourceText = normalizeSubtitleText(cue.sourceText || cue.text || "");
    state.lastTranslation = normalizeSubtitleText(cue.translation || "");
    state.lastTranslationSourceText = state.lastSourceText;
    renderOverlay(state.lastSourceText, state.lastTranslation, "ready");
  }

  function renderLoading(sourceText) {
    const bilingual = state.settings && state.settings.displayMode === "bilingual";
    const previousTranslation = bilingual ? "" : state.lastTranslation;
    renderOverlay(sourceText, previousTranslation, "loading");
  }

  function renderOverlay(sourceText, translation, status) {
    const overlay = ensureOverlay();
    if (!overlay) return;
    const sourceElement = overlay.querySelector(".ndst-youtube-source");
    const translationElement = overlay.querySelector(".ndst-youtube-translation");
    const statusElement = overlay.querySelector(".ndst-youtube-status");
    const bilingual = state.settings && state.settings.displayMode === "bilingual";

    sourceElement.textContent = bilingual ? sourceText : "";
    translationElement.textContent = translation || "";
    statusElement.textContent = status === "loading" ? "…" : "";
    overlay.dataset.mode = bilingual ? "bilingual" : "chinese";
    overlay.dataset.status = status;
    overlay.style.display = sourceElement.textContent || translationElement.textContent || statusElement.textContent
      ? "block"
      : "none";
  }

  function ensureOverlay() {
    const player = state.player && state.player.isConnected ? state.player : findActivePlayer();
    if (!player) return null;
    state.player = player;
    let overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = OVERLAY_ID;
      overlay.setAttribute("aria-live", "polite");
      const source = document.createElement("div");
      source.className = "ndst-youtube-source";
      const translation = document.createElement("div");
      translation.className = "ndst-youtube-translation";
      const status = document.createElement("div");
      status.className = "ndst-youtube-status";
      overlay.append(source, translation, status);
    }
    if (overlay.parentElement !== player) player.appendChild(overlay);
    state.overlay = overlay;
    applyOverlaySettings();
    return overlay;
  }

  function applySettings() {
    const enabled = Boolean(state.settings && state.settings.enabled);
    document.documentElement.dataset.ndstYoutubeHideNative = enabled && shouldHideNativeSubtitles()
      ? "true"
      : "false";
    applyOverlaySettings();
    if (!enabled) clearOverlayState();
  }

  function applyOverlaySettings() {
    if (!state.overlay || !state.settings) return;
    const fontSize = clampNumber(state.settings.fontSize, 18, 42, 30);
    const bottom = clampNumber(state.settings.bottomOffset, 6, 20, 9);
    state.overlay.style.setProperty("--ndst-youtube-font-size", `${fontSize}px`);
    state.overlay.style.setProperty("--ndst-youtube-bottom", `${bottom}%`);
  }

  function readCurrentCaptionText() {
    const player = state.player && state.player.isConnected ? state.player : findActivePlayer();
    if (!player) return "";
    const windows = Array.from(player.querySelectorAll(CAPTION_CONTAINER_SELECTOR))
      .filter((element) => window.getComputedStyle(element).display !== "none");
    const segments = [];
    for (const captionWindow of windows) {
      for (const segment of captionWindow.querySelectorAll(CAPTION_SEGMENT_SELECTOR)) {
        const text = normalizeSubtitleText(segment.textContent || "");
        if (text && !segments.includes(text)) segments.push(text);
      }
    }
    return mergeCaptionSegments(segments);
  }

  function mergeCaptionSegments(segments) {
    const value = normalizeSubtitleText((segments || []).filter(Boolean).join("\n"));
    return value.length <= MAX_SUBTITLE_LENGTH ? value : "";
  }

  function normalizeSubtitleText(text) {
    return String(text || "")
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
      .replace(/[\u200b-\u200d\ufeff]/g, "")
      .split(/\r?\n/)
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  function findActivePlayer() {
    const videos = Array.from(document.querySelectorAll("video"));
    const ranked = videos
      .map((video) => {
        const rect = video.getBoundingClientRect();
        return { video, area: Math.max(0, rect.width) * Math.max(0, rect.height) };
      })
      .filter((entry) => entry.area > 0)
      .sort((a, b) => {
        if (a.video.paused !== b.video.paused) return a.video.paused ? 1 : -1;
        return b.area - a.area;
      });
    const video = ranked.length ? ranked[0].video : document.querySelector("video");
    return video && video.closest(".html5-video-player")
      ? video.closest(".html5-video-player")
      : document.querySelector("#movie_player.html5-video-player, .html5-video-player");
  }

  function isYouTubePlaybackPage() {
    return location.pathname === "/watch" || /^\/(?:shorts|live)\/[^/]+/.test(location.pathname);
  }

  function getCurrentVideoTime() {
    const player = state.player && state.player.isConnected ? state.player : findActivePlayer();
    const video = player ? player.querySelector("video") : document.querySelector("video");
    return video ? video.currentTime : NaN;
  }

  function getCurrentVideoKey() {
    try {
      const url = new URL(location.href);
      if (url.pathname === "/watch") {
        const id = url.searchParams.get("v");
        return id ? `youtube-${id}` : "";
      }
      const match = url.pathname.match(/^\/(?:shorts|live)\/([^/?#]+)/);
      return match ? `youtube-${match[1]}` : "";
    } catch (error) {
      return "";
    }
  }

  function shouldHideNativeSubtitles() {
    return !state.settings || state.settings.hideNativeSubtitles !== false;
  }

  function getTranslationDebounceMs() {
    return clampNumber(state.settings && state.settings.scanDebounceMs, 100, 500, 250);
  }

  function getSubtitleClearDelayMs(sourceText) {
    const length = normalizeSubtitleText(sourceText).replace(/\s+/g, "").length;
    if (length <= 8) return 280;
    if (length <= 28) return 380;
    return 500;
  }

  function scheduleClear() {
    if (state.clearTimer || (!state.lastSourceText && !state.lastTranslation)) return;
    state.clearTimer = window.setTimeout(() => {
      state.clearTimer = 0;
      clearOverlayState();
    }, getSubtitleClearDelayMs(state.lastSourceText));
  }

  function cancelClear() {
    window.clearTimeout(state.clearTimer);
    state.clearTimer = 0;
  }

  function clearOverlayState() {
    window.clearTimeout(state.translateTimer);
    window.clearTimeout(state.clearTimer);
    state.translateTimer = 0;
    state.clearTimer = 0;
    state.requestSequence += 1;
    state.lastSourceText = "";
    state.pendingSourceText = "";
    state.lastTranslation = "";
    state.lastTranslationSourceText = "";
    if (state.overlay) renderOverlay("", "", "empty");
  }

  function showTemporaryError(message) {
    state.pendingSourceText = "";
    const overlay = ensureOverlay();
    if (!overlay) return;
    const statusElement = overlay.querySelector(".ndst-youtube-status");
    statusElement.textContent = String(message || "翻译失败").slice(0, 32);
    overlay.style.display = "block";
    window.clearTimeout(state.errorTimer);
    state.errorTimer = window.setTimeout(() => {
      if (statusElement.isConnected) statusElement.textContent = "";
      if (!state.lastTranslation && overlay.isConnected) overlay.style.display = "none";
    }, 1600);
  }

  function rememberTranslationContext(sourceText, translation) {
    const last = state.translationContext[state.translationContext.length - 1];
    if (last && last.sourceText === sourceText) {
      last.translation = translation;
    } else {
      state.translationContext.push({ sourceText, translation });
      state.translationContext = state.translationContext.slice(-3);
    }
  }

  function isCurrentRequest(sourceText, sequence) {
    return (
      !state.extensionContextInvalidated &&
      sequence === state.requestSequence &&
      sourceText === state.lastSourceText
    );
  }

  function getDiagnostics() {
    const player = state.player && state.player.isConnected ? state.player : findActivePlayer();
    const nativeElements = player ? Array.from(player.querySelectorAll(CAPTION_CONTAINER_SELECTOR)) : [];
    const visibleNativeCount = nativeElements.filter((element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && style.display !== "none" &&
        style.visibility !== "hidden" && Number(style.opacity) > 0.01;
    }).length;
    return {
      platform: "youtube",
      buildId: BUILD_ID,
      contentLoaded: true,
      hideNativeSubtitles: document.documentElement.dataset.ndstYoutubeHideNative,
      nativeCaptionCount: nativeElements.length,
      nativeVisibleCount: visibleNativeCount,
      sourceText: state.lastSourceText,
      overlayText: state.overlay ? state.overlay.innerText : "",
      pageType: location.pathname.split("/").filter(Boolean)[0] || "other",
      videoKey: getCurrentVideoKey(),
      pretranslatedCueCount: state.pretranslatedCues.length
    };
  }

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  }

  function quiesceInvalidatedContext(error) {
    const message = String(error && error.message || error || "");
    if (!/Extension context invalidated/i.test(message)) return false;
    state.extensionContextInvalidated = true;
    cleanup();
    return true;
  }

  function disconnectObserver() {
    if (state.observer) state.observer.disconnect();
    state.observer = null;
    state.observerRoot = null;
  }

  function removeOverlay() {
    if (state.overlay && state.overlay.isConnected) state.overlay.remove();
    state.overlay = null;
  }

  function cleanup() {
    disconnectObserver();
    window.clearInterval(state.watchdogTimer);
    window.clearTimeout(state.translateTimer);
    window.clearTimeout(state.clearTimer);
    window.clearTimeout(state.errorTimer);
    if (state.navigationHandler) window.removeEventListener("yt-navigate-finish", state.navigationHandler);
    if (state.fullscreenHandler) document.removeEventListener("fullscreenchange", state.fullscreenHandler);
    if (state.storageChangeHandler && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.removeListener(state.storageChangeHandler);
    }
    if (chrome.runtime && chrome.runtime.onMessage && chrome.runtime.onMessage.removeListener) {
      chrome.runtime.onMessage.removeListener(handleMessage);
    }
    removeOverlay();
    if (window[CLEANUP_KEY] === cleanup) delete window[CLEANUP_KEY];
  }
})();
