"use strict";

(() => {
const BUILD_ID = "2026-07-14-hint-1";
if (
  document.documentElement.dataset.ndstContentNetflix === "loaded" &&
  document.documentElement.dataset.ndstBuildId === BUILD_ID
) {
  return;
}
const OVERLAY_ID = "netflix-deepseek-subtitle-overlay";
const NATIVE_SUPPRESSION_STYLE_ID = "netflix-deepseek-native-subtitle-suppression";
const NATIVE_MASK_ID = "netflix-deepseek-native-subtitle-mask";
const NATIVE_PLAYER_MASK_ID = "netflix-deepseek-native-subtitle-player-mask";
const CONTENT_CLEANUP_KEY = "__NDST_CONTENT_CLEANUP__";
const DEFAULT_SUBTITLE_SCAN_DEBOUNCE_MS = 250;
const NO_SUBTITLE_HINT_DELAY_MS = 2500;
const NO_SUBTITLE_HINT_TEXT = "请先在 Netflix 播放器中开启英文或日文字幕";
const MAX_SAME_SUBTITLE_HOLD_MS = 14000;
const MAX_SUBTITLE_LENGTH = 220;
const MAX_NATIVE_SUBTITLE_ELEMENTS = 48;
const MAX_ACTIVE_CUE_DOM_SCAN_VISITS = 180;
const NATIVE_SUBTITLE_LAYER_SELECTORS = [
  ".player-timedtext",
  ".player-timedtext-text-container",
  ".player-subtitle-text",
  '[class*="player-timedtext" i]',
  '[class*="player-subtitle" i]',
  '[class*="timedtext" i]',
  '[class*="timed-text" i]',
  '[class*="texttrack" i]',
  '[class*="text-track" i]',
  '[class*="subtitle-text" i]',
  '[class*="subtitle-container" i]',
  '[class*="subtitles-container" i]',
  '[class*="caption-text" i]',
  '[class*="caption-window" i]',
  '[class*="caption-container" i]',
  '[class*="captions-container" i]',
  '[data-uia*="player-timedtext" i]',
  '[data-uia*="player-subtitle" i]',
  '[data-uia*="timedtext" i]',
  '[data-uia*="timed-text" i]',
  '[data-uia*="texttrack" i]',
  '[data-uia*="text-track" i]',
  '[data-uia*="subtitle-text" i]',
  '[data-uia*="subtitle-container" i]',
  '[data-uia*="subtitles-container" i]',
  '[data-uia*="caption-text" i]',
  '[data-uia*="caption-window" i]',
  '[data-uia*="caption-container" i]',
  '[data-uia*="captions-container" i]',
  '[data-uia="player-subtitle-text"]'
];
const BROAD_SUBTITLE_LAYER_SELECTORS = [
  '[data-uia*="subtitle" i]',
  '[class*="subtitle" i]'
];
const NATIVE_SUBTITLE_LAYER_SELECTOR = NATIVE_SUBTITLE_LAYER_SELECTORS.join(",");
const BROAD_SUBTITLE_LAYER_SELECTOR = BROAD_SUBTITLE_LAYER_SELECTORS.join(",");
const SUBTITLE_ENABLEMENT_LAYER_SELECTOR = [
  ".player-timedtext",
  ".player-timedtext-text-container",
  ".player-subtitle-text",
  '[data-uia*="player-timedtext" i]',
  '[data-uia="player-subtitle-text"]'
].join(",");
const STYLE_GLOBAL_SUBTITLE_SELECTORS = [
  ".player-timedtext",
  ".player-timedtext-text-container",
  ".player-subtitle-text",
  '[class*="player-timedtext" i]',
  '[class*="player-subtitle" i]',
  '[class*="timedtext" i]',
  '[class*="timed-text" i]',
  '[class*="texttrack" i]',
  '[class*="text-track" i]',
  '[data-uia*="player-timedtext" i]',
  '[data-uia*="player-subtitle" i]',
  '[data-uia*="timedtext" i]',
  '[data-uia*="timed-text" i]',
  '[data-uia*="texttrack" i]',
  '[data-uia*="text-track" i]',
  '[data-uia="player-subtitle-text"]'
];
const STYLE_SCOPED_SUBTITLE_SELECTORS = [
  '[class*="subtitle-text" i]',
  '[class*="subtitle-container" i]',
  '[class*="subtitles-container" i]',
  '[class*="caption-text" i]',
  '[class*="caption-window" i]',
  '[class*="caption-container" i]',
  '[class*="captions-container" i]',
  '[data-uia*="subtitle-text" i]',
  '[data-uia*="subtitle-container" i]',
  '[data-uia*="subtitles-container" i]',
  '[data-uia*="caption-text" i]',
  '[data-uia*="caption-window" i]',
  '[data-uia*="caption-container" i]',
  '[data-uia*="captions-container" i]'
];
const PLAYER_ROOT_SELECTORS = [
  '[data-uia="player"]',
  ".watch-video",
  ".nf-player-container",
  ".html5-video-container",
  ".watch-video--player-view",
  ".AkiraPlayer"
];
const PLAYER_ROOT_SELECTOR = PLAYER_ROOT_SELECTORS.join(",");

prehideNativeBeforeInstanceSwap();

if (typeof window[CONTENT_CLEANUP_KEY] === "function") {
  try {
    window[CONTENT_CLEANUP_KEY]();
  } catch (error) {
    console.warn("[Netflix DeepSeek Translator] previous content cleanup failed", error);
  }
}

const state = {
  settings: null,
  overlay: null,
  observer: null,
  observerRoot: null,
  nativeSuppressionObserver: null,
  nativeSuppressionObserverRoot: null,
  nativeSuppressionFrame: 0,
  nativeSuppressionFrameBudget: 0,
  nativeSuppressionFrameUntil: 0,
  nativeSuppressionInterval: 0,
  nativePrehideUntil: 0,
  nativeFlashProtectionUntil: 0,
  nativeFlashProtectionTimer: 0,
  nativeCueDomShieldText: "",
  nativeCueDomShieldAt: 0,
  nativeTrackEventListeners: [],
  lastSourceText: "",
  lastTranslation: "",
  lastTranslationSourceText: "",
  translationContext: [],
  lastSubtitleAt: 0,
  ignoredStaleSourceText: "",
  debounceTimer: 0,
  cacheRenderTimer: 0,
  observerAttachTimer: 0,
  observerProcessTimer: 0,
  fullscreenChangeTimer: 0,
  clearTimer: 0,
  hintTimer: 0,
  errorTimer: 0,
  locationPollTimer: 0,
  liveRecognitionInterval: 0,
  liveWatchdogLastSourceText: "",
  extensionContextInvalidated: false,
  locationChangeTimer: 0,
  nativeHideReapplyTimers: [],
  nativeHideBurstTimers: [],
  requestSequence: 0,
  pendingSourceText: "",
  pendingSubtitleAt: 0,
  invalidTranslationSourceText: "",
  invalidTranslationUntil: 0,
  currentPath: location.pathname,
  pretranslatedCues: [],
  pretranslatedSet: null,
  lastPretranslatedCueId: "",
  pretranslatedTimer: 0,
  urlWatcherStarted: false,
  locationNotifyHandler: null,
  fullscreenChangeHandler: null,
  storageChangeHandler: null,
  originalHistoryMethods: {},
  fallbackCandidateText: "",
  fallbackCandidateCount: 0,
  pendingMutations: [],
  nativeHiddenCount: 0,
  nativeSubtitleElements: new Set(),
  nativeSubtitleStyleCache: new WeakMap(),
  nativeTextTrackModeCache: new WeakMap()
};

window[CONTENT_CLEANUP_KEY] = cleanupCurrentInstance;
init();

async function init() {
  document.documentElement.dataset.ndstContentNetflix = "loaded";
  document.documentElement.dataset.ndstBuildId = BUILD_ID;
  watchUrlChanges();
  watchFullscreenChanges();
  ensureOverlay();
  armNativeSuppressionForCurrentWatchPage();
  state.settings = await requestSettings();
  state.pretranslatedCues = await loadPretranslatedCues();
  applyOverlaySettings();
  forceImmediateNativeSubtitlePrehide();
  if (isNetflixWatchPage()) {
    startWatchPageWork();
    scheduleScan(100);
  } else {
    stopWatchPageWork();
  }
  state.storageChangeHandler = (changes, areaName) => {
    if (areaName === "local" && changes.settings) {
      state.settings = { ...state.settings, ...changes.settings.newValue };
      loadPretranslatedCues().then((cues) => {
        state.pretranslatedCues = cues;
        state.lastPretranslatedCueId = "";
      });
      applyOverlaySettings();
      if (!isNetflixWatchPage()) {
        stopWatchPageWork();
        return;
      }
      startWatchPageWork();
      forceImmediateNativeSubtitlePrehide();
      scheduleScan(50);
    }
  };
  chrome.storage.onChanged.addListener(state.storageChangeHandler);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "CLEAR_OVERLAY") {
    state.requestSequence += 1;
    state.lastSourceText = "";
    state.lastTranslation = "";
    state.lastTranslationSourceText = "";
    state.translationContext = [];
    updateOverlay("", "", "empty");
    sendResponse({ ok: true });
    return true;
  }
  if (message && message.type === "PING_CONTENT") {
    sendResponse({ ok: true });
    return true;
  }
  if (message && message.type === "PREHIDE_NATIVE_SUBTITLES") {
    armNativePrehideGrace(Number(message.durationMs) || 5000);
    forceImmediateNativeSubtitlePrehide();
    sendResponse({ ok: true });
    return true;
  }
  if (message && message.type === "GET_PAGE_DIAGNOSTICS") {
    sendResponse({ ok: true, diagnostics: getPageDiagnostics() });
    return true;
  }
  return false;
});

function getPageDiagnostics() {
  const dataset = document.documentElement.dataset;
  return {
    nativeSuppressorLoaded: dataset.ndstNativeSuppressor === "loaded",
    textTrackGuardLoaded: dataset.ndstTextTrackGuard === "loaded",
    contentLoaded: dataset.ndstContentNetflix === "loaded",
    buildId: dataset.ndstBuildId || "",
    nativeSuppressorBuildId: dataset.ndstNativeSuppressorBuildId || "",
    textTrackGuardBuildId: dataset.ndstTextTrackGuardBuildId || "",
    textTrackGuardStatus: dataset.ndstTextTrackGuardStatus || "",
    textTrackGuardBlockedCount: Number(dataset.ndstTextTrackGuardBlockedCount || 0),
    textTrackGuardEnabledCount: Number(dataset.ndstTextTrackGuardEnabledCount || 0),
    textTrackGuardAddTrack: dataset.ndstTextTrackGuardAddTrack || "",
    nativeSubtitleEnabledState: getNativeSubtitleEnabledState(),
    hideNativeSubtitles: dataset.ndstHideNativeSubtitles,
    settingsEnabled: dataset.ndstSettingsEnabled || "",
    settingsHideNativeSubtitles: dataset.ndstSettingsHideNativeSubtitles || "",
    settingsReplaceOriginal: dataset.ndstSettingsReplaceOriginal || "",
    settingsDisplayMode: dataset.ndstSettingsDisplayMode || "",
    settingsSubtitleSourceMode: dataset.ndstSettingsSubtitleSourceMode || "",
    nativeHideReason: dataset.ndstNativeHideReason || "",
    nativeHiddenCount: Number(dataset.ndstNativeHiddenCount || 0),
    nativeLastHiddenText: dataset.ndstNativeLastHiddenText || "",
    nativeLastHiddenClass: dataset.ndstNativeLastHiddenClass || "",
    nativeLastHiddenUia: dataset.ndstNativeLastHiddenUia || "",
    contentNativeHiddenCount: Number(dataset.ndstContentNativeHiddenCount || 0),
    contentNativeLastHiddenText: dataset.ndstContentNativeLastHiddenText || "",
    contentNativeLastHiddenClass: dataset.ndstContentNativeLastHiddenClass || "",
    contentNativeLastHiddenUia: dataset.ndstContentNativeLastHiddenUia || "",
    overlayPresent: Boolean(state.overlay && state.overlay.isConnected),
    overlayHost: getElementLabel(state.overlay && state.overlay.parentElement),
    fullscreenActive: Boolean(getFullscreenElement()),
    fullscreenHost: getElementLabel(getFullscreenElement()),
    overlayStatus: state.overlay ? state.overlay.dataset.status || "" : "",
    overlayText: state.overlay ? normalizeSubtitleText(state.overlay.textContent || "").slice(0, 120) : "",
    nativeSubtitleElementCount: state.nativeSubtitleElements.size,
    nativeMaskRect: getElementRectDiagnostics(NATIVE_MASK_ID),
    nativePlayerMaskRect: getElementRectDiagnostics(NATIVE_PLAYER_MASK_ID),
    textTrackDiagnostics: getTextTrackDiagnostics(),
    currentSourceText: state.lastSourceText,
    pendingSourceText: state.pendingSourceText,
    pendingSubtitleAgeMs: state.pendingSubtitleAt ? Date.now() - state.pendingSubtitleAt : 0
  };
}

function getElementLabel(element) {
  if (!element) return "";
  const id = element.id ? `#${element.id}` : "";
  const className = typeof element.className === "string"
    ? `.${element.className.trim().replace(/\s+/g, ".")}`.slice(0, 80)
    : "";
  return `${element.tagName || ""}${id}${className}`;
}

function getElementRectDiagnostics(id) {
  const element = document.getElementById(id);
  if (!element || !element.isConnected) {
    return { present: false };
  }
  const rect = element.getBoundingClientRect();
  return {
    present: true,
    display: element.style.getPropertyValue("display") || window.getComputedStyle(element).display,
    left: Math.round(rect.left),
    top: Math.round(rect.top),
    width: Math.round(rect.width),
    height: Math.round(rect.height)
  };
}

function getTextTrackDiagnostics() {
  let hidden = 0;
  let showing = 0;
  let disabled = 0;
  let total = 0;
  for (const track of getVideoTextTracks()) {
    if (!isSubtitleTextTrack(track)) continue;
    total += 1;
    let mode = "";
    try {
      mode = track.mode;
    } catch (error) {
      mode = "";
    }
    if (mode === "hidden") hidden += 1;
    else if (mode === "showing") showing += 1;
    else disabled += 1;
  }
  return { total, hidden, showing, disabled };
}

function ensureOverlay() {
  ensureNativeSubtitleSuppressionStyle();
  if (!state.settings) {
    document.documentElement.dataset.ndstHideNativeSubtitles = "true";
  }
  ensureNativeSubtitleMask();
  let overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.setAttribute("aria-live", "polite");
    overlay.innerHTML = [
      '<div class="ndst-source"></div>',
      '<div class="ndst-translation"></div>',
      '<div class="ndst-status"></div>'
    ].join("");
  }
  const host = getOverlayHost();
  if (overlay.parentElement !== host) {
    host.appendChild(overlay);
  }
  state.overlay = overlay;
}

function getOverlayHost() {
  return getFullscreenElement() || document.documentElement;
}

function isNetflixWatchPage() {
  return /^\/watch\//.test(location.pathname);
}

function startWatchPageWork() {
  ensureOverlay();
  armNativeSuppressionForCurrentWatchPage();
  startObserver();
  startNativeSuppressionObserver();
  startPretranslatedTimer();
  startLiveRecognitionWatchdog();
}

function stopWatchPageWork() {
  if (state.observer) {
    state.observer.disconnect();
    state.observer = null;
  }
  state.observerRoot = null;
  if (state.nativeSuppressionObserver) {
    state.nativeSuppressionObserver.disconnect();
    state.nativeSuppressionObserver = null;
  }
  state.nativeSuppressionObserverRoot = null;
  if (state.nativeSuppressionInterval) {
    window.clearInterval(state.nativeSuppressionInterval);
    state.nativeSuppressionInterval = 0;
  }
  if (state.nativeSuppressionFrame) {
    window.cancelAnimationFrame(state.nativeSuppressionFrame);
    state.nativeSuppressionFrame = 0;
  }
  state.nativeSuppressionFrameBudget = 0;
  removeNativeTextTrackGuards();
  if (state.pretranslatedTimer) {
    window.clearInterval(state.pretranslatedTimer);
    state.pretranslatedTimer = 0;
  }
  if (state.liveRecognitionInterval) {
    window.clearInterval(state.liveRecognitionInterval);
    state.liveRecognitionInterval = 0;
  }
  state.liveWatchdogLastSourceText = "";
  state.nativeSuppressionFrameBudget = 0;
  state.nativeSuppressionFrameUntil = 0;
  state.nativeFlashProtectionUntil = 0;
  window.clearTimeout(state.nativeFlashProtectionTimer);
  state.nativeFlashProtectionTimer = 0;
  window.clearTimeout(state.debounceTimer);
  window.clearTimeout(state.cacheRenderTimer);
  window.clearTimeout(state.observerAttachTimer);
  window.clearTimeout(state.observerProcessTimer);
  window.clearTimeout(state.fullscreenChangeTimer);
  state.observerProcessTimer = 0;
  state.pendingMutations = [];
  window.clearTimeout(state.clearTimer);
  window.clearTimeout(state.hintTimer);
  state.hintTimer = 0;
  window.clearTimeout(state.errorTimer);
  window.clearTimeout(state.locationChangeTimer);
  clearNativeHideReapplyTimers();
  clearNativeHideBurstTimers();
  setNativeMaskEnabled(false);
  restoreNativeSubtitles();
  clearOverlayOnly();
}

function cleanupCurrentInstance() {
  if (state.observer) {
    state.observer.disconnect();
    state.observer = null;
  }
  if (state.nativeSuppressionObserver) {
    state.nativeSuppressionObserver.disconnect();
    state.nativeSuppressionObserver = null;
  }
  state.nativeSuppressionObserverRoot = null;
  if (state.nativeSuppressionFrame) {
    window.cancelAnimationFrame(state.nativeSuppressionFrame);
    state.nativeSuppressionFrame = 0;
  }
  removeNativeTextTrackGuards();
  window.clearInterval(state.nativeSuppressionInterval);
  window.clearInterval(state.pretranslatedTimer);
  window.clearInterval(state.liveRecognitionInterval);
  window.clearInterval(state.locationPollTimer);
  window.clearTimeout(state.nativeFlashProtectionTimer);
  state.nativeFlashProtectionTimer = 0;
  state.nativeFlashProtectionUntil = 0;
  window.clearTimeout(state.debounceTimer);
  window.clearTimeout(state.cacheRenderTimer);
  window.clearTimeout(state.observerAttachTimer);
  window.clearTimeout(state.observerProcessTimer);
  state.observerProcessTimer = 0;
  state.pendingMutations = [];
  window.clearTimeout(state.clearTimer);
  window.clearTimeout(state.hintTimer);
  state.hintTimer = 0;
  window.clearTimeout(state.errorTimer);
  window.clearTimeout(state.locationChangeTimer);
  clearNativeHideReapplyTimers();
  clearNativeHideBurstTimers();
  if (state.locationNotifyHandler) {
    window.removeEventListener("popstate", state.locationNotifyHandler);
    window.removeEventListener("hashchange", state.locationNotifyHandler);
    window.removeEventListener("ndst-locationchange", state.locationNotifyHandler);
  }
  if (state.fullscreenChangeHandler) {
    document.removeEventListener("fullscreenchange", state.fullscreenChangeHandler);
    document.removeEventListener("webkitfullscreenchange", state.fullscreenChangeHandler);
  }
  for (const [method, original] of Object.entries(state.originalHistoryMethods)) {
    if (typeof original === "function" && history[method] && history[method].__ndstWrapped) {
      history[method] = original;
    }
  }
  if (state.storageChangeHandler && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.removeListener(state.storageChangeHandler);
  }
  if (window[CONTENT_CLEANUP_KEY] === cleanupCurrentInstance) {
    delete window[CONTENT_CLEANUP_KEY];
  }
}

function clearOverlayOnly() {
  if (!state.overlay) return;
  const sourceElement = state.overlay.querySelector(".ndst-source");
  const translationElement = state.overlay.querySelector(".ndst-translation");
  const statusElement = state.overlay.querySelector(".ndst-status");
  state.overlay.dataset.status = "empty";
  if (sourceElement) sourceElement.textContent = "";
  if (translationElement) translationElement.textContent = "";
  if (statusElement) statusElement.textContent = "";
}

function ensureNativeSubtitleMask() {
  const display = "none";
  const globalMask = ensureMaskElement(NATIVE_MASK_ID, document.documentElement);
  applyNativeMaskInlineStyle(globalMask, "global");
  setImportantStyleIfNeeded(globalMask, "display", display);

  const host = getNativeMaskHost();
  const playerMask = ensureMaskElement(NATIVE_PLAYER_MASK_ID, host);
  applyNativeMaskInlineStyle(playerMask, "player");
  setImportantStyleIfNeeded(playerMask, "display", display);
  return playerMask;
}

function ensureMaskElement(id, host) {
  let mask = document.getElementById(id);
  if (!mask) {
    mask = document.createElement("div");
    mask.id = id;
    mask.setAttribute("aria-hidden", "true");
  }
  if (mask.parentElement !== host) {
    host.appendChild(mask);
  }
  return mask;
}

function getNativeMaskHost() {
  const fullscreenElement = getFullscreenElement();
  if (fullscreenElement && fullscreenElement.querySelector) {
    return fullscreenElement;
  }
  const playerRoot = findPlayerRoot();
  return playerRoot || document.documentElement;
}

function getFullscreenElement() {
  return document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement ||
    null;
}

function syncNativeMaskHost() {
  const globalMask = document.getElementById(NATIVE_MASK_ID);
  if (globalMask && globalMask.parentElement !== document.documentElement) {
    document.documentElement.appendChild(globalMask);
  }
  const mask = document.getElementById(NATIVE_PLAYER_MASK_ID);
  const host = getNativeMaskHost();
  if (mask && mask.parentElement !== host) {
    host.appendChild(mask);
  }
}

function isPluginMutation(mutation) {
  const target = mutation && mutation.target;
  const element = target && target.nodeType === Node.TEXT_NODE ? target.parentElement : target;
  return Boolean(element && element.closest && element.closest(`#${OVERLAY_ID}, #${NATIVE_MASK_ID}, #${NATIVE_PLAYER_MASK_ID}, .ndst-native-subtitle-hidden`));
}

function getRelevantMutations(mutations, options = {}) {
  const allowVisualCheck = options.allowVisualCheck !== false;
  return Array.from(mutations || []).filter((mutation) =>
    !isPluginMutation(mutation) && mutationTouchesSubtitleLayer(mutation, allowVisualCheck)
  );
}

function mutationTouchesSubtitleLayer(mutation, allowVisualCheck) {
  if (!mutation) return false;
  const target = mutation.target;
  const targetElement = target && target.nodeType === Node.TEXT_NODE ? target.parentElement : target;
  if (isSubtitleRelatedElement(targetElement, allowVisualCheck)) return true;

  for (const node of mutation.addedNodes || []) {
    if (isSubtitleRelatedNode(node, allowVisualCheck)) return true;
  }

  return false;
}

function isSubtitleRelatedNode(node, allowVisualCheck) {
  const element = node && node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
  if (isSubtitleRelatedElement(element, allowVisualCheck)) return true;
  if (allowVisualCheck && findVisualSubtitleTextElementsFromNode(element, 48, 1).length) return true;
  return Boolean(element.querySelector && element.querySelector(getNativeMutationSelector()));
}

function isSubtitleRelatedElement(element, allowVisualCheck) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
  const selector = getNativeMutationSelector();
  if (
    (element.matches && element.matches(selector)) ||
    (element.closest && element.closest(selector))
  ) {
    return true;
  }
  return Boolean(allowVisualCheck && looksLikeVisualSubtitleElement(element));
}

function getNativeMutationSelector() {
  if (isAdvancedSubtitleFallbackEnabled()) {
    return `${NATIVE_SUBTITLE_LAYER_SELECTOR},${BROAD_SUBTITLE_LAYER_SELECTOR}`;
  }
  return NATIVE_SUBTITLE_LAYER_SELECTOR;
}

function isAdvancedSubtitleFallbackEnabled() {
  return Boolean(state.settings && state.settings.advancedSubtitleFallback === true);
}

function setNativeMaskEnabled(enabled) {
  const value = enabled ? "true" : "false";
  if (document.documentElement.dataset.ndstNativeMask !== value) {
    document.documentElement.dataset.ndstNativeMask = value;
  }
  notifyMainTextTrackGuard();
  const mask = ensureNativeSubtitleMask();
  setImportantStyleIfNeeded(mask, "display", "none");
  if (enabled) {
    suppressNativeVideoTextTracks();
    queueNativeHideReapply();
  } else {
    clearNativeHideReapplyTimers();
    restoreNativeVideoTextTracksIfAllowed();
  }
}

function armNativeSuppressionForCurrentWatchPage() {
  if (!isNetflixWatchPage()) return;
  if (!shouldPreHideNativeForRoute()) return;
  document.documentElement.dataset.ndstHideNativeSubtitles = "true";
  notifyMainTextTrackGuard();
  setNativeMaskEnabled(true);
  armNativeFlashProtection(1100);
}

function notifyMainTextTrackGuard() {
  try {
    window.dispatchEvent(new Event("ndst-texttrack-guard-sync"));
  } catch (error) {
    // Ignore cross-world event dispatch failures.
  }
}

function applyNativeMaskInlineStyle(mask, mode) {
  const commonStyles = {
    position: "fixed",
    left: "50%",
    bottom: "6.5%",
    width: "min(72vw, 980px)",
    height: "clamp(54px, 9vh, 112px)",
    transform: "translateX(-50%)",
    "z-index": "2147483646",
    "pointer-events": "none",
    "border-radius": "6px",
    background: "transparent"
  };
  const playerStyles = mode === "player" ? {
    position: "absolute"
  } : {};
  const styles = { ...commonStyles, ...playerStyles };
  for (const [property, value] of Object.entries(styles)) {
    setImportantStyleIfNeeded(mask, property, value);
  }
}

function startNativeSuppressionObserver() {
  bindNativeTextTrackGuards();
  suppressNativeVideoTextTracks();
  startNativeSuppressionLoop();
  armNativeFlashProtection(900);
}

function startNativeSuppressionLoop() {
  if (state.nativeSuppressionInterval || !shouldHideNativeSubtitles() || !isNetflixWatchPage()) return;
  state.nativeSuppressionInterval = window.setInterval(() => {
    if (!shouldHideNativeSubtitles() || !isNetflixWatchPage()) {
      window.clearInterval(state.nativeSuppressionInterval);
      state.nativeSuppressionInterval = 0;
      return;
    }
    suppressNativeVideoTextTracks();
    suppressNativeSubtitleFlash([], {
      includeVisualSubtitleCandidates: isNativeFlashProtectionActive()
    });
  }, 900);
}

function armNativeFlashProtection(durationMs = 800) {
  if (!shouldHideNativeSubtitles() || !isNetflixWatchPage()) return;
  const duration = Math.min(1500, Math.max(250, Number(durationMs) || 800));
  state.nativeFlashProtectionUntil = Math.max(
    state.nativeFlashProtectionUntil || 0,
    Date.now() + duration
  );
  startNativeAttributeProtectionObserver();
  startNativeSuppressionFrameGuard(4);
  queueNativeHideBurst();
  queueNativeHideReapply();
  scheduleNativeFlashProtectionStop();
}

function scheduleNativeFlashProtectionStop() {
  window.clearTimeout(state.nativeFlashProtectionTimer);
  const remaining = Math.max(0, (state.nativeFlashProtectionUntil || 0) - Date.now());
  state.nativeFlashProtectionTimer = window.setTimeout(stopNativeAttributeProtectionObserver, remaining + 80);
}

function isNativeFlashProtectionActive() {
  return shouldHideNativeSubtitles() &&
    isNetflixWatchPage() &&
    Date.now() <= (state.nativeFlashProtectionUntil || 0);
}

function startNativeAttributeProtectionObserver() {
  const playerRoot = findPlayerRoot();
  if (!playerRoot) return;
  if (state.nativeSuppressionObserver && state.nativeSuppressionObserverRoot === playerRoot) return;
  if (state.nativeSuppressionObserver) {
    state.nativeSuppressionObserver.disconnect();
  }
  state.nativeSuppressionObserverRoot = playerRoot;
  state.nativeSuppressionObserver = new MutationObserver((mutations) => {
    if (!isNativeFlashProtectionActive()) return;
    const relevantMutations = getRelevantMutations(mutations, {
      allowVisualCheck: true
    });
    enqueueObservedSubtitleMutations(relevantMutations, 20);
  });
  state.nativeSuppressionObserver.observe(playerRoot, {
    childList: true,
    characterData: true,
    subtree: true
  });
}

function forceImmediateNativeSubtitlePrehide() {
  if (!isNetflixWatchPage()) return;
  if (!shouldHideNativeSubtitles()) {
    restoreNativeSubtitles();
    return;
  }
  document.documentElement.dataset.ndstHideNativeSubtitles = "true";
  notifyMainTextTrackGuard();
  bindNativeTextTrackGuards();
  suppressNativeVideoTextTracks();
  suppressNativeSubtitleFlash([], {
    includeBroadSubtitleSelector: Boolean(state.settings && state.settings.advancedSubtitleFallback),
    includeVisualSubtitleCandidates: true
  });
  startNativeSuppressionFrameGuard(2);
  queueNativeHideBurst();
  queueNativeHideReapply();
}

function armNativePrehideGrace(durationMs = 5000) {
  if (!isNetflixWatchPage()) return;
  const duration = Math.min(10000, Math.max(500, Number(durationMs) || 5000));
  state.nativePrehideUntil = Date.now() + duration;
  document.documentElement.dataset.ndstHideNativeSubtitles = "true";
  notifyMainTextTrackGuard();
}

function stopNativeAttributeProtectionObserver() {
  state.nativeFlashProtectionTimer = 0;
  if (isNativeFlashProtectionActive()) {
    scheduleNativeFlashProtectionStop();
    return;
  }
  state.nativeFlashProtectionUntil = 0;
  if (state.nativeSuppressionObserver) {
    state.nativeSuppressionObserver.disconnect();
    state.nativeSuppressionObserver = null;
  }
  state.nativeSuppressionObserverRoot = null;
}

function startNativeSuppressionFrameGuard(frameBudget = 2) {
  if (!shouldHideNativeSubtitles() || !isNetflixWatchPage()) return;
  state.nativeSuppressionFrameBudget = Math.max(
    state.nativeSuppressionFrameBudget || 0,
    Math.max(1, Math.min(4, Number(frameBudget) || 1))
  );
  if (state.nativeSuppressionFrame) return;
  state.nativeSuppressionFrame = window.requestAnimationFrame(runNativeSuppressionFrameGuard);
}

function runNativeSuppressionFrameGuard() {
  state.nativeSuppressionFrame = 0;
  if (!shouldHideNativeSubtitles() || !isNetflixWatchPage()) {
    state.nativeSuppressionFrameBudget = 0;
    return;
  }
  bindNativeTextTrackGuards();
  suppressNativeVideoTextTracks();
  suppressNativeSubtitleFlash([], { includeVisualSubtitleCandidates: true });
  state.nativeSuppressionFrameBudget = Math.max(0, (state.nativeSuppressionFrameBudget || 0) - 1);
  if (state.nativeSuppressionFrameBudget > 0) {
    state.nativeSuppressionFrame = window.requestAnimationFrame(runNativeSuppressionFrameGuard);
  }
}

function ensureNativeSubtitleSuppressionStyle() {
  let style = document.getElementById(NATIVE_SUPPRESSION_STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = NATIVE_SUPPRESSION_STYLE_ID;
    (document.head || document.documentElement).appendChild(style);
  }
  if (style.dataset.ndstBuildId === BUILD_ID) return;
  style.dataset.ndstBuildId = BUILD_ID;
  style.textContent = `${buildNativeSubtitleSuppressionSelector()} {
  opacity: 0 !important;
  visibility: hidden !important;
  color: transparent !important;
  -webkit-text-fill-color: transparent !important;
  -webkit-text-stroke-color: transparent !important;
  text-shadow: none !important;
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  border-color: transparent !important;
  box-shadow: none !important;
  filter: opacity(0) !important;
  clip-path: inset(50%) !important;
  -webkit-clip-path: inset(50%) !important;
  overflow: hidden !important;
}

html:not([data-ndst-hide-native-subtitles="false"]) video::cue {
  display: none !important;
  opacity: 0 !important;
  visibility: hidden !important;
  color: transparent !important;
  -webkit-text-fill-color: transparent !important;
  -webkit-text-stroke-color: transparent !important;
  background: transparent !important;
  background-color: transparent !important;
  text-shadow: none !important;
  font-size: 0 !important;
  line-height: 0 !important;
  transform: scale(0) !important;
}

html:not([data-ndst-hide-native-subtitles="false"]) video::-webkit-media-text-track-container,
html:not([data-ndst-hide-native-subtitles="false"]) video::-webkit-media-text-track-display,
html:not([data-ndst-hide-native-subtitles="false"]) video::-webkit-media-text-track-region,
html:not([data-ndst-hide-native-subtitles="false"]) video::-webkit-media-text-track-region-container {
  display: none !important;
  opacity: 0 !important;
  visibility: hidden !important;
  color: transparent !important;
  background: transparent !important;
  text-shadow: none !important;
  font-size: 0 !important;
  line-height: 0 !important;
  transform: scale(0) !important;
}

html:not([data-ndst-hide-native-subtitles="false"]) video::-webkit-media-text-track-background {
  display: none !important;
  opacity: 0 !important;
  visibility: hidden !important;
  color: transparent !important;
  background: transparent !important;
  text-shadow: none !important;
  transform: scale(0) !important;
}

html:not([data-ndst-hide-native-subtitles="false"]) video::-webkit-media-text-track-cue,
html:not([data-ndst-hide-native-subtitles="false"]) video::-webkit-media-text-track-cue-background {
  display: none !important;
  opacity: 0 !important;
  visibility: hidden !important;
  color: transparent !important;
  -webkit-text-fill-color: transparent !important;
  -webkit-text-stroke-color: transparent !important;
  background: transparent !important;
  background-color: transparent !important;
  text-shadow: none !important;
  font-size: 0 !important;
  line-height: 0 !important;
  transform: scale(0) !important;
}
`;
}

function buildNativeSubtitleSuppressionSelector() {
  return [
    ...STYLE_GLOBAL_SUBTITLE_SELECTORS.flatMap((selector) => [
      `html:not([data-ndst-hide-native-subtitles="false"]) ${selector}`,
      `html:not([data-ndst-hide-native-subtitles="false"]) ${selector} *`
    ]),
    ...PLAYER_ROOT_SELECTORS.flatMap((rootSelector) =>
      STYLE_SCOPED_SUBTITLE_SELECTORS.flatMap((selector) => [
        `html:not([data-ndst-hide-native-subtitles="false"]) ${rootSelector} ${selector}${safeBroadSelectorFilter()}`,
        `html:not([data-ndst-hide-native-subtitles="false"]) ${rootSelector} ${selector}${safeBroadSelectorFilter()} *`
      ])
    ),
    'html:not([data-ndst-hide-native-subtitles="false"]) .ndst-native-subtitle-hidden',
    'html:not([data-ndst-hide-native-subtitles="false"]) .ndst-native-subtitle-hidden *'
  ].join(",\n");
}

function safeBroadSelectorFilter() {
  return [
    ':not(button)',
    ':not(input)',
    ':not(select)',
    ':not(textarea)',
    ':not([role="button"])',
    ':not([role="menu"])',
    ':not([role="menuitem"])',
    ':not([aria-label])',
    ':not([data-uia*="control" i])',
    ':not([data-uia*="button" i])',
    ':not([data-uia*="progress" i])',
    ':not([data-uia*="duration" i])',
    ':not([data-uia*="menu" i])',
    ':not([data-uia*="title" i])'
  ].join("");
}

async function requestSettings() {
  const response = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
  if (!response || !response.ok) {
    return {
      enabled: true,
      displayMode: "chinese",
      hideNativeSubtitles: true,
      subtitleSourceMode: "live",
      subtitleOffsetMs: 0,
      advancedSubtitleFallback: false,
      scanDebounceMs: DEFAULT_SUBTITLE_SCAN_DEBOUNCE_MS,
      fontSize: 30,
      bottomOffset: 9,
      backgroundOpacity: 0
    };
  }
  return response.settings;
}

function applyOverlaySettings() {
  if (!state.overlay || !state.settings) return;
  state.overlay.style.setProperty("--ndst-font-size", `${state.settings.fontSize || 30}px`);
  state.overlay.style.setProperty("--ndst-bottom", `${getOverlayBottomOffset()}%`);
  state.overlay.style.setProperty("--ndst-bg-opacity", "0");
  state.overlay.dataset.mode = state.settings.displayMode || "chinese";
  state.overlay.dataset.hideNativeSubtitles = shouldHideNativeSubtitles() ? "true" : "false";
  updateSettingsDiagnostics();
  const hideNative = shouldHideNativeSubtitles();
  document.documentElement.dataset.ndstHideNativeSubtitles = hideNative ? "true" : "false";
  notifyMainTextTrackGuard();
  setNativeMaskEnabled(hideNative && isNetflixWatchPage());
  if (hideNative && isNetflixWatchPage()) {
    bindNativeTextTrackGuards();
    suppressNativeVideoTextTracks();
  } else {
    removeNativeTextTrackGuards();
  }
}

function updateSettingsDiagnostics() {
  if (!state.settings) return;
  const dataset = document.documentElement.dataset;
  dataset.ndstSettingsEnabled = state.settings.enabled ? "true" : "false";
  dataset.ndstSettingsHideNativeSubtitles = state.settings.hideNativeSubtitles !== false ? "true" : "false";
  dataset.ndstSettingsReplaceOriginal = state.settings.replaceOriginal !== false ? "true" : "false";
  dataset.ndstSettingsDisplayMode = state.settings.displayMode || "";
  dataset.ndstSettingsSubtitleSourceMode = state.settings.subtitleSourceMode || "";
  dataset.ndstNativeHideReason = getNativeHideReason();
}

function startPretranslatedTimer() {
  window.clearInterval(state.pretranslatedTimer);
  state.pretranslatedTimer = 0;
  if (!state.settings || state.settings.subtitleSourceMode !== "pretranslated") return;
  state.pretranslatedTimer = window.setInterval(() => {
    if (isNetflixWatchPage() && state.settings && state.settings.enabled && state.settings.subtitleSourceMode === "pretranslated") {
      renderPretranslatedSubtitle(getCueByCurrentTime(getCurrentVideoTime()));
    }
  }, 250);
}

function startLiveRecognitionWatchdog() {
  window.clearInterval(state.liveRecognitionInterval);
  state.liveRecognitionInterval = 0;
  state.liveWatchdogLastSourceText = "";
  if (
    !state.settings ||
    !state.settings.enabled ||
    state.settings.subtitleSourceMode !== "live" ||
    !isNetflixWatchPage()
  ) {
    return;
  }

  runLiveRecognitionWatchdog();
  state.liveRecognitionInterval = window.setInterval(runLiveRecognitionWatchdog, 350);
}

function runLiveRecognitionWatchdog() {
  if (state.extensionContextInvalidated) return;
  if (
    !state.settings ||
    !state.settings.enabled ||
    state.settings.subtitleSourceMode !== "live" ||
    !isNetflixWatchPage()
  ) {
    return;
  }

  // Netflix replaces the player root during watch-to-watch navigation.
  startObserver();
  const sourceText = findFromActiveTextTrackCues() || findFromKnownSubtitleContainers();
  if (!sourceText) {
    state.liveWatchdogLastSourceText = "";
    if (state.lastSourceText || state.lastTranslation || state.pendingSourceText) {
      scheduleClear();
    }
    return;
  }
  cancelScheduledClear();
  if (sourceText === state.pendingSourceText) return;
  if (sourceText === state.lastSourceText) {
    if (!hasCurrentTranslation(sourceText)) scheduleScan(0);
    return;
  }
  if (sourceText === state.liveWatchdogLastSourceText) return;

  state.liveWatchdogLastSourceText = sourceText;
  scheduleImmediateCachedRender(0);
}

function startObserver() {
  if (!isNetflixWatchPage()) return;
  const playerRoot = findPlayerRoot();
  if (!playerRoot) {
    window.clearTimeout(state.observerAttachTimer);
    state.observerAttachTimer = window.setTimeout(startObserver, 300);
    return;
  }
  if (state.observer && state.observerRoot === playerRoot) return;
  if (state.observer) {
    state.observer.disconnect();
    window.clearTimeout(state.observerProcessTimer);
    state.observerProcessTimer = 0;
    state.pendingMutations = [];
  }
  state.observerRoot = playerRoot;
  state.observer = new MutationObserver((mutations) => {
    if (!isNetflixWatchPage()) return;
    const relevantMutations = getRelevantMutations(mutations, {
      allowVisualCheck: isAdvancedSubtitleFallbackEnabled()
    });
    hideKnownNativeSubtitleMutationsImmediately(relevantMutations);
    enqueueObservedSubtitleMutations(relevantMutations, 45);
  });
  state.observer.observe(playerRoot, {
    childList: true,
    subtree: true,
    characterData: true
  });
}

function hideKnownNativeSubtitleMutationsImmediately(relevantMutations) {
  if (!relevantMutations || !relevantMutations.length || !shouldHideNativeSubtitles()) return;
  const nativeElements = collectNativeSubtitleElementsFromMutations(relevantMutations);
  if (!nativeElements.length) return;
  hideNativeSubtitleElementsNow(nativeElements);
}

function enqueueObservedSubtitleMutations(relevantMutations, delayMs = 45) {
  if (!relevantMutations || !relevantMutations.length) return;
  state.pendingMutations.push(...relevantMutations);
  if (state.pendingMutations.length > 140) {
    state.pendingMutations = state.pendingMutations.slice(-140);
  }
  if (state.observerProcessTimer) return;
  state.observerProcessTimer = window.setTimeout(processObservedSubtitleMutations, delayMs);
}

function processObservedSubtitleMutations() {
  state.observerProcessTimer = 0;
  if (!isNetflixWatchPage()) {
    state.pendingMutations = [];
    return;
  }

  const relevantMutations = state.pendingMutations.splice(0, state.pendingMutations.length);
  if (!relevantMutations.length) return;

  syncNativeMaskHost();
  const nativeElements = collectNativeSubtitleElementsFromMutations(relevantMutations);
  if (nativeElements.length) {
    hideNativeSubtitleElementsNow(nativeElements);
    startNativeSuppressionFrameGuard(1);
    queueNativeHideReapply();
    armNativeFlashProtection(600);
  }
  bindNativeTextTrackGuards();
  suppressNativeVideoTextTracks();
  queueNativeHideBurst();
  scheduleImmediateCachedRender(nativeElements.length ? 0 : 75);
  scheduleScan(getScanDebounceMs());
}

function scheduleImmediateCachedRender(delayMs) {
  if (state.extensionContextInvalidated) return;
  window.clearTimeout(state.cacheRenderTimer);
  state.cacheRenderTimer = window.setTimeout(() => {
    state.cacheRenderTimer = 0;
    tryImmediateCachedRender();
  }, delayMs);
}

function watchUrlChanges() {
  if (state.urlWatcherStarted) return;
  state.urlWatcherStarted = true;
  state.locationNotifyHandler = () => {
    window.clearTimeout(state.locationChangeTimer);
    state.locationChangeTimer = window.setTimeout(() => {
      state.locationChangeTimer = 0;
      handleLocationChange();
    }, 0);
  };
  for (const method of ["pushState", "replaceState"]) {
    const original = history[method];
    if (typeof original !== "function" || original.__ndstWrapped) continue;
    state.originalHistoryMethods[method] = original;
    const wrapped = function (...args) {
      prepareForPotentialWatchNavigation(args[2]);
      const result = original.apply(this, args);
      prepareForPotentialWatchNavigation(location.href);
      window.dispatchEvent(new Event("ndst-locationchange"));
      return result;
    };
    wrapped.__ndstWrapped = true;
    history[method] = wrapped;
  }
  window.addEventListener("popstate", state.locationNotifyHandler);
  window.addEventListener("hashchange", state.locationNotifyHandler);
  window.addEventListener("ndst-locationchange", state.locationNotifyHandler);
  state.locationPollTimer = window.setInterval(() => {
    handleLocationChange();
  }, 1000);
}

function watchFullscreenChanges() {
  if (state.fullscreenChangeHandler) return;
  state.fullscreenChangeHandler = () => {
    window.clearTimeout(state.fullscreenChangeTimer);
    state.fullscreenChangeTimer = window.setTimeout(handleFullscreenChange, 80);
  };
  document.addEventListener("fullscreenchange", state.fullscreenChangeHandler);
  document.addEventListener("webkitfullscreenchange", state.fullscreenChangeHandler);
}

function handleFullscreenChange() {
  state.fullscreenChangeTimer = 0;
  ensureOverlay();
  syncNativeMaskHost();
  applyOverlaySettings();
  if (!isNetflixWatchPage()) return;
  startObserver();
  if (shouldHideNativeSubtitles()) {
    document.documentElement.dataset.ndstHideNativeSubtitles = "true";
    notifyMainTextTrackGuard();
    bindNativeTextTrackGuards();
    suppressNativeVideoTextTracks();
    startNativeSuppressionFrameGuard(1);
    queueNativeHideReapply();
    armNativeFlashProtection(650);
  }
  scheduleImmediateCachedRender(0);
  scheduleScan(120);
}

function prepareForPotentialWatchNavigation(urlLike) {
  if (!isWatchUrlLike(urlLike)) return;
  if (!shouldPreHideNativeForRoute()) return;
  document.documentElement.dataset.ndstHideNativeSubtitles = "true";
  notifyMainTextTrackGuard();
  setNativeMaskEnabled(true);
  armNativeFlashProtection(900);
}

function shouldPreHideNativeForRoute() {
  if (!state.settings) return true;
  if (state.settings.subtitleSourceMode === "pretranslated") return true;
  if (state.settings.displayMode === "bilingual") return true;
  return state.settings.hideNativeSubtitles !== false;
}

function isWatchUrlLike(urlLike) {
  if (!urlLike) return false;
  try {
    const url = new URL(String(urlLike), location.href);
    return url.hostname === location.hostname && /^\/watch\//.test(url.pathname);
  } catch (error) {
    return /^\/watch\//.test(String(urlLike));
  }
}

function prehideNativeBeforeInstanceSwap() {
  if (!/^\/watch\//.test(location.pathname)) return;
  document.documentElement.dataset.ndstHideNativeSubtitles = "true";
}

function handleLocationChange() {
  if (state.currentPath === location.pathname) return;
  state.currentPath = location.pathname;
  state.requestSequence += 1;
  state.lastSourceText = "";
  state.lastTranslation = "";
  state.lastTranslationSourceText = "";
  state.lastSubtitleAt = 0;
  state.translationContext = [];
  state.lastPretranslatedCueId = "";
  loadPretranslatedCues().then((cues) => {
    state.pretranslatedCues = cues;
  });
  ensureOverlay();
  if (!isNetflixWatchPage()) {
    stopWatchPageWork();
    return;
  }
  startWatchPageWork();
  applyOverlaySettings();
  forceImmediateNativeSubtitlePrehide();
  scheduleScan(120);
}

function scheduleScan(delay) {
  if (state.extensionContextInvalidated) return;
  window.clearTimeout(state.debounceTimer);
  state.debounceTimer = window.setTimeout(scanForSubtitle, delay);
}

function getScanDebounceMs() {
  const value = Number(state.settings && state.settings.scanDebounceMs);
  if (!Number.isFinite(value)) return DEFAULT_SUBTITLE_SCAN_DEBOUNCE_MS;
  return Math.min(800, Math.max(100, value));
}

function scanForSubtitle() {
  if (state.extensionContextInvalidated) return;
  ensureOverlay();
  syncNativeMaskHost();
  if (!isNetflixWatchPage()) {
    stopWatchPageWork();
    return;
  }
  if (!state.settings || !state.settings.enabled) {
    if (shouldHideNativeSubtitles()) {
      setNativeMaskEnabled(true);
      suppressNativeSubtitleFlash([], { includeVisualSubtitleCandidates: true });
      queueNativeHideBurst();
    } else {
      setNativeMaskEnabled(false);
      restoreNativeSubtitles();
    }
    updateOverlay("", "", "empty");
    return;
  }
  if (state.settings.subtitleSourceMode === "pretranslated") {
    suppressNativeSubtitleFlash();
    renderPretranslatedSubtitle(getCueByCurrentTime(getCurrentVideoTime()));
    return;
  }

  suppressNativeSubtitleFlash();
  const sourceText = findVisibleSubtitleText();
  if (!sourceText) {
    scheduleNoSubtitleHint();
    scheduleClear();
    return;
  }

  if (state.ignoredStaleSourceText) {
    if (sourceText === state.ignoredStaleSourceText) return;
    state.ignoredStaleSourceText = "";
  }

  window.clearTimeout(state.hintTimer);
  state.hintTimer = 0;
  cancelScheduledClear();
  const sameSource = sourceText === state.lastSourceText;
  if (
    sameSource &&
    state.lastSubtitleAt &&
    Date.now() - state.lastSubtitleAt >= getSubtitleMaxHoldMs(sourceText)
  ) {
    clearCurrentSubtitleState({ ignoreSourceText: true });
    return;
  }
  if (!sameSource) state.lastSubtitleAt = Date.now();
  hideNativeSubtitleElementsForSourceText(sourceText);
  armNativeFlashProtection(1200);

  if (sourceText === state.lastSourceText) {
    if (!hasCurrentTranslation(sourceText) && state.pendingSourceText !== sourceText) {
      if (shouldSkipInvalidTranslation(sourceText)) return;
      translateCurrentSubtitle(sourceText);
    }
    return;
  }

  state.lastSourceText = sourceText;
  state.pendingSourceText = "";
  state.pendingSubtitleAt = 0;
  if (shouldSkipInvalidTranslation(sourceText)) return;
  translateCurrentSubtitle(sourceText);
}

async function tryImmediateCachedRender() {
  if (state.extensionContextInvalidated) return;
  if (!isNetflixWatchPage()) return;
  if (!state.settings || !state.settings.enabled || state.settings.subtitleSourceMode === "pretranslated") return;
  suppressNativeSubtitleFlash();
  const sourceText = findVisibleSubtitleText();
  if (!sourceText || sourceText === state.pendingSourceText) return;
  cancelScheduledClear();
  if (shouldSkipInvalidTranslation(sourceText)) return;
  if (sourceText === state.lastSourceText) {
    if (!hasCurrentTranslation(sourceText) && state.pendingSourceText !== sourceText) {
      scheduleScan(0);
    }
    return;
  }

  state.pendingSourceText = sourceText;
  state.pendingSubtitleAt = Date.now();
  state.lastSubtitleAt = state.pendingSubtitleAt;
  state.requestSequence += 1;
  hideNativeSubtitleElementsForSourceText(sourceText);
  armNativeFlashProtection(1200);
  updateOverlay(sourceText, state.lastTranslation, "loading");

  try {
    const response = await chrome.runtime.sendMessage({
      type: "GET_CACHED_TRANSLATION",
      sourceText
    });
    if (!response || !response.ok || !response.translation) {
      if (sourceText === state.pendingSourceText) {
        state.lastSubtitleAt = Date.now();
        state.lastSourceText = sourceText;
        state.pendingSourceText = "";
        state.pendingSubtitleAt = 0;
        translateCurrentSubtitle(sourceText);
      }
      return;
    }
    if (sourceText !== state.pendingSourceText && sourceText !== state.lastSourceText) return;

    state.lastSubtitleAt = Date.now();
    state.lastSourceText = sourceText;
    state.pendingSourceText = "";
    state.pendingSubtitleAt = 0;
    state.lastTranslation = sanitizeOverlayTranslationText(response.translation, sourceText);
    if (!state.lastTranslation) {
      state.pendingSourceText = "";
      state.pendingSubtitleAt = 0;
      markInvalidTranslation(sourceText);
      scheduleScan(120);
      return;
    }
    state.lastTranslationSourceText = sourceText;
    rememberTranslationContext(sourceText, state.lastTranslation);
    updateOverlay(sourceText, state.lastTranslation, "ready");
  } catch (error) {
    state.pendingSourceText = "";
    state.pendingSubtitleAt = 0;
    if (quiesceInvalidatedExtensionContext(error)) return;
    scheduleScan(0);
    console.error("[Netflix DeepSeek Translator] cache lookup failed", error);
  }
}

function findVisibleSubtitleText() {
  const activeCueText = findFromActiveTextTrackCues();
  if (activeCueText) return activeCueText;
  const direct = findFromKnownSubtitleContainers();
  if (direct) return direct;
  if (!state.settings || state.settings.advancedSubtitleFallback !== true) return "";
  const recentlyHidden = findFromRecentlyHiddenNativeSubtitleText();
  if (recentlyHidden) return recentlyHidden;
  return findFromPlayerTextFallback();
}

function findFromActiveTextTrackCues() {
  const candidates = getActiveCueTexts();
  if (candidates.length && shouldHideNativeSubtitles()) {
    const nativeElements = findNativeSubtitleElementsMatchingCueTexts(candidates);
    if (nativeElements.length) {
      hideNativeSubtitleElementsNow(nativeElements);
    }
  }
  return mergeSubtitleLines(candidates);
}

function getActiveCueTexts() {
  const candidates = [];
  for (const track of getVideoTextTracks()) {
    if (!isSubtitleTextTrack(track)) continue;
    let activeCues;
    try {
      activeCues = track.activeCues;
    } catch (error) {
      activeCues = null;
    }
    if (!activeCues || !activeCues.length) continue;
    for (const cue of Array.from(activeCues)) {
      const text = getCueText(cue);
      if (isPlausibleSubtitle(text)) candidates.push(text);
    }
  }
  return Array.from(new Set(candidates));
}

function getCueText(cue) {
  if (!cue) return "";
  if (typeof cue.text === "string") return normalizeSubtitleText(cue.text);
  return normalizeSubtitleText(cue.textContent || "");
}

function findFromKnownSubtitleContainers() {
  const subtitleElements = findNativeSubtitleContainers();
  const candidates = subtitleElements
    .map(readSubtitleElementText)
    .filter(isPlausibleSubtitle);

  const text = mergeSubtitleLines(candidates);
  if (text) {
    rememberNativeSubtitleElements(subtitleElements);
    return text;
  }

  return "";
}

function findNativeSubtitleContainers() {
  const containers = findNativeSubtitleLayerElements({
    includeBroadSubtitleSelector: Boolean(state.settings && state.settings.advancedSubtitleFallback)
  });

  return Array.from(new Set(containers)).filter((element) => {
    if (!element || element.closest(`#${OVERLAY_ID}`)) return false;
    const text = readSubtitleElementText(element);
    if (!isPlausibleSubtitle(text)) return false;
    if (matchesKnownSubtitleLayerSelector(element)) return true;
    if (!isVisible(element)) return false;
    return !isNetflixUiElement(element);
  });
}

function findFromRecentlyHiddenNativeSubtitleText() {
  const dataset = document.documentElement.dataset;
  const candidates = [
    {
      text: dataset.ndstContentNativeLastHiddenText,
      at: Number(dataset.ndstContentNativeLastHiddenAt || 0),
      className: dataset.ndstContentNativeLastHiddenClass,
      dataUia: dataset.ndstContentNativeLastHiddenUia
    },
    {
      text: dataset.ndstNativeLastHiddenText,
      at: Number(dataset.ndstNativeLastHiddenAt || 0),
      className: dataset.ndstNativeLastHiddenClass,
      dataUia: dataset.ndstNativeLastHiddenUia
    }
  ];
  const now = Date.now();
  for (const candidate of candidates) {
    const text = normalizeSubtitleText(candidate.text || "");
    if (!isTrustedRecentlyHiddenSubtitleCandidate(candidate)) continue;
    if (!isPlausibleSubtitle(text)) continue;
    if (candidate.at && now - candidate.at > 1800) continue;
    return text;
  }
  return "";
}

function isTrustedRecentlyHiddenSubtitleCandidate(candidate) {
  const signature = `${candidate && candidate.className || ""} ${candidate && candidate.dataUia || ""}`;
  return /(?:player[-_]?timedtext|timed[-_]?text|text[-_]?track|player[-_]?subtitle|subtitle[-_]?(?:text|container)|captions?[-_]?(?:text|window|container))/i.test(signature);
}

function readSubtitleElementText(element) {
  return normalizeSubtitleText((element && (element.textContent || element.innerText)) || "");
}

function findFromPlayerTextFallback() {
  const playerRoot = findPlayerRoot();
  if (!playerRoot) return "";

  const candidates = [];
  const walker = document.createTreeWalker(playerRoot, NodeFilter.SHOW_ELEMENT);
  let visited = 0;
  while (visited < 600) {
    const element = walker.nextNode();
    if (!element) break;
    visited += 1;
    if (!["DIV", "P", "SPAN"].includes(element.tagName)) continue;
    if (!looksLikeVisualSubtitleElement(element)) continue;
    const text = normalizeSubtitleText(element.innerText || element.textContent);
    if (isPlausibleSubtitle(text)) candidates.push(text);
    if (candidates.length >= 6) break;
  }

  const text = getStableFallbackText(mergeSubtitleLines(candidates));
  if (text) {
    rememberNativeSubtitleElements(findNativeSubtitleContainers());
  }
  return text;
}

function getStableFallbackText(text) {
  if (!text) {
    state.fallbackCandidateText = "";
    state.fallbackCandidateCount = 0;
    return "";
  }
  if (text === state.fallbackCandidateText) {
    state.fallbackCandidateCount += 1;
  } else {
    state.fallbackCandidateText = text;
    state.fallbackCandidateCount = 1;
  }
  return state.fallbackCandidateCount >= 2 ? text : "";
}

function isVisible(element) {
  if (!element || element.id === OVERLAY_ID || element.closest(`#${OVERLAY_ID}`)) return false;
  const rect = element.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return false;
  if (state.nativeSubtitleStyleCache.has(element) || isSuppressedNativeSubtitleElement(element)) {
    return rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
  }
  const style = window.getComputedStyle(element);
  if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) {
    return false;
  }
  return rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
}

function isSuppressedNativeSubtitleElement(element) {
  if (!shouldHideNativeSubtitles()) return false;
  if (element.classList && element.classList.contains("ndst-native-subtitle-hidden")) return true;
  if (element.closest && element.closest(".ndst-native-subtitle-hidden")) return true;
  return matchesKnownSubtitleLayerSelector(element);
}

function matchesKnownSubtitleLayerSelector(element) {
  return Boolean(
    (element.matches && element.matches(NATIVE_SUBTITLE_LAYER_SELECTOR)) ||
    (element.closest && element.closest(NATIVE_SUBTITLE_LAYER_SELECTOR))
  );
}

function isNetflixUiElement(element) {
  if (!element || !element.closest) return true;
  if (matchesKnownSubtitleLayerSelector(element)) return false;
  const excluded = element.closest([
    "button",
    "input",
    "select",
    "textarea",
    '[role="button"]',
    '[role="menu"]',
    '[role="menuitem"]',
    '[data-uia*="control"]',
    '[data-uia*="button"]',
    '[data-uia*="progress"]',
    '[data-uia*="duration"]',
    '[data-uia*="menu"]',
    '[data-uia*="title"]'
  ].join(","));
  if (excluded) return true;
  if (element.matches && element.matches('[aria-label]')) return true;

  const rect = element.getBoundingClientRect();
  const nearBottom = rect.top > window.innerHeight * 0.45;
  const centeredEnough = rect.left < window.innerWidth * 0.75 && rect.right > window.innerWidth * 0.25;
  return !(nearBottom && centeredEnough);
}

function normalizeSubtitleText(text) {
  return String(text || "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function isPlausibleSubtitle(text) {
  if (!text) return false;
  if (isCorruptSubtitleText(text)) return false;
  if (text.length > MAX_SUBTITLE_LENGTH) return false;
  const lines = text.split("\n").filter(Boolean);
  if (lines.length > 3) return false;
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(text)) return false;
  if (/^(Skip|Intro|Next|Episode|Pause|Play|Audio|Subtitles|Settings)$/i.test(text)) return false;
  if (isLikelyNetflixUiText(text)) return false;
  if (/^(跳过|播放|暂停|音频|字幕|设置|下一集|片头)$/.test(text)) return false;
  return /[A-Za-z\u3040-\u30ff\u3400-\u9fff]/.test(text);
}

function isCorruptSubtitleText(text) {
  const value = String(text || "");
  if (!value.trim()) return true;
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\uE000-\uF8FF]/.test(value)) return true;
  if (/\uFFFD/.test(value)) return true;
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
  if (compact.length >= 12 && suspicious / compact.length > 0.18 && readable / compact.length < 0.65) {
    return true;
  }
  const symbols = (compact.match(/[^\w\u3040-\u30ff\u3400-\u9fff.,!?'"，。！？、…:;()\-\[\]]/g) || []).length;
  return compact.length >= 18 && symbols / compact.length > 0.45;
}

function sanitizeSubtitleDisplayText(text) {
  const raw = normalizeSubtitleText(text);
  if (isStructuredSubtitleLeak(raw)) return "";
  let value = raw;
  if (!value) return "";
  value = value
    .replace(/^\s*\d+\.\s+/, "")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/^["'“”‘’「『]+|["'“”‘’」』]+$/g, "")
    .trim();
  return isCorruptSubtitleText(value) ? "" : value;
}

function sanitizeOverlayTranslationText(text, sourceText = "") {
  const value = sanitizeSubtitleDisplayText(text);
  if (!value) return "";
  if (isTargetLanguageMismatch(value, sourceText)) return "";
  return value;
}

function sanitizeOverlayStatusText(text) {
  const value = sanitizeSubtitleDisplayText(text);
  if (!value || value.length > 120) return "";
  return value;
}

function isTargetLanguageMismatch(text, sourceText = "") {
  if (!state.settings || !String(state.settings.targetLanguage || "").startsWith("zh")) return false;
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

function markInvalidTranslation(sourceText) {
  const source = sanitizeSubtitleDisplayText(sourceText);
  if (!source) return;
  state.invalidTranslationSourceText = source;
  state.invalidTranslationUntil = Date.now() + 15000;
}

function shouldSkipInvalidTranslation(sourceText) {
  const source = sanitizeSubtitleDisplayText(sourceText);
  return Boolean(
    source &&
    state.invalidTranslationSourceText === source &&
    Date.now() < state.invalidTranslationUntil
  );
}

function isStructuredSubtitleLeak(text) {
  const raw = String(text || "");
  if (!raw.trim()) return false;
  if (/```|^\s*[{[]|\b(?:sourceText|translation|targetLanguage|model)\b\s*[:=]/i.test(raw)) return true;
  if (/(?:原文|译文|当前字幕|上文)\s*[:：]/.test(raw)) return true;
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length > 3) return true;
  const listLines = lines.filter((line) => /^(?:[-*]\s+|\d+[.)]\s+)/.test(line)).length;
  if (listLines >= 2) return true;
  if (/\*\*.*\*\*.*\*\*/s.test(raw)) return true;
  return false;
}

function isLikelyNetflixUiText(text) {
  const normalized = normalizeSubtitleText(text);
  if (isLikelyEpisodeMetadataText(normalized)) return true;
  if (/^(Episodes|More Like This|Trailers|Audio|Subtitles|Next Episode|Resume|Restart|My List|Rate|Details|Skip Intro|Skip Recap)$/i.test(normalized)) {
    return true;
  }
  if (/^(剧集|更多类似影片|预告片|音频|字幕|下一集|继续播放|重新开始|我的片单|评分|详情|跳过片头|跳过前情提要)$/.test(normalized)) {
    return true;
  }
  if (/^S\d+\s*E\d+/i.test(normalized)) return true;
  if (/^\d+\.\s+/.test(normalized)) return true;
  return false;
}

function isLikelyEpisodeMetadataText(text) {
  const normalized = normalizeSubtitleText(text);
  if (/\bS\d+\s*E\d+\b/i.test(normalized)) return true;
  if (/\bSeason\s*\d+\b.*\bEpisode\s*\d+\b/i.test(normalized)) return true;
  if (/第\s*\d+\s*季\s*第?\s*\d+\s*集/.test(normalized)) return true;
  if (/第\s*\d+\s*集\s*[“"「『]/.test(normalized)) return true;
  if (/^\d{1,2}:\d{2}.*第\s*\d+\s*集/.test(normalized)) return true;
  return false;
}

function mergeSubtitleLines(candidates) {
  const unique = [];
  for (const candidate of candidates) {
    if (!candidate || unique.includes(candidate)) continue;
    if (unique.some((existing) => existing.includes(candidate))) continue;
    unique.push(candidate);
  }
  return normalizeSubtitleText(unique.join("\n"));
}

async function translateCurrentSubtitle(sourceText) {
  if (state.extensionContextInvalidated) return;
  const seq = ++state.requestSequence;
  state.pendingSourceText = sourceText;
  state.pendingSubtitleAt = Date.now();

  if (shouldHideNativeSubtitles()) {
    armNativeFlashProtection(1400);
    suppressNativeSubtitleFlash([], { includeVisualSubtitleCandidates: true });
    hideNativeSubtitleElementsForSourceText(sourceText, { force: true });
  } else {
    restoreNativeSubtitles(false);
  }
  const keepPreviousTranslation =
    state.settings &&
    state.settings.displayMode !== "bilingual" &&
    state.lastTranslation &&
    !hasCurrentTranslation(sourceText);
  updateOverlay(sourceText, keepPreviousTranslation ? state.lastTranslation : "", "loading");

  try {
    const response = await chrome.runtime.sendMessage({
      type: "TRANSLATE_SUBTITLE",
      sourceText,
      context: buildTranslationContext(sourceText),
      requestId: seq,
      seq
    });

    if (seq !== state.requestSequence || sourceText !== state.lastSourceText) return;

    if (!response || !response.ok) {
      state.pendingSourceText = "";
      state.pendingSubtitleAt = 0;
      if (response && /EMPTY_TRANSLATION|BATCH_TRANSLATION_MISSING_ITEM/i.test(response.details || response.error || "")) {
        markInvalidTranslation(sourceText);
      }
      showTemporaryError(response && response.error ? response.error : "翻译请求失败");
      return;
    }

    const translation = sanitizeOverlayTranslationText(response.translation, sourceText);
    if (!translation) {
      state.pendingSourceText = "";
      state.pendingSubtitleAt = 0;
      markInvalidTranslation(sourceText);
      return;
    }
    state.pendingSourceText = "";
    state.pendingSubtitleAt = 0;
    state.lastTranslation = translation;
    state.lastTranslationSourceText = sourceText;
    rememberTranslationContext(sourceText, translation);
    updateOverlay(sourceText, translation, "ready");
  } catch (error) {
    if (seq !== state.requestSequence) return;
    state.pendingSourceText = "";
    state.pendingSubtitleAt = 0;
    if (quiesceInvalidatedExtensionContext(error)) return;
    console.error("[Netflix DeepSeek Translator]", error);
    showTemporaryError("翻译请求失败，请检查网络或 API Key");
  }
}

function quiesceInvalidatedExtensionContext(error) {
  if (!/Extension context invalidated/i.test(String(error && error.message || error || ""))) {
    return false;
  }
  if (state.extensionContextInvalidated) return true;

  state.extensionContextInvalidated = true;
  state.requestSequence += 1;
  state.pendingSourceText = "";
  state.pendingSubtitleAt = 0;
  window.clearInterval(state.liveRecognitionInterval);
  window.clearInterval(state.nativeSuppressionInterval);
  window.clearInterval(state.pretranslatedTimer);
  window.clearInterval(state.locationPollTimer);
  state.liveRecognitionInterval = 0;
  state.nativeSuppressionInterval = 0;
  state.pretranslatedTimer = 0;
  state.locationPollTimer = 0;
  for (const timer of [
    state.debounceTimer,
    state.cacheRenderTimer,
    state.observerAttachTimer,
    state.observerProcessTimer,
    state.clearTimer,
    state.hintTimer,
    state.errorTimer,
    state.locationChangeTimer,
    state.fullscreenChangeTimer,
    state.nativeFlashProtectionTimer
  ]) {
    window.clearTimeout(timer);
  }
  clearNativeHideReapplyTimers();
  clearNativeHideBurstTimers();
  if (state.observer) state.observer.disconnect();
  if (state.nativeSuppressionObserver) state.nativeSuppressionObserver.disconnect();
  state.observer = null;
  state.nativeSuppressionObserver = null;
  removeNativeTextTrackGuards();
  document.documentElement.dataset.ndstExtensionContext = "invalidated-stopped";
  return true;
}

function buildTranslationContext(currentSourceText) {
  const current = normalizeSubtitleText(currentSourceText);
  return state.translationContext
    .filter((item) => item && item.sourceText && item.sourceText !== current)
    .slice(-3)
    .map((item) => ({
      sourceText: item.sourceText,
      translation: item.translation
    }));
}

function rememberTranslationContext(sourceText, translation) {
  const source = sanitizeSubtitleDisplayText(sourceText);
  const target = sanitizeOverlayTranslationText(translation, source);
  if (!source || !target) return;
  state.translationContext = state.translationContext
    .filter((item) => item.sourceText !== source)
    .concat([{ sourceText: source, translation: target }])
    .slice(-6);
}

function hasCurrentTranslation(sourceText) {
  const source = sanitizeSubtitleDisplayText(sourceText);
  return Boolean(
    source &&
    state.lastTranslation &&
    sanitizeSubtitleDisplayText(state.lastTranslationSourceText) === source
  );
}

function updateOverlay(sourceText, translation, status) {
  ensureOverlay();
  if (!isNetflixWatchPage()) {
    setNativeMaskEnabled(false);
    clearOverlayOnly();
    return;
  }
  const sourceElement = state.overlay.querySelector(".ndst-source");
  const translationElement = state.overlay.querySelector(".ndst-translation");
  const statusElement = state.overlay.querySelector(".ndst-status");

  state.overlay.dataset.status = status;
  const normalizedSourceText = status === "hint" || status === "error"
    ? sanitizeOverlayStatusText(sourceText)
    : sanitizeSubtitleDisplayText(sourceText);
  const normalizedTranslation = sanitizeOverlayTranslationText(translation, normalizedSourceText || sourceText);
  if (
    status !== "hint" &&
    status !== "error" &&
    sourceText &&
    !normalizedSourceText &&
    !normalizedTranslation
  ) {
    clearOverlayOnly();
    return;
  }
  const isBilingual = state.settings && state.settings.displayMode === "bilingual";
  const shouldShowSource = isBilingual &&
    status !== "hint" &&
    status !== "error" &&
    Boolean(normalizedSourceText);
  sourceElement.textContent = shouldShowSource ? normalizedSourceText : "";
  translationElement.textContent = normalizedTranslation;

  if (status === "hint") {
    statusElement.textContent = normalizedSourceText || NO_SUBTITLE_HINT_TEXT;
  } else if (status === "loading") {
    statusElement.textContent = "...";
  } else if (status === "error") {
    statusElement.textContent = normalizedSourceText || "翻译请求失败";
  } else {
    statusElement.textContent = "";
  }

  if (shouldHideNativeSubtitles()) {
    setNativeMaskEnabled(true);
    suppressNativeSubtitleFlash();
    queueNativeHideBurst();
    if (sourceText && (status === "ready" || status === "loading")) {
      hideNativeSubtitleElementsForSourceText(sourceText);
    }
  } else {
    setNativeMaskEnabled(false);
    restoreNativeSubtitles();
  }
}

function showTemporaryError(message) {
  window.clearTimeout(state.errorTimer);
  updateOverlay(message, state.lastTranslation, "error");
  state.errorTimer = window.setTimeout(() => {
    state.errorTimer = 0;
    if (hasCurrentTranslation(state.lastSourceText)) {
      updateOverlay(state.lastSourceText, state.lastTranslation, "ready");
    } else {
      updateOverlay("", "", "empty");
    }
  }, 2200);
}

function scheduleClear() {
  if (!state.lastSourceText && !state.lastTranslation && !state.pendingSourceText) return;
  if (state.clearTimer) return;
  const delayMs = getSubtitleClearDelayMs(state.lastSourceText || state.lastTranslationSourceText);
  state.clearTimer = window.setTimeout(() => clearCurrentSubtitleState(), delayMs);
}

function cancelScheduledClear() {
  if (!state.clearTimer) return;
  window.clearTimeout(state.clearTimer);
  state.clearTimer = 0;
}

function getSubtitleClearDelayMs(sourceText) {
  const length = normalizeSubtitleText(sourceText).replace(/\s+/g, "").length;
  if (length <= 6) return 250;
  if (length <= 18) return 350;
  if (length <= 36) return 450;
  return 550;
}

function getSubtitleMaxHoldMs(sourceText) {
  const length = normalizeSubtitleText(sourceText).replace(/\s+/g, "").length;
  if (length <= 6) return 8000;
  if (length <= 18) return 10000;
  if (length <= 36) return 12000;
  return MAX_SAME_SUBTITLE_HOLD_MS;
}

function clearCurrentSubtitleState({ ignoreSourceText = false } = {}) {
  const sourceText = normalizeSubtitleText(state.lastSourceText || state.pendingSourceText);
  state.clearTimer = 0;
  state.lastSourceText = "";
  state.lastTranslation = "";
  state.lastTranslationSourceText = "";
  state.pendingSourceText = "";
  state.pendingSubtitleAt = 0;
  state.lastPretranslatedCueId = "";
  state.requestSequence += 1;
  state.ignoredStaleSourceText = ignoreSourceText ? sourceText : "";
  window.clearTimeout(state.errorTimer);
  state.errorTimer = 0;
  if (shouldHideNativeSubtitles()) {
    suppressNativeSubtitleFlash();
  } else {
    restoreNativeSubtitles();
  }
  updateOverlay("", "", "empty");
}

function scheduleNoSubtitleHint() {
  const enabledState = getNativeSubtitleEnabledState();
  document.documentElement.dataset.ndstNativeSubtitleEnabledState = enabledState;
  if (enabledState !== "disabled") {
    window.clearTimeout(state.hintTimer);
    state.hintTimer = 0;
    clearNoSubtitleHintOverlay();
    return;
  }
  if (state.hintTimer) return;
  state.hintTimer = window.setTimeout(() => {
    state.hintTimer = 0;
    if (
      !state.lastSourceText &&
      !state.pendingSourceText &&
      getNativeSubtitleEnabledState() === "disabled"
    ) {
      updateOverlay(NO_SUBTITLE_HINT_TEXT, "", "hint");
    }
  }, NO_SUBTITLE_HINT_DELAY_MS);
}

function getNativeSubtitleEnabledState() {
  const dataset = document.documentElement.dataset;
  const guardMarkerPresent = Object.prototype.hasOwnProperty.call(
    dataset,
    "ndstTextTrackGuardEnabledCount"
  );
  const guardEnabledCount = guardMarkerPresent
    ? Number(dataset.ndstTextTrackGuardEnabledCount || 0)
    : null;
  const trackStates = [];
  for (const track of getVideoTextTracks()) {
    if (!isSubtitleTextTrack(track)) continue;
    let mode = "";
    let activeCueCount = 0;
    try {
      mode = String(track.mode || "").toLowerCase();
      activeCueCount = track.activeCues ? Number(track.activeCues.length || 0) : 0;
    } catch (error) {
      mode = "";
    }
    trackStates.push({
      mode,
      activeCueCount,
      forcedHidden: mode === "hidden" && state.nativeTextTrackModeCache.get(track) === "showing"
    });
  }
  return inferNativeSubtitleEnabledState({
    guardEnabledCount,
    trackStates,
    hasMountedLayer: hasMountedNativeSubtitleLayer(),
    hasSeenSubtitle: state.lastSubtitleAt > 0
  });
}

function inferNativeSubtitleEnabledState(input) {
  const {
    guardEnabledCount = null,
    trackStates = [],
    hasMountedLayer = false,
    hasSeenSubtitle = false
  } = input || {};
  if (Number(guardEnabledCount) > 0) return "enabled";
  if (trackStates.some((track) =>
    track.mode === "showing" || track.forcedHidden || Number(track.activeCueCount) > 0
  )) {
    return "enabled";
  }
  if (trackStates.length && trackStates.every((track) => track.mode === "disabled")) {
    return "disabled";
  }
  if (hasMountedLayer || hasSeenSubtitle) return "enabled";
  return "unknown";
}

function hasMountedNativeSubtitleLayer() {
  const playerRoot = findPlayerRoot();
  return Boolean(playerRoot && playerRoot.querySelector(SUBTITLE_ENABLEMENT_LAYER_SELECTOR));
}

function clearNoSubtitleHintOverlay() {
  if (!state.overlay || state.overlay.dataset.status !== "hint") return;
  const statusElement = state.overlay.querySelector(".ndst-status");
  if (!statusElement || statusElement.textContent !== NO_SUBTITLE_HINT_TEXT) return;
  updateOverlay("", "", "empty");
}

function shouldHideNativeSubtitles() {
  if (state.nativePrehideUntil && Date.now() < state.nativePrehideUntil) return true;
  if (!state.settings) {
    return document.documentElement.dataset.ndstHideNativeSubtitles === "true";
  }
  return state.settings.hideNativeSubtitles !== false;
}

function getNativeHideReason() {
  if (!state.settings) return "settings-loading";
  if (!state.settings.enabled) return "plugin-disabled";
  return "replace-native-forced";
}

function getOverlayBottomOffset() {
  if (!shouldHideNativeSubtitles()) return 18;
  const value = Number(state.settings && state.settings.bottomOffset);
  if (!Number.isFinite(value)) return 9;
  return Math.min(12, Math.max(8, value));
}

function rememberNativeSubtitleElements(elements) {
  const existing = Array.from(state.nativeSubtitleElements)
    .filter((element) => element && element.isConnected);
  const expanded = expandNativeSubtitleElements([...existing, ...(elements || [])]);
  state.nativeSubtitleElements = new Set(expanded.slice(-MAX_NATIVE_SUBTITLE_ELEMENTS));
}

function expandNativeSubtitleElements(elements) {
  const expanded = [];
  for (const element of elements || []) {
    if (!element || !element.isConnected || element.closest(`#${OVERLAY_ID}`)) continue;
    expanded.push(element);
    const stableParent = findStableSubtitleContainer(element);
    if (stableParent) expanded.push(stableParent);
  }
  return Array.from(new Set(expanded)).filter((element) => {
    if (!element || !element.isConnected || element.closest(`#${OVERLAY_ID}`)) return false;
    if (!isInsidePlayerRoot(element)) return false;
    return !isNetflixUiElement(element);
  });
}

function findStableSubtitleContainer(element) {
  if (!element || !element.parentElement || matchesKnownSubtitleLayerSelector(element)) {
    return element;
  }
  const baseRect = element.getBoundingClientRect();
  if (!isUsableSubtitleRect(baseRect)) return element;
  const baseText = normalizeSubtitleText(element.innerText || element.textContent);
  if (!isPlausibleSubtitle(baseText)) return element;

  let best = element;
  let current = element.parentElement;
  let depth = 0;
  while (current && depth < 3 && isInsidePlayerRoot(current)) {
    if (current.id === OVERLAY_ID || isNetflixUiElement(current)) break;
    const text = normalizeSubtitleText(current.innerText || current.textContent);
    if (!text || text.length > MAX_SUBTITLE_LENGTH * 1.35) break;
    if (!text.includes(baseText) && !baseText.includes(text)) break;
    const rect = current.getBoundingClientRect();
    if (!isUsableSubtitleRect(rect)) break;
    if (rect.width > Math.max(baseRect.width + 240, baseRect.width * 2.8)) break;
    if (rect.height > Math.max(baseRect.height + 90, baseRect.height * 4)) break;
    best = current;
    if (matchesKnownSubtitleLayerSelector(current)) break;
    current = current.parentElement;
    depth += 1;
  }
  return best;
}

function findNativeSubtitleLayerElements({
  includeBroadSubtitleSelector = false,
  includeVisualSubtitleCandidates = false
} = {}) {
  const playerRoot = findPlayerRoot();

  const elements = [];
  if (playerRoot && playerRoot.querySelectorAll) {
    elements.push(...Array.from(playerRoot.querySelectorAll(NATIVE_SUBTITLE_LAYER_SELECTOR)));
    if (includeBroadSubtitleSelector) {
      elements.push(...Array.from(playerRoot.querySelectorAll(BROAD_SUBTITLE_LAYER_SELECTOR))
        .filter((element) => isVisible(element) && !isNetflixUiElement(element)));
    }
  }

  elements.push(...findSafeGlobalNativeSubtitleLayerElements());

  if (playerRoot && includeVisualSubtitleCandidates) {
    elements.push(...findVisualSubtitleTextElements(playerRoot));
  }

  return Array.from(new Set(elements)).filter((element) => {
    if (!element || element.closest(`#${OVERLAY_ID}`)) return false;
    return matchesKnownSubtitleLayerSelector(element) || !isNetflixUiElement(element);
  });
}

function findSafeGlobalNativeSubtitleLayerElements() {
  if (!document.querySelectorAll) return [];
  return Array.from(document.querySelectorAll(STYLE_GLOBAL_SUBTITLE_SELECTORS.join(",")));
}

function findPlayerRoot() {
  const fullscreenElement = getFullscreenElement();
  if (fullscreenElement && fullscreenElement.nodeType === Node.ELEMENT_NODE) {
    if (
      (fullscreenElement.matches && fullscreenElement.matches(PLAYER_ROOT_SELECTOR)) ||
      fullscreenElement.tagName === "VIDEO" ||
      (fullscreenElement.querySelector && fullscreenElement.querySelector("video"))
    ) {
      return fullscreenElement;
    }
  }
  for (const selector of PLAYER_ROOT_SELECTORS) {
    const element = document.querySelector(selector);
    if (element) return element;
  }
  return fullscreenElement && fullscreenElement.querySelector
    ? fullscreenElement
    : null;
}

function getPlayerRoot() {
  return findPlayerRoot();
}

function isInsidePlayerRoot(element) {
  if (!element) return false;
  const playerRoot = getPlayerRoot();
  return playerRoot === element || Boolean(playerRoot && playerRoot.contains(element));
}

function collectNativeSubtitleElementsFromMutations(mutations) {
  if (!mutations || !mutations.length || !shouldHideNativeSubtitles()) return [];
  const playerRoot = findPlayerRoot();
  if (!playerRoot) return [];
  const selector = getNativeMutationSelector();
  const elements = [];

  for (const mutation of mutations) {
    if (mutation.type === "attributes" && mutation.target && mutation.target.nodeType === Node.ELEMENT_NODE) {
      collectNativeSubtitleElementsFromNode(mutation.target, selector, elements, playerRoot);
    }
    if (mutation.type === "characterData" && mutation.target) {
      collectNativeSubtitleElementsFromNode(mutation.target, selector, elements, playerRoot);
    }
    for (const node of mutation.addedNodes || []) {
      collectNativeSubtitleElementsFromNode(node, selector, elements, playerRoot);
    }
  }

  return Array.from(new Set(elements)).filter((element) => {
    if (!element || !element.isConnected || element.closest(`#${OVERLAY_ID}`)) return false;
    if (!isInsidePlayerRoot(element)) return false;
    return !isNetflixUiElement(element);
  });
}

function collectNativeSubtitleElementsFromNode(node, selector, elements, playerRoot) {
  const element = node && node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  if (!element || element.nodeType !== Node.ELEMENT_NODE) return;
  const insidePlayer = playerRoot === element || playerRoot.contains(element);
  const containsPlayer = element.contains && element.contains(playerRoot);
  if (!insidePlayer && !containsPlayer) return;
  const scanRoot = insidePlayer ? element : playerRoot;

  if (element.matches && element.matches(selector)) {
    addNativeSubtitleCandidate(elements, element);
  }
  if (element.closest) {
    const closest = element.closest(selector);
    if (closest) addNativeSubtitleCandidate(elements, closest);
  }
  if (scanRoot.querySelectorAll && scanRoot !== playerRoot) {
    const matchedElements = scanRoot.querySelectorAll(selector);
    for (let index = 0; index < matchedElements.length && index < 24; index += 1) {
      const matchedElement = matchedElements[index];
      addNativeSubtitleCandidate(elements, matchedElement);
    }
  }

  if (insidePlayer && looksLikeVisualSubtitleElement(element)) {
    addNativeSubtitleCandidate(elements, element);
  }
  if (insidePlayer && scanRoot !== playerRoot) {
    for (const visualElement of findVisualSubtitleTextElementsFromNode(scanRoot, 64, 6)) {
      addNativeSubtitleCandidate(elements, visualElement);
    }
  }
}

function addNativeSubtitleCandidate(elements, element) {
  if (!element) return;
  elements.push(element);
  const stableParent = findStableSubtitleContainer(element);
  if (stableParent && stableParent !== element) {
    elements.push(stableParent);
  }
}

function findVisualSubtitleTextElements(playerRoot) {
  if (!playerRoot) return [];
  const matches = [];
  const nodes = Array.from(playerRoot.querySelectorAll("span, div, p"));
  for (let index = nodes.length - 1, visited = 0; index >= 0 && visited < 320; index -= 1, visited += 1) {
    const element = nodes[index];
    if (!looksLikeVisualSubtitleElement(element)) continue;
    matches.push(element);
    if (matches.length >= 16) break;
  }
  return matches;
}

function findVisualSubtitleTextElementsFromNode(root, maxVisits = 64, maxMatches = 6) {
  const element = root && root.nodeType === Node.TEXT_NODE ? root.parentElement : root;
  if (!element || element.nodeType !== Node.ELEMENT_NODE) return [];
  const playerRoot = findPlayerRoot();
  if (!playerRoot || (playerRoot !== element && !playerRoot.contains(element))) return [];
  if (element.closest && element.closest(`#${OVERLAY_ID}`)) return [];

  const matches = [];
  if (looksLikeVisualSubtitleElement(element)) {
    matches.push(element);
    if (matches.length >= maxMatches) return matches;
  }

  if (!element.querySelector || element === playerRoot || element.contains(playerRoot)) {
    return matches;
  }

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT);
  let visited = 0;
  while (visited < maxVisits) {
    const child = walker.nextNode();
    if (!child) break;
    visited += 1;
    if (!["DIV", "P", "SPAN"].includes(child.tagName)) continue;
    if (!looksLikeVisualSubtitleElement(child)) continue;
    matches.push(child);
    if (matches.length >= maxMatches) break;
  }

  return matches;
}

function looksLikeVisualSubtitleElement(element) {
  if (!element || element.closest(`#${OVERLAY_ID}`)) return false;
  if (!["DIV", "P", "SPAN"].includes(element.tagName)) return false;
  const rawText = element.textContent || "";
  if (!rawText || rawText.length > MAX_SUBTITLE_LENGTH * 2) return false;
  const text = normalizeSubtitleText(rawText);
  if (!isPlausibleSubtitle(text)) return false;
  if (!isInsidePlayerRoot(element)) return false;
  if (isNetflixUiElement(element)) return false;
  const rect = element.getBoundingClientRect();
  if (rect.width < 16 || rect.height < 8) return false;
  if (rect.width > window.innerWidth * 0.9 || rect.height > window.innerHeight * 0.26) return false;
  const inSubtitleBand = rect.top > window.innerHeight * 0.42 && rect.bottom < window.innerHeight + 4;
  const centered = rect.left < window.innerWidth * 0.84 && rect.right > window.innerWidth * 0.16;
  return inSubtitleBand && centered;
}

function suppressNativeSubtitleFlash(seedElements = [], {
  includeBroadSubtitleSelector = false,
  includeVisualSubtitleCandidates = false
} = {}) {
  if (!shouldHideNativeSubtitles()) return;
  syncNativeMaskHost();
  suppressNativeVideoTextTracks();
  const activeCueElements = findNativeSubtitleElementsMatchingActiveCues();
  const shouldIncludeVisual = includeVisualSubtitleCandidates || isNativeFlashProtectionActive();
  const shouldScan = includeBroadSubtitleSelector || shouldIncludeVisual;
  const elements = shouldScan
    ? findNativeSubtitleLayerElements({
      includeBroadSubtitleSelector,
      includeVisualSubtitleCandidates: shouldIncludeVisual
    })
    : [];
  const allElements = [...seedElements, ...activeCueElements, ...elements];
  if (!allElements.length && !state.nativeSubtitleElements.size) return;
  rememberNativeSubtitleElements([
    ...Array.from(state.nativeSubtitleElements).filter((element) => element && element.isConnected),
    ...allElements
  ]);
  syncNativeMasksToSubtitleElements(Array.from(state.nativeSubtitleElements));
  hideNativeSubtitles();
}

function findNativeSubtitleElementsMatchingActiveCues(options = {}) {
  return findNativeSubtitleElementsMatchingCueTexts(getActiveCueTexts(), options);
}

function hideNativeSubtitleElementsForSourceText(sourceText, options = {}) {
  if (!sourceText || !shouldHideNativeSubtitles()) return;
  const nativeElements = findNativeSubtitleElementsMatchingCueTexts([sourceText], options);
  if (nativeElements.length) {
    hideNativeSubtitleElementsNow(nativeElements);
  }
}

function findNativeSubtitleElementsMatchingCueTexts(cueTexts, options = {}) {
  if (!shouldHideNativeSubtitles() || !isNetflixWatchPage()) return [];
  const normalizedCueTexts = Array.from(new Set((cueTexts || [])
    .map(normalizeSubtitleText)
    .filter(isPlausibleSubtitle)));
  if (!normalizedCueTexts.length) return [];

  const cueKey = mergeSubtitleLines(normalizedCueTexts);
  const now = Date.now();
  if (!options.force && cueKey === state.nativeCueDomShieldText && now - state.nativeCueDomShieldAt < 140) {
    return [];
  }
  state.nativeCueDomShieldText = cueKey;
  state.nativeCueDomShieldAt = now;

  const playerRoot = findPlayerRoot();
  if (!playerRoot || !playerRoot.querySelectorAll) return [];

  const matches = [];
  const nodes = Array.from(playerRoot.querySelectorAll("span, div, p"));
  for (let index = nodes.length - 1, visited = 0; index >= 0 && visited < MAX_ACTIVE_CUE_DOM_SCAN_VISITS; index -= 1, visited += 1) {
    const element = nodes[index];
    if (!element || element.closest(`#${OVERLAY_ID}, #${NATIVE_MASK_ID}, #${NATIVE_PLAYER_MASK_ID}`)) continue;
    if (!isInsidePlayerRoot(element) || isNetflixUiElement(element)) continue;
    const elementText = normalizeSubtitleText(element.innerText || element.textContent);
    if (!elementText || elementText.length > MAX_SUBTITLE_LENGTH * 1.25) continue;
    if (!textMatchesActiveCue(elementText, normalizedCueTexts)) continue;
    if (!matchesKnownSubtitleLayerSelector(element) && !looksLikeVisualSubtitleElement(element)) continue;
    addNativeSubtitleCandidate(matches, element);
    if (matches.length >= 10) break;
  }

  return Array.from(new Set(matches)).filter((element) =>
    element &&
    element.isConnected &&
    isInsidePlayerRoot(element) &&
    !isNetflixUiElement(element)
  );
}

function textMatchesActiveCue(elementText, cueTexts) {
  const elementLoose = normalizeForCueTextMatch(elementText);
  const elementTight = normalizeForCueTextMatch(elementText, true);
  if (!elementLoose || !elementTight) return false;
  return cueTexts.some((cueText) => {
    const cueLoose = normalizeForCueTextMatch(cueText);
    const cueTight = normalizeForCueTextMatch(cueText, true);
    if (!cueLoose || !cueTight) return false;
    if (elementLoose === cueLoose || elementTight === cueTight) return true;
    if (cueTight.length >= 4 && elementTight.includes(cueTight)) return true;
    return elementTight.length >= 4 && cueTight.includes(elementTight);
  });
}

function normalizeForCueTextMatch(text, removeWhitespace = false) {
  const normalized = normalizeSubtitleText(text)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .toLowerCase();
  return removeWhitespace
    ? normalized.replace(/\s+/g, "")
    : normalized.replace(/\s+/g, " ");
}

function hideNativeSubtitleElementsNow(elements) {
  if (!elements || !elements.length || !shouldHideNativeSubtitles()) return;
  rememberNativeSubtitleElements([
    ...Array.from(state.nativeSubtitleElements).filter((element) => element && element.isConnected),
    ...elements
  ]);
  syncNativeMasksToSubtitleElements(Array.from(state.nativeSubtitleElements));
  hideNativeSubtitles();
  queueNativeHideReapply();
}

function queueNativeHideReapply() {
  if (!shouldHideNativeSubtitles() || !isNetflixWatchPage()) return;
  if (state.nativeHideReapplyTimers.length) return;
  clearNativeHideReapplyTimers();
  for (const delay of [80, 260, 620]) {
    let timer = 0;
    timer = window.setTimeout(() => {
      state.nativeHideReapplyTimers = state.nativeHideReapplyTimers.filter((entry) => entry !== timer);
      reapplyNativeSubtitleSuppression();
    }, delay);
    state.nativeHideReapplyTimers.push(timer);
  }
}

function queueNativeHideBurst() {
  if (!shouldHideNativeSubtitles() || !isNetflixWatchPage()) return;
  if (state.nativeHideBurstTimers.length) return;
  clearNativeHideBurstTimers();
  for (const delay of [0, 40, 120, 260, 520]) {
    let timer = 0;
    timer = window.setTimeout(() => {
      state.nativeHideBurstTimers = state.nativeHideBurstTimers.filter((entry) => entry !== timer);
      if (!shouldHideNativeSubtitles() || !isNetflixWatchPage()) return;
      suppressNativeVideoTextTracks();
      suppressNativeSubtitleFlash([], { includeVisualSubtitleCandidates: true });
    }, delay);
    state.nativeHideBurstTimers.push(timer);
  }
}

function clearNativeHideBurstTimers() {
  for (const timer of state.nativeHideBurstTimers) {
    window.clearTimeout(timer);
  }
  state.nativeHideBurstTimers = [];
}

function clearNativeHideReapplyTimers() {
  for (const timer of state.nativeHideReapplyTimers) {
    window.clearTimeout(timer);
  }
  state.nativeHideReapplyTimers = [];
}

function reapplyNativeSubtitleSuppression() {
  if (!shouldHideNativeSubtitles() || !isNetflixWatchPage()) return;
  pruneNativeSubtitleElements();
  syncNativeMaskHost();
  suppressNativeVideoTextTracks();
  if (isNativeFlashProtectionActive()) {
    suppressNativeSubtitleFlash([], { includeVisualSubtitleCandidates: true });
    return;
  }
  if (state.nativeSubtitleElements.size) {
    syncNativeMasksToSubtitleElements(Array.from(state.nativeSubtitleElements));
    hideNativeSubtitles();
  }
}

function syncNativeMasksToSubtitleElements(elements) {
  const bounds = getSubtitleTextBounds(elements);
  if (!bounds) return;

  const globalMask = document.getElementById(NATIVE_MASK_ID);
  if (globalMask) {
    setImportantStyleIfNeeded(globalMask, "position", "fixed");
    setImportantStyleIfNeeded(globalMask, "left", `${Math.round(bounds.centerX)}px`);
    setImportantStyleIfNeeded(globalMask, "bottom", `${Math.max(8, Math.round(window.innerHeight - bounds.bottom))}px`);
    setImportantStyleIfNeeded(globalMask, "width", `${Math.round(bounds.width)}px`);
    setImportantStyleIfNeeded(globalMask, "height", `${Math.round(bounds.height)}px`);
    setImportantStyleIfNeeded(globalMask, "transform", "translateX(-50%)");
  }

  const playerMask = document.getElementById(NATIVE_PLAYER_MASK_ID);
  const host = getNativeMaskHost();
  if (playerMask && host && host.getBoundingClientRect) {
    const hostRect = host.getBoundingClientRect();
    setImportantStyleIfNeeded(playerMask, "position", "absolute");
    setImportantStyleIfNeeded(playerMask, "left", `${Math.round(bounds.left - hostRect.left)}px`);
    setImportantStyleIfNeeded(playerMask, "bottom", `${Math.round(hostRect.bottom - bounds.bottom)}px`);
    setImportantStyleIfNeeded(playerMask, "width", `${Math.round(bounds.width)}px`);
    setImportantStyleIfNeeded(playerMask, "height", `${Math.round(bounds.height)}px`);
    setImportantStyleIfNeeded(playerMask, "transform", "none");
  }
}

function getSubtitleTextBounds(elements) {
  const rects = getSubtitleTextRects(elements);
  if (!rects.length) return null;

  let left = Math.min(...rects.map((rect) => rect.left));
  let right = Math.max(...rects.map((rect) => rect.right));
  let top = Math.min(...rects.map((rect) => rect.top));
  let bottom = Math.max(...rects.map((rect) => rect.bottom));

  const rawWidth = right - left;
  const rawHeight = bottom - top;
  const paddingX = Math.min(48, Math.max(18, rawWidth * 0.08));
  const paddingY = Math.min(18, Math.max(10, rawHeight * 0.25));

  left = Math.max(8, left - paddingX);
  right = Math.min(window.innerWidth - 8, right + paddingX);
  top = Math.max(window.innerHeight * 0.45, top - paddingY);
  bottom = Math.min(window.innerHeight - 8, bottom + paddingY);

  let width = Math.max(180, right - left);
  width = Math.min(width, window.innerWidth * 0.76);
  let height = Math.max(42, bottom - top);
  height = Math.min(height, 118);

  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;
  const normalizedLeft = Math.max(8, Math.min(window.innerWidth - width - 8, centerX - width / 2));
  const normalizedTop = Math.max(window.innerHeight * 0.45, Math.min(window.innerHeight - height - 8, centerY - height / 2));

  return {
    left: normalizedLeft,
    right: normalizedLeft + width,
    top: normalizedTop,
    bottom: normalizedTop + height,
    centerX: normalizedLeft + width / 2,
    width,
    height
  };
}

function getSubtitleTextRects(elements) {
  const rects = [];
  for (const element of elements || []) {
    if (!element || !element.isConnected || element.closest(`#${OVERLAY_ID}`)) continue;
    const childRects = getSubtitleLeafRects(element);
    if (childRects.length) {
      rects.push(...childRects);
      continue;
    }
    const rect = element.getBoundingClientRect();
    if (isUsableSubtitleRect(rect)) rects.push(rect);
  }
  return rects;
}

function getSubtitleLeafRects(element) {
  if (!element.querySelectorAll) return [];
  return Array.from(element.querySelectorAll("span, div, p"))
    .slice(0, 80)
    .filter((child) => {
      if (!child || child.closest(`#${OVERLAY_ID}`)) return false;
      const text = normalizeSubtitleText(child.innerText || child.textContent);
      return isPlausibleSubtitle(text);
    })
    .map((child) => child.getBoundingClientRect())
    .filter(isUsableSubtitleRect);
}

function isUsableSubtitleRect(rect) {
  if (!rect || rect.width < 8 || rect.height < 6) return false;
  if (rect.bottom <= 0 || rect.top >= window.innerHeight) return false;
  if (rect.right <= 0 || rect.left >= window.innerWidth) return false;
  if (rect.top < window.innerHeight * 0.45) return false;
  return true;
}

function syncOverlayToNativeSubtitle(elements) {
  if (!state.overlay || !elements.length) return;
  const rects = elements
    .map((element) => element.getBoundingClientRect())
    .filter((rect) => rect.width > 2 && rect.height > 2);
  if (!rects.length) return;

  const left = Math.min(...rects.map((rect) => rect.left));
  const right = Math.max(...rects.map((rect) => rect.right));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  const centerX = (left + right) / 2;
  const width = Math.max(right - left + 96, 360);

  state.overlay.style.left = `${Math.round(centerX)}px`;
  state.overlay.style.bottom = `${Math.max(24, Math.round(window.innerHeight - bottom))}px`;
  state.overlay.style.maxWidth = `${Math.min(Math.round(width), Math.round(window.innerWidth * 0.9))}px`;
}

function hideNativeSubtitles() {
  pruneNativeSubtitleElements();
  if (state.nativeSubtitleElements.size) {
    syncNativeMasksToSubtitleElements(Array.from(state.nativeSubtitleElements));
  }
  for (const element of state.nativeSubtitleElements) {
    if (!element || !element.isConnected) continue;
    if (!element.classList.contains("ndst-native-subtitle-hidden")) {
      element.classList.add("ndst-native-subtitle-hidden");
      state.nativeHiddenCount += 1;
    }
    if (!state.nativeSubtitleStyleCache.has(element)) {
      state.nativeSubtitleStyleCache.set(element, {
        opacity: element.style.getPropertyValue("opacity"),
        opacityPriority: element.style.getPropertyPriority("opacity"),
        visibility: element.style.getPropertyValue("visibility"),
        visibilityPriority: element.style.getPropertyPriority("visibility"),
        color: element.style.getPropertyValue("color"),
        colorPriority: element.style.getPropertyPriority("color"),
        webkitTextFillColor: element.style.getPropertyValue("-webkit-text-fill-color"),
        webkitTextFillColorPriority: element.style.getPropertyPriority("-webkit-text-fill-color"),
        webkitTextStrokeColor: element.style.getPropertyValue("-webkit-text-stroke-color"),
        webkitTextStrokeColorPriority: element.style.getPropertyPriority("-webkit-text-stroke-color"),
        textShadow: element.style.getPropertyValue("text-shadow"),
        textShadowPriority: element.style.getPropertyPriority("text-shadow"),
        background: element.style.getPropertyValue("background"),
        backgroundPriority: element.style.getPropertyPriority("background"),
        backgroundColor: element.style.getPropertyValue("background-color"),
        backgroundColorPriority: element.style.getPropertyPriority("background-color"),
        backgroundImage: element.style.getPropertyValue("background-image"),
        backgroundImagePriority: element.style.getPropertyPriority("background-image"),
        borderColor: element.style.getPropertyValue("border-color"),
        borderColorPriority: element.style.getPropertyPriority("border-color"),
        boxShadow: element.style.getPropertyValue("box-shadow"),
        boxShadowPriority: element.style.getPropertyPriority("box-shadow"),
        filter: element.style.getPropertyValue("filter"),
        filterPriority: element.style.getPropertyPriority("filter"),
        clipPath: element.style.getPropertyValue("clip-path"),
        clipPathPriority: element.style.getPropertyPriority("clip-path"),
        webkitClipPath: element.style.getPropertyValue("-webkit-clip-path"),
        webkitClipPathPriority: element.style.getPropertyPriority("-webkit-clip-path"),
        overflow: element.style.getPropertyValue("overflow"),
        overflowPriority: element.style.getPropertyPriority("overflow")
      });
    }
    setImportantStyleIfNeeded(element, "opacity", "0");
    setImportantStyleIfNeeded(element, "visibility", "hidden");
    setImportantStyleIfNeeded(element, "color", "transparent");
    setImportantStyleIfNeeded(element, "-webkit-text-fill-color", "transparent");
    setImportantStyleIfNeeded(element, "-webkit-text-stroke-color", "transparent");
    setImportantStyleIfNeeded(element, "text-shadow", "none");
    setImportantStyleIfNeeded(element, "background", "transparent");
    setImportantStyleIfNeeded(element, "background-color", "transparent");
    setImportantStyleIfNeeded(element, "background-image", "none");
    setImportantStyleIfNeeded(element, "border-color", "transparent");
    setImportantStyleIfNeeded(element, "box-shadow", "none");
    setImportantStyleIfNeeded(element, "filter", "opacity(0)");
    setImportantStyleIfNeeded(element, "clip-path", "inset(50%)");
    setImportantStyleIfNeeded(element, "-webkit-clip-path", "inset(50%)");
    setImportantStyleIfNeeded(element, "overflow", "hidden");
    recordNativeHiddenCandidate(element);
  }
}

function pruneNativeSubtitleElements() {
  if (!state.nativeSubtitleElements.size) return;
  const kept = [];
  for (const element of state.nativeSubtitleElements) {
    if (!element || !element.isConnected || element.closest(`#${OVERLAY_ID}`)) continue;
    if (!isInsidePlayerRoot(element)) continue;
    kept.push(element);
    if (kept.length >= MAX_NATIVE_SUBTITLE_ELEMENTS) break;
  }
  state.nativeSubtitleElements = new Set(kept);
}

function recordNativeHiddenCandidate(element) {
  if (!document.documentElement) return;
  const dataset = document.documentElement.dataset;
  dataset.ndstContentNativeHiddenCount = String(state.nativeHiddenCount);
  dataset.ndstContentNativeLastHiddenAt = String(Date.now());
  dataset.ndstContentNativeLastHiddenText = normalizeSubtitleText(element.innerText || element.textContent).slice(0, 80);
  dataset.ndstContentNativeLastHiddenClass = String(element.className || "").slice(0, 120);
  dataset.ndstContentNativeLastHiddenUia = element.getAttribute("data-uia") || "";
}

function setImportantStyleIfNeeded(element, property, value) {
  if (
    element.style.getPropertyValue(property) === value &&
    element.style.getPropertyPriority(property) === "important"
  ) {
    return;
  }
  element.style.setProperty(property, value, "important");
}

function restoreNativeSubtitles(clear = true) {
  for (const element of state.nativeSubtitleElements) {
    const cached = state.nativeSubtitleStyleCache.get(element);
    if (!element) continue;
    element.classList.remove("ndst-native-subtitle-hidden");
    if (!cached) continue;
    restoreStyleProperty(element, "opacity", cached.opacity, cached.opacityPriority);
    restoreStyleProperty(element, "visibility", cached.visibility, cached.visibilityPriority);
    restoreStyleProperty(element, "color", cached.color, cached.colorPriority);
    restoreStyleProperty(element, "-webkit-text-fill-color", cached.webkitTextFillColor, cached.webkitTextFillColorPriority);
    restoreStyleProperty(element, "-webkit-text-stroke-color", cached.webkitTextStrokeColor, cached.webkitTextStrokeColorPriority);
    restoreStyleProperty(element, "text-shadow", cached.textShadow, cached.textShadowPriority);
    restoreStyleProperty(element, "background", cached.background, cached.backgroundPriority);
    restoreStyleProperty(element, "background-color", cached.backgroundColor, cached.backgroundColorPriority);
    restoreStyleProperty(element, "background-image", cached.backgroundImage, cached.backgroundImagePriority);
    restoreStyleProperty(element, "border-color", cached.borderColor, cached.borderColorPriority);
    restoreStyleProperty(element, "box-shadow", cached.boxShadow, cached.boxShadowPriority);
    restoreStyleProperty(element, "filter", cached.filter, cached.filterPriority);
    restoreStyleProperty(element, "clip-path", cached.clipPath, cached.clipPathPriority);
    restoreStyleProperty(element, "-webkit-clip-path", cached.webkitClipPath, cached.webkitClipPathPriority);
    restoreStyleProperty(element, "overflow", cached.overflow, cached.overflowPriority);
  }
  if (clear) state.nativeSubtitleElements.clear();
}

function restoreStyleProperty(element, property, value, priority) {
  if (value) {
    element.style.setProperty(property, value, priority || "");
  } else {
    element.style.removeProperty(property);
  }
}

async function loadPretranslatedCues() {
  if (!state.settings) return [];
  const videoKey = getCurrentVideoKey();
  if (!videoKey) return [];
  try {
    const response = await chrome.runtime.sendMessage({
      type: "LOAD_PRETRANSLATED_CUES",
      query: {
        videoKey,
        targetLanguage: state.settings.targetLanguage || "zh-CN",
        model: state.settings.model || "deepseek-v4-flash"
      }
    });
    if (!response || !response.ok || !response.set) {
      state.pretranslatedSet = null;
      return [];
    }
    state.pretranslatedSet = response.set;
    return response.cues || [];
  } catch (error) {
    if (quiesceInvalidatedExtensionContext(error)) return [];
    console.error("[Netflix DeepSeek Translator] load pretranslated cues failed", error);
    state.pretranslatedSet = null;
    return [];
  }
}

function getCueByCurrentTime(currentTime) {
  if (!Number.isFinite(currentTime)) return null;
  const offsetSeconds = Number((state.settings && state.settings.subtitleOffsetMs) || 0) / 1000;
  const adjustedTime = currentTime + offsetSeconds;
  let low = 0;
  let high = state.pretranslatedCues.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const cue = state.pretranslatedCues[middle];
    if (adjustedTime < cue.start) {
      high = middle - 1;
    } else if (adjustedTime > cue.end) {
      low = middle + 1;
    } else {
      return cue;
    }
  }
  return null;
}

function renderPretranslatedSubtitle(cue) {
  if (!cue) {
    if (!state.pretranslatedCues.length) {
      updateOverlay("没有匹配的本地预翻译字幕，请导入 SRT/VTT 或切回实时模式", "", "hint");
      return;
    }
    state.lastPretranslatedCueId = "";
    scheduleClear();
    return;
  }
  const cueId = String(cue.cueId || cue.id || `${cue.start}-${cue.end}`);
  if (cueId === state.lastPretranslatedCueId) return;
  state.lastPretranslatedCueId = cueId;
  state.requestSequence += 1;
  cancelScheduledClear();
  state.lastSubtitleAt = Date.now();
  state.lastSourceText = cue.sourceText || cue.text || "";
  state.lastTranslation = cue.translation || cue.text || "";
  state.lastTranslationSourceText = state.lastSourceText;
  updateOverlay(state.lastSourceText, state.lastTranslation, "ready");
}

function getCurrentVideoTime() {
  const video = document.querySelector("video");
  return video ? video.currentTime : NaN;
}

function getCurrentVideoKey() {
  const match = location.pathname.match(/\/watch\/(\d+)/);
  return match ? `netflix-${match[1]}` : "";
}

function bindNativeTextTrackGuards() {
  if (!shouldHideNativeSubtitles() || !isNetflixWatchPage()) return;
  const videos = Array.from(document.querySelectorAll("video"));
  for (const video of videos) {
    addNativeGuardListener(video, "loadedmetadata", handleNativeSubtitleTrackActivity);
    addNativeGuardListener(video, "loadeddata", handleNativeSubtitleTrackActivity);
    addNativeGuardListener(video, "play", handleNativeSubtitleTrackActivity);
    addNativeGuardListener(video, "seeking", handleNativeSubtitleTrackActivity);
    addNativeGuardListener(video, "seeked", handleNativeSubtitleTrackActivity);
    const textTracks = video.textTracks;
    if (textTracks && textTracks.addEventListener) {
      addNativeGuardListener(textTracks, "change", handleNativeSubtitleTrackActivity);
      addNativeGuardListener(textTracks, "addtrack", handleNativeSubtitleTrackActivity);
      addNativeGuardListener(textTracks, "removetrack", handleNativeSubtitleTrackActivity);
    }
  }
  for (const track of getVideoTextTracks()) {
    if (!isSubtitleTextTrack(track) || !track.addEventListener) continue;
    addNativeGuardListener(track, "cuechange", handleNativeSubtitleTrackActivity);
  }
}

function addNativeGuardListener(target, type, listener) {
  if (!target || !target.addEventListener) return;
  const exists = state.nativeTrackEventListeners.some((entry) =>
    entry.target === target && entry.type === type && entry.listener === listener
  );
  if (exists) return;
  target.addEventListener(type, listener);
  state.nativeTrackEventListeners.push({ target, type, listener });
}

function removeNativeTextTrackGuards() {
  for (const entry of state.nativeTrackEventListeners) {
    try {
      entry.target.removeEventListener(entry.type, entry.listener);
    } catch (error) {
      // Ignore detached media objects.
    }
  }
  state.nativeTrackEventListeners = [];
}

function handleNativeSubtitleTrackActivity() {
  if (!shouldHideNativeSubtitles() || !isNetflixWatchPage()) return;
  document.documentElement.dataset.ndstHideNativeSubtitles = "true";
  notifyMainTextTrackGuard();
  armNativeFlashProtection(900);
  suppressNativeVideoTextTracks();
  const activeCueElements = findNativeSubtitleElementsMatchingActiveCues({ force: true });
  if (activeCueElements.length) {
    hideNativeSubtitleElementsNow(activeCueElements);
  }
  startNativeSuppressionFrameGuard(1);
  queueNativeHideReapply();
  scheduleImmediateCachedRender(0);
  scheduleScan(100);
}

function suppressNativeVideoTextTracks() {
  for (const track of getVideoTextTracks()) {
    if (!isSubtitleTextTrack(track)) continue;
    try {
      if (String(track.mode || "").toLowerCase() !== "showing") continue;
      if (!state.nativeTextTrackModeCache.has(track)) {
        state.nativeTextTrackModeCache.set(track, track.mode);
      }
      // Hidden tracks still update activeCues, but the browser does not render their native cue boxes.
      track.mode = "hidden";
    } catch (error) {
      // Ignore tracks that disappear or reject mode changes during player updates.
    }
  }
}

function restoreNativeVideoTextTracksIfAllowed() {
  if (isNetflixWatchPage() && shouldHideNativeSubtitles()) {
    suppressNativeVideoTextTracks();
    notifyMainTextTrackGuard();
    return;
  }
  restoreNativeVideoTextTracks();
}

function restoreNativeVideoTextTracks() {
  for (const track of getVideoTextTracks()) {
    if (!state.nativeTextTrackModeCache.has(track)) continue;
    const previousMode = state.nativeTextTrackModeCache.get(track);
    try {
      track.mode = previousMode || "showing";
    } catch (error) {
      // Ignore tracks that disappeared or reject mode changes.
    }
  }
  state.nativeTextTrackModeCache = new WeakMap();
}

function getVideoTextTracks() {
  const tracks = [];
  for (const video of Array.from(document.querySelectorAll("video"))) {
    if (!video || !video.textTracks) continue;
    tracks.push(...Array.from(video.textTracks));
  }
  return tracks;
}

function isSubtitleTextTrack(track) {
  if (!track) return false;
  const kind = String(track.kind || "").toLowerCase();
  return kind === "subtitles" || kind === "captions" || kind === "descriptions" || !kind;
}

})();
