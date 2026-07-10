"use strict";

(() => {
const BUILD_ID = "2026-07-10-cue-clear-61";
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
    textTrackGuardAddTrack: dataset.ndstTextTrackGuardAddTrack || "",
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
  window.cÛ¼ÒÚ$z{-®éÜj×ÆU7V'F—FÆU&V7B‡&V7B’°¢–b‚&V7BÇÂ&V7Bçv–GF‚Â‚ÇÂ&V7Bæ†V–v‡BÂb’&WGW&âfÇ6S°¢–b‡&V7Bæ&÷GFöÒÃÒÇÂ&V7BçF÷ãÒv–æF÷ræ–ææW$†V–v‡B’&WGW&âfÇ6S°¢–b‡&V7Bç&–v‡BÃÒÇÂ&V7BæÆVgBãÒv–æF÷ræ–ææW%v–GF‚’&WGW&âfÇ6S°¢–b‡&V7BçF÷Âv–æF÷ræ–ææW$†V–v‡B¢ãCR’&WGW&âfÇ6S°¢&WGW&âG'VS°§Ğ Ğ¦gVæ7F–öâ7–æ4÷fW&Æ•FôæF—fU7V'F—FÆR†VÆVÖVçG2’°Ğ¢–b‚7FFRæ÷fW&Æ’ÇÂVÆVÖVçG2æÆVæwF‚’&WGW&ã°Ğ¢6öç7B&V7G2ÒVÆVÖVçG0Ğ¢æÖ‚†VÆVÖVçB’ÓâVÆVÖVçBævWD&÷VæF–æt6Æ–VçE&V7B‚’Ğ¢æf–ÇFW"‚‡&V7B’Óâ&V7Bçv–GF‚â"bb&V7Bæ†V–v‡Bâ"“°Ğ¢–b‚&V7G2æÆVæwF‚’&WGW&ã°Ğ Ğ¢6öç7BÆVgBÒÖF‚æÖ–â‚ââç&V7G2æÖ‚‡&V7B’Óâ&V7BæÆVgB’“°Ğ¢6öç7B&–v‡BÒÖF‚æÖ‚‚ââç&V7G2æÖ‚‡&V7B’Óâ&V7Bç&–v‡B’“°Ğ¢6öç7B&÷GFöÒÒÖF‚æÖ‚‚ââç&V7G2æÖ‚‡&V7B’Óâ&V7Bæ&÷GFöÒ’“°Ğ¢6öç7B6VçFW%‚Ò†ÆVgB²&–v‡B’ò#°Ğ¢6öç7Bv–GF‚ÒÖF‚æÖ‚‡&–v‡BÒÆVgB²“bÂ3c“°Ğ Ğ¢7FFRæ÷fW&Æ’ç7G–ÆRæÆVgBÒG´ÖF‚ç&÷VæB†6VçFW%‚—×†°Ğ¢7FFRæ÷fW&Æ’ç7G–ÆRæ&÷GFöÒÒG´ÖF‚æÖ‚ƒ#BÂÖF‚ç&÷VæB‡v–æF÷ræ–ææW$†V–v‡BÒ&÷GFöÒ’—×†°Ğ¢7FFRæ÷fW&Æ’ç7G–ÆRæÖ…v–GF‚ÒG´ÖF‚æÖ–â„ÖF‚ç&÷VæB‡v–GF‚’ÂÖF‚ç&÷VæB‡v–æF÷ræ–ææW%v–GF‚¢ã’’—×†°Ğ§ĞĞ Ğ¦gVæ7F–öâ†–FTæF—fU7V'F—FÆW2‚’°¢'VæTæF—fU7V'F—FÆTVÆVÖVçG2‚“°¢–b‡7FFRææF—fU7V'F—FÆTVÆVÖVçG2ç6—¦R’°¢7–æ4æF—fTÖ6·5Fõ7V'F—FÆTVÆVÖVçG2„'&’æg&öÒ‡7FFRææF—fU7V'F—FÆTVÆVÖVçG2’“°¢Ğ¢f÷"†6öç7BVÆVÖVçBöb7FFRææF—fU7V'F—FÆTVÆVÖVçG2’°¢–b‚VÆVÖVçBÇÂVÆVÖVçBæ—46öææV7FVB’6öçF–çVS°Ğ¢–b‚VÆVÖVçBæ6Æ74Æ—7Bæ6öçF–ç2‚&æG7BÖæF—fR×7V'F—FÆRÖ†–FFVâ"’’°Ğ¢VÆVÖVçBæ6Æ74Æ—7BæFB‚&æG7BÖæF—fR×7V'F—FÆRÖ†–FFVâ"“°Ğ¢7FFRææF—fT†–FFVä6÷VçB³Ò°Ğ¢ĞĞ¢–b‚7FFRææF—fU7V'F—FÆU7G–ÆT66†Ræ†2†VÆVÖVçB’’°Ğ¢7FFRææF—fU7V'F—FÆU7G–ÆT66†Rç6WB†VÆVÖVçBÂ°Ğ¢÷6—G“¢VÆVÖVçBç7G–ÆRævWE&÷W'G•fÇVR‚&÷6—G’"’ÀĞ¢÷6—G•&–÷&—G“¢VÆVÖVçBç7G–ÆRævWE&÷W'G•&–÷&—G’‚&÷6—G’"’ÀĞ¢f—6–&–Æ—G“¢VÆVÖVçBç7G–ÆRævWE&÷W'G•fÇVR‚'f—6–&–Æ—G’"’ÀĞ¢f—6–&–Æ—G•&–÷&—G“¢VÆVÖVçBç7G–ÆRævWE&÷W'G•&–÷&—G’‚'f—6–&–Æ—G’"’ÀĞ¢6öÆ÷#¢VÆVÖVçBç7G–ÆRævWE&÷W'G•fÇVR‚&6öÆ÷""’ÀĞ¢6öÆ÷%&–÷&—G“¢VÆVÖVçBç7G–ÆRævWE&÷W'G•&–÷&—G’‚&6öÆ÷""’ÀĞ¢vV&¶—EFW‡Df–ÆÄ6öÆ÷#¢VÆVÖVçBç7G–ÆRævWE&÷W'G•fÇVR‚"×vV&¶—B×FW‡BÖf–ÆÂÖ6öÆ÷""’ÀĞ¢vV&¶—EFW‡Df–ÆÄ6öÆ÷%&–÷&—G“¢VÆVÖVçBç7G–ÆRævWE&÷W'G•&–÷&—G’‚"×vV&¶—B×FW‡BÖf–ÆÂÖ6öÆ÷""’ÀĞ¢vV&¶—EFW‡E7G&ö¶T6öÆ÷#¢VÆVÖVçBç7G–ÆRævWE&÷W'G•fÇVR‚"×vV&¶—B×FW‡B×7G&ö¶RÖ6öÆ÷""’ÀĞ¢vV&¶—EFW‡E7G&ö¶T6öÆ÷%&–÷&—G“¢VÆVÖVçBç7G–ÆRævWE&÷W'G•&–÷&—G’‚"×vV&¶—B×FW‡B×7G&ö¶RÖ6öÆ÷""’ÀĞ¢FW‡E6†F÷s¢VÆVÖVçBç7G–ÆRævWE&÷W'G•fÇVR‚'FW‡B×6†F÷r"’ÀĞ¢FW‡E6†F÷u&–÷&—G“¢VÆVÖVçBç7G–ÆRævWE&÷W'G•&–÷&—G’‚'FW‡B×6†F÷r"’ÀĞ¢&6¶w&÷VæC¢VÆVÖVçBç7G–ÆRævWE&÷W'G•fÇVR‚&&6¶w&÷VæB"’À¢&6¶w&÷VæE&–÷&—G“¢VÆVÖVçBç7G–ÆRævWE&÷W'G•&–÷&—G’‚&&6¶w&÷VæB"’À¢&6¶w&÷VæD6öÆ÷#¢VÆVÖVçBç7G–ÆRævWE&÷W'G•fÇVR‚&&6¶w&÷VæBÖ6öÆ÷""’À¢&6¶w&÷VæD6öÆ÷%&–÷&—G“¢VÆVÖVçBç7G–ÆRævWE&÷W'G•&–÷&—G’‚&&6¶w&÷VæBÖ6öÆ÷""’À¢&6¶w&÷VæD–ÖvS¢VÆVÖVçBç7G–ÆRævWE&÷W'G•fÇVR‚&&6¶w&÷VæBÖ–ÖvR"’À¢&6¶w&÷VæD–ÖvU&–÷&—G“¢VÆVÖVçBç7G–ÆRævWE&÷W'G•&–÷&—G’‚&&6¶w&÷VæBÖ–ÖvR"’À¢&÷&FW$6öÆ÷#¢VÆVÖVçBç7G–ÆRævWE&÷W'G•fÇVR‚&&÷&FW"Ö6öÆ÷""’À¢&÷&FW$6öÆ÷%&–÷&—G“¢VÆVÖVçBç7G–ÆRævWE&÷W'G•&–÷&—G’‚&&÷&FW"Ö6öÆ÷""’ÀĞ¢&÷…6†F÷s¢VÆVÖVçBç7G–ÆRævWE&÷W'G•fÇVR‚&&÷‚×6†F÷r"’À¢&÷…6†F÷u&–÷&—G“¢VÆVÖVçBç7G–ÆRævWE&÷W'G•&–÷&—G’‚&&÷‚×6†F÷r"’À¢f–ÇFW#¢VÆVÖVçBç7G–ÆRævWE&÷W'G•fÇVR‚&f–ÇFW""’À¢f–ÇFW%&–÷&—G“¢VÆVÖVçBç7G–ÆRævWE&÷W'G•&–÷&—G’‚&f–ÇFW""’À¢6Æ—Fƒ¢VÆVÖVçBç7G–ÆRævWE&÷W'G•fÇVR‚&6Æ—×F‚"’À¢6Æ—F…&–÷&—G“¢VÆVÖVçBç7G–ÆRævWE&÷W'G•&–÷&—G’‚&6Æ—×F‚"’À¢vV&¶—D6Æ—Fƒ¢VÆVÖVçBç7G–ÆRævWE&÷W'G•fÇVR‚"×vV&¶—BÖ6Æ—×F‚"’À¢vV&¶—D6Æ—F…&–÷&—G“¢VÆVÖVçBç7G–ÆRævWE&÷W'G•&–÷&—G’‚"×vV&¶—BÖ6Æ—×F‚"’À¢÷fW&fÆ÷s¢VÆVÖVçBç7G–ÆRævWE&÷W'G•fÇVR‚&÷fW&fÆ÷r"’À¢÷fW&fÆ÷u&–÷&—G“¢VÆVÖVçBç7G–ÆRævWE&÷W'G•&–÷&—G’‚&÷fW&fÆ÷r"¢Ò“°¢Ğ¢6WD–×÷'FçE7G–ÆT–dæVVFVB†VÆVÖVçBÂ&÷6—G’"Â#"“°Ğ¢6WD–×÷'FçE7G–ÆT–dæVVFVB†VÆVÖVçBÂ'f—6–&–Æ—G’"Â&†–FFVâ"“°Ğ¢6WD–×÷'FçE7G–ÆT–dæVVFVB†VÆVÖVçBÂ&6öÆ÷""Â'G&ç7&VçB"“°Ğ¢6WD–×÷'FçE7G–ÆT–dæVVFVB†VÆVÖVçBÂ"×vV&¶—B×FW‡BÖf–ÆÂÖ6öÆ÷""Â'G&ç7&VçB"“°Ğ¢6WD–×÷'FçE7G–ÆT–dæVVFVB†VÆVÖVçBÂ"×vV&¶—B×FW‡B×7G&ö¶RÖ6öÆ÷""Â'G&ç7&VçB"“°Ğ¢6WD–×÷'FçE7G–ÆT–dæVVFVB†VÆVÖVçBÂ'FW‡B×6†F÷r"Â&æöæR"“°¢6WD–×÷'FçE7G–ÆT–dæVVFVB†VÆVÖVçBÂ&&6¶w&÷VæB"Â'G&ç7&VçB"“°¢6WD–×÷'FçE7G–ÆT–dæVVFVB†VÆVÖVçBÂ&&6¶w&÷VæBÖ6öÆ÷""Â'G&ç7&VçB"“°¢6WD–×÷'FçE7G–ÆT–dæVVFVB†VÆVÖVçBÂ&&6¶w&÷VæBÖ–ÖvR"Â&æöæR"“°¢6WD–×÷'FçE7G–ÆT–dæVVFVB†VÆVÖVçBÂ&&÷&FW"Ö6öÆ÷""Â'G&ç7&VçB"“°¢6WD–×÷'FçE7G–ÆT–dæVVFVB†VÆVÖVçBÂ&&÷‚×6†F÷r"Â&æöæR"“°¢6WD–×÷'FçE7G–ÆT–dæVVFVB†VÆVÖVçBÂ&f–ÇFW""Â&÷6—G’ƒ’"“°¢6WD–×÷'FçE7G–ÆT–dæVVFVB†VÆVÖVçBÂ&6Æ—×F‚"Â&–ç6WBƒSR’"“°¢6WD–×÷'FçE7G–ÆT–dæVVFVB†VÆVÖVçBÂ"×vV&¶—BÖ6Æ—×F‚"Â&–ç6WBƒSR’"“°¢6WD–×÷'FçE7G–ÆT–dæVVFVB†VÆVÖVçBÂ&÷fW&fÆ÷r"Â&†–FFVâ"“°¢&V6÷&DæF—fT†–FFVä6æF–FFR†VÆVÖVçB“°¢Ğ§Ğ ¦gVæ7F–öâ'VæTæF—fU7V'F—FÆTVÆVÖVçG2‚’°¢–b‚7FFRææF—fU7V'F—FÆTVÆVÖVçG2ç6—¦R’&WGW&ã°¢6öç7B¶WBÒµÓ°¢f÷"†6öç7BVÆVÖVçBöb7FFRææF—fU7V'F—FÆTVÆVÖVçG2’°¢–b‚VÆVÖVçBÇÂVÆVÖVçBæ—46öææV7FVBÇÂVÆVÖVçBæ6Æ÷6W7B†2G´õdU$Ä•ô”GÖ’’6öçF–çVS°¢–b‚—4–ç6–FUÆ–W%&ö÷B†VÆVÖVçB’’6öçF–çVS°¢¶WBçW6‚†VÆVÖVçB“°¢–b†¶WBæÆVæwF‚ãÒÔ…ôäD•dUõ5T%D•DÄUôTÄTÔTåE2’'&V³°¢Ğ¢7FFRææF—fU7V'F—FÆTVÆVÖVçG2ÒæWr6WB†¶WB“°§Ğ Ğ¦gVæ7F–öâ&V6÷&DæF—fT†–FFVä6æF–FFR†VÆVÖVçB’°Ğ¢–b‚Fö7VÖVçBæFö7VÖVçDVÆVÖVçB’&WGW&ã°Ğ¢6öç7BFF6WBÒFö7VÖVçBæFö7VÖVçDVÆVÖVçBæFF6WC°Ğ¢FF6WBææG7D6öçFVçDæF—fT†–FFVä6÷VçBÒ7G&–ær‡7FFRææF—fT†–FFVä6÷VçB“°Ğ¢FF6WBææG7D6öçFVçDæF—fTÆ7D†–FFVäBÒ7G&–ær„FFRææ÷r‚’“°Ğ¢FF6WBææG7D6öçFVçDæF—fTÆ7D†–FFVåFW‡BÒæ÷&ÖÆ—¦U7V'F—FÆUFW‡B†VÆVÖVçBæ–ææW%FW‡BÇÂVÆVÖVçBçFW‡D6öçFVçB’ç6Æ–6RƒÂƒ“°Ğ¢FF6WBææG7D6öçFVçDæF—fTÆ7D†–FFVä6Æ72Ò7G&–ær†VÆVÖVçBæ6Æ74æÖRÇÂ""’ç6Æ–6RƒÂ#“°Ğ¢FF6WBææG7D6öçFVçDæF—fTÆ7D†–FFVåV–ÒVÆVÖVçBævWDGG&–'WFR‚&FF×V–"’ÇÂ"#°Ğ§ĞĞ Ğ¦gVæ7F–öâ6WD–×÷'FçE7G–ÆT–dæVVFVB†VÆVÖVçBÂ&÷W'G’ÂfÇVR’°Ğ¢–b€Ğ¢VÆVÖVçBç7G–ÆRævWE&÷W'G•fÇVR‡&÷W'G’’ÓÓÒfÇVRb`Ğ¢VÆVÖVçBç7G–ÆRævWE&÷W'G•&–÷&—G’‡&÷W'G’’ÓÓÒ&–×÷'FçB Ğ¢’°Ğ¢&WGW&ã°Ğ¢ĞĞ¢VÆVÖVçBç7G–ÆRç6WE&÷W'G’‡&÷W'G’ÂfÇVRÂ&–×÷'FçB"“°Ğ§ĞĞ Ğ¦gVæ7F–öâ&W7F÷&TæF—fU7V'F—FÆW2†6ÆV"ÒG'VR’°Ğ¢f÷"†6öç7BVÆVÖVçBöb7FFRææF—fU7V'F—FÆTVÆVÖVçG2’°Ğ¢6öç7B66†VBÒ7FFRææF—fU7V'F—FÆU7G–ÆT66†RævWB†VÆVÖVçB“°Ğ¢–b‚VÆVÖVçB’6öçF–çVS°Ğ¢VÆVÖVçBæ6Æ74Æ—7Bç&VÖ÷fR‚&æG7BÖæF—fR×7V'F—FÆRÖ†–FFVâ"“°Ğ¢–b‚66†VB’6öçF–çVS°Ğ¢&W7F÷&U7G–ÆU&÷W'G’†VÆVÖVçBÂ&÷6—G’"Â66†VBæ÷6—G’Â66†VBæ÷6—G•&–÷&—G’“°Ğ¢&W7F÷&U7G–ÆU&÷W'G’†VÆVÖVçBÂ'f—6–&–Æ—G’"Â66†VBçf—6–&–Æ—G’Â66†VBçf—6–&–Æ—G•&–÷&—G’“°Ğ¢&W7F÷&U7G–ÆU&÷W'G’†VÆVÖVçBÂ&6öÆ÷""Â66†VBæ6öÆ÷"Â66†VBæ6öÆ÷%&–÷&—G’“°Ğ¢&W7F÷&U7G–ÆU&÷W'G’†VÆVÖVçBÂ"×vV&¶—B×FW‡BÖf–ÆÂÖ6öÆ÷""Â66†VBçvV&¶—EFW‡Df–ÆÄ6öÆ÷"Â66†VBçvV&¶—EFW‡Df–ÆÄ6öÆ÷%&–÷&—G’“°Ğ¢&W7F÷&U7G–ÆU&÷W'G’†VÆVÖVçBÂ"×vV&¶—B×FW‡B×7G&ö¶RÖ6öÆ÷""Â66†VBçvV&¶—EFW‡E7G&ö¶T6öÆ÷"Â66†VBçvV&¶—EFW‡E7G&ö¶T6öÆ÷%&–÷&—G’“°Ğ¢&W7F÷&U7G–ÆU&÷W'G’†VÆVÖVçBÂ'FW‡B×6†F÷r"Â66†VBçFW‡E6†F÷rÂ66†VBçFW‡E6†F÷u&–÷&—G’“°¢&W7F÷&U7G–ÆU&÷W'G’†VÆVÖVçBÂ&&6¶w&÷VæB"Â66†VBæ&6¶w&÷VæBÂ66†VBæ&6¶w&÷VæE&–÷&—G’“°¢&W7F÷&U7G–ÆU&÷W'G’†VÆVÖVçBÂ&&6¶w&÷VæBÖ6öÆ÷""Â66†VBæ&6¶w&÷VæD6öÆ÷"Â66†VBæ&6¶w&÷VæD6öÆ÷%&–÷&—G’“°¢&W7F÷&U7G–ÆU&÷W'G’†VÆVÖVçBÂ&&6¶w&÷VæBÖ–ÖvR"Â66†VBæ&6¶w&÷VæD–ÖvRÂ66†VBæ&6¶w&÷VæD–ÖvU&–÷&—G’“°¢&W7F÷&U7G–ÆU&÷W'G’†VÆVÖVçBÂ&&÷&FW"Ö6öÆ÷""Â66†VBæ&÷&FW$6öÆ÷"Â66†VBæ&÷&FW$6öÆ÷%&–÷&—G’“°¢&W7F÷&U7G–ÆU&÷W'G’†VÆVÖVçBÂ&&÷‚×6†F÷r"Â66†VBæ&÷…6†F÷rÂ66†VBæ&÷…6†F÷u&–÷&—G’“°¢&W7F÷&U7G–ÆU&÷W'G’†VÆVÖVçBÂ&f–ÇFW""Â66†VBæf–ÇFW"Â66†VBæf–ÇFW%&–÷&—G’“°¢&W7F÷&U7G–ÆU&÷W'G’†VÆVÖVçBÂ&6Æ—×F‚"Â66†VBæ6Æ—F‚Â66†VBæ6Æ—F…&–÷&—G’“°¢&W7F÷&U7G–ÆU&÷W'G’†VÆVÖVçBÂ"×vV&¶—BÖ6Æ—×F‚"Â66†VBçvV&¶—D6Æ—F‚Â66†VBçvV&¶—D6Æ—F…&–÷&—G’“°¢&W7F÷&U7G–ÆU&÷W'G’†VÆVÖVçBÂ&÷fW&fÆ÷r"Â66†VBæ÷fW&fÆ÷rÂ66†VBæ÷fW&fÆ÷u&–÷&—G’“°¢Ğ¢–b†6ÆV"’7FFRææF—fU7V'F—FÆTVÆVÖVçG2æ6ÆV"‚“°Ğ§ĞĞ Ğ¦gVæ7F–öâ&W7F÷&U7G–ÆU&÷W'G’†VÆVÖVçBÂ&÷W'G’ÂfÇVRÂ&–÷&—G’’°Ğ¢–b‡fÇVR’°Ğ¢VÆVÖVçBç7G–ÆRç6WE&÷W'G’‡&÷W'G’ÂfÇVRÂ&–÷&—G’ÇÂ""“°Ğ¢ÒVÇ6R°Ğ¢VÆVÖVçBç7G–ÆRç&VÖ÷fU&÷W'G’‡&÷W'G’“°Ğ¢ĞĞ§ĞĞ Ğ¦7–æ2gVæ7F–öâÆöE&WG&ç6ÆFVD7VW2‚’°Ğ¢–b‚7FFRç6WGF–æw2’&WGW&âµÓ°Ğ¢6öç7Bf–FVô¶W’ÒvWD7W'&VçEf–FVô¶W’‚“°Ğ¢–b‚f–FVô¶W’’&WGW&âµÓ°Ğ¢G'’°Ğ¢6öç7B&W7öç6RÒv—B6‡&öÖRç'VçF–ÖRç6VæDÖW76vR‡°Ğ¢G—S¢$ÄôEõ$UE$å4ÄDTEô5TU2"ÀĞ¢VW'“¢°Ğ¢f–FVô¶W’ÀĞ¢F&vWDÆæwVvS¢7FFRç6WGF–æw2çF&vWDÆæwVvRÇÂ'¦‚Ô4â"ÀĞ¢ÖöFVÃ¢7FFRç6WGF–æw2æÖöFVÂÇÂ&FVW6VV²×cBÖfÆ6‚ Ğ¢ĞĞ¢Ò“°Ğ¢–b‚&W7öç6RÇÂ&W7öç6Ræö²ÇÂ&W7öç6Rç6WB’°Ğ¢7FFRç&WG&ç6ÆFVE6WBÒçVÆÃ°Ğ¢&WGW&âµÓ°Ğ¢ĞĞ¢7FFRç&WG&ç6ÆFVE6WBÒ&W7öç6Rç6WC°Ğ¢&WGW&â&W7öç6Ræ7VW2ÇÂµÓ°Ğ¢Ò6F6‚†W'&÷"’°¢–b‡V–W66T–çfÆ–FFVDW‡FVç6–öä6öçFW‡B†W'&÷"’’&WGW&âµÓ°¢6öç6öÆRæW'&÷"‚%´æWFfÆ—‚FVW6VV²G&ç6ÆF÷%ÒÆöB&WG&ç6ÆFVB7VW2f–ÆVB"ÂW'&÷"“°¢7FFRç&WG&ç6ÆFVE6WBÒçVÆÃ°Ğ¢&WGW&âµÓ°Ğ¢ĞĞ§ĞĞ Ğ¦gVæ7F–öâvWD7VT'”7W'&VçEF–ÖR†7W'&VçEF–ÖR’°Ğ¢–b‚çVÖ&W"æ—4f–æ—FR†7W'&VçEF–ÖR’’&WGW&âçVÆÃ°Ğ¢6öç7Böfg6WE6V6öæG2ÒçVÖ&W"‚‡7FFRç6WGF–æw2bb7FFRç6WGF–æw2ç7V'F—FÆTöfg6WD×2’ÇÂ’ò°Ğ¢6öç7BF§W7FVEF–ÖRÒ7W'&VçEF–ÖR²öfg6WE6V6öæG3°Ğ¢&WGW&â7FFRç&WG&ç6ÆFVD7VW2æf–æB‚†7VR’ÓâF§W7FVEF–ÖRãÒ7VRç7F'BbbF§W7FVEF–ÖRÃÒ7VRæVæB’ÇÂçVÆÃ°Ğ§ĞĞ Ğ¦gVæ7F–öâ&VæFW%&WG&ç6ÆFVE7V'F—FÆR†7VR’°Ğ¢–b‚7VR’°Ğ¢–b‚7FFRç&WG&ç6ÆFVD7VW2æÆVæwF‚’°Ğ¢WFFT÷fW&Æ’‚.k*iÈXË˜XŞy¨NiÊÎYËš(N{û¾ŠùZÙ~[™^ûÈÎŠû~ZûÎXZR5%BõeEBh‰nXˆ~Y¹îZéîi{njŠ[Èò"Â""Â&†–çB"“°Ğ¢&WGW&ã°Ğ¢ĞĞ¢7FFRæÆ7E&WG&ç6ÆFVD7VT–BÒ"#°Ğ¢66†VGVÆT6ÆV"‚“°Ğ¢&WGW&ã°Ğ¢ĞĞ¢6öç7B7VT–BÒ7G&–ær†7VRæ7VT–BÇÂ7VRæ–BÇÂG¶7VRç7F'GÒÒG¶7VRæVæGÖ“°Ğ¢–b†7VT–BÓÓÒ7FFRæÆ7E&WG&ç6ÆFVD7VT–B’&WGW&ã°Ğ¢7FFRæÆ7E&WG&ç6ÆFVD7VT–BÒ7VT–C°¢7FFRç&WVW7E6WVVæ6R³Ò°¢6æ6VÅ66†VGVÆVD6ÆV"‚“°¢7FFRæÆ7E7V'F—FÆTBÒFFRææ÷r‚“°¢7FFRæÆ7E6÷W&6UFW‡BÒ7VRç6÷W&6UFW‡BÇÂ7VRçFW‡BÇÂ"#°¢7FFRæÆ7EG&ç6ÆF–öâÒ7VRçG&ç6ÆF–öâÇÂ7VRçFW‡BÇÂ"#°¢7FFRæÆ7EG&ç6ÆF–öå6÷W&6UFW‡BÒ7FFRæÆ7E6÷W&6UFW‡C°¢WFFT÷fW&Æ’‡7FFRæÆ7E6÷W&6UFW‡BÂ7FFRæÆ7EG&ç6ÆF–öâÂ'&VG’"“°§Ğ Ğ¦gVæ7F–öâvWD7W'&VçEf–FVõF–ÖR‚’°Ğ¢6öç7Bf–FVòÒFö7VÖVçBçVW'•6VÆV7F÷"‚'f–FVò"“°Ğ¢&WGW&âf–FVòòf–FVòæ7W'&VçEF–ÖR¢æã°Ğ§ĞĞ Ğ¦gVæ7F–öâvWD7W'&VçEf–FVô¶W’‚’°¢6öç7BÖF6‚ÒÆö6F–öâçF†æÖRæÖF6‚‚õÂ÷vF6…Âò…ÆB²’ò“°¢&WGW&âÖF6‚òæWFfÆ—‚ÒG¶ÖF6…³×Ö¢"#°§Ğ ¦gVæ7F–öâ&–æDæF—fUFW‡EG&6´wV&G2‚’°¢–b‚6†÷VÆD†–FTæF—fU7V'F—FÆW2‚’ÇÂ—4æWFfÆ—…vF6…vR‚’’&WGW&ã°¢6öç7Bf–FV÷2Ò'&’æg&öÒ†Fö7VÖVçBçVW'•6VÆV7F÷$ÆÂ‚'f–FVò"’“°¢f÷"†6öç7Bf–FVòöbf–FV÷2’°¢FDæF—fTwV&DÆ—7FVæW"‡f–FVòÂ&ÆöFVFÖWFFF"Â†æFÆTæF—fU7V'F—FÆUG&6´7F—f—G’“°¢FDæF—fTwV&DÆ—7FVæW"‡f–FVòÂ&ÆöFVFFF"Â†æFÆTæF—fU7V'F—FÆUG&6´7F—f—G’“°¢FDæF—fTwV&DÆ—7FVæW"‡f–FVòÂ'Æ’"Â†æFÆTæF—fU7V'F—FÆUG&6´7F—f—G’“°¢FDæF—fTwV&DÆ—7FVæW"‡f–FVòÂ'6VV¶–ær"Â†æFÆTæF—fU7V'F—FÆUG&6´7F—f—G’“°¢FDæF—fTwV&DÆ—7FVæW"‡f–FVòÂ'6VV¶VB"Â†æFÆTæF—fU7V'F—FÆUG&6´7F—f—G’“°¢6öç7BFW‡EG&6·2Òf–FVòçFW‡EG&6·3°¢–b‡FW‡EG&6·2bbFW‡EG&6·2æFDWfVçDÆ—7FVæW"’°¢FDæF—fTwV&DÆ—7FVæW"‡FW‡EG&6·2Â&6†ævR"Â†æFÆTæF—fU7V'F—FÆUG&6´7F—f—G’“°¢FDæF—fTwV&DÆ—7FVæW"‡FW‡EG&6·2Â&FGG&6²"Â†æFÆTæF—fU7V'F—FÆUG&6´7F—f—G’“°¢FDæF—fTwV&DÆ—7FVæW"‡FW‡EG&6·2Â'&VÖ÷fWG&6²"Â†æFÆTæF—fU7V'F—FÆUG&6´7F—f—G’“°¢Ğ¢Ğ¢f÷"†6öç7BG&6²öbvWEf–FVõFW‡EG&6·2‚’’°¢–b‚—57V'F—FÆUFW‡EG&6²‡G&6²’ÇÂG&6²æFDWfVçDÆ—7FVæW"’6öçF–çVS°¢FDæF—fTwV&DÆ—7FVæW"‡G&6²Â&7VV6†ævR"Â†æFÆTæF—fU7V'F—FÆUG&6´7F—f—G’“°¢Ğ§Ğ ¦gVæ7F–öâFDæF—fTwV&DÆ—7FVæW"‡F&vWBÂG—RÂÆ—7FVæW"’°¢–b‚F&vWBÇÂF&vWBæFDWfVçDÆ—7FVæW"’&WGW&ã°¢6öç7BW†—7G2Ò7FFRææF—fUG&6´WfVçDÆ—7FVæW'2ç6öÖR‚†VçG'’’Óà¢VçG'’çF&vWBÓÓÒF&vWBbbVçG'’çG—RÓÓÒG—RbbVçG'’æÆ—7FVæW"ÓÓÒÆ—7FVæW ¢“°¢–b†W†—7G2’&WGW&ã°¢F&vWBæFDWfVçDÆ—7FVæW"‡G—RÂÆ—7FVæW"“°¢7FFRææF—fUG&6´WfVçDÆ—7FVæW'2çW6‚‡²F&vWBÂG—RÂÆ—7FVæW"Ò“°§Ğ ¦gVæ7F–öâ&VÖ÷fTæF—fUFW‡EG&6´wV&G2‚’°¢f÷"†6öç7BVçG'’öb7FFRææF—fUG&6´WfVçDÆ—7FVæW'2’°¢G'’°¢VçG'’çF&vWBç&VÖ÷fTWfVçDÆ—7FVæW"†VçG'’çG—RÂVçG'’æÆ—7FVæW"“°¢Ò6F6‚†W'&÷"’°¢òò–væ÷&RFWF6†VBÖVF–ö&¦V7G2à¢Ğ¢Ğ¢7FFRææF—fUG&6´WfVçDÆ—7FVæW'2ÒµÓ°§Ğ ¦gVæ7F–öâ†æFÆTæF—fU7V'F—FÆUG&6´7F—f—G’‚’°¢–b‚6†÷VÆD†–FTæF—fU7V'F—FÆW2‚’ÇÂ—4æWFfÆ—…vF6…vR‚’’&WGW&ã°¢Fö7VÖVçBæFö7VÖVçDVÆVÖVçBæFF6WBææG7D†–FTæF—fU7V'F—FÆW2Ò'G'VR#°¢æ÷F–g”Ö–åFW‡EG&6´wV&B‚“°¢&ÔæF—fTfÆ6…&÷FV7F–öâƒ““°¢7W&W74æF—fUf–FVõFW‡EG&6·2‚“°¢6öç7B7F—fT7VTVÆVÖVçG2Òf–æDæF—fU7V'F—FÆTVÆVÖVçG4ÖF6†–æt7F—fT7VW2‡²f÷&6S¢G'VRÒ“°¢–b†7F—fT7VTVÆVÖVçG2æÆVæwF‚’°¢†–FTæF—fU7V'F—FÆTVÆVÖVçG4æ÷r†7F—fT7VTVÆVÖVçG2“°¢Ğ¢7F'DæF—fU7W&W76–öäg&ÖTwV&Bƒ“°¢VWVTæF—fT†–FU&VÇ’‚“°¢66†VGVÆT–ÖÖVF–FT66†VE&VæFW"ƒ“°¢66†VGVÆU66âƒ“°§Ğ ¦gVæ7F–öâ7W&W74æF—fUf–FVõFW‡EG&6·2‚’°¢f÷"†6öç7BG&6²öbvWEf–FVõFW‡EG&6·2‚’’°¢–b‚—57V'F—FÆUFW‡EG&6²‡G&6²’’6öçF–çVS°¢G'’°¢–b…7G&–ær‡G&6²æÖöFRÇÂ""’çFôÆ÷vW$66R‚’ÓÒ'6†÷v–ær"’6öçF–çVS°¢–b‚7FFRææF—fUFW‡EG&6´ÖöFT66†Ræ†2‡G&6²’’°¢7FFRææF—fUFW‡EG&6´ÖöFT66†Rç6WB‡G&6²ÂG&6²æÖöFR“°¢Ğ¢òò†–FFVâG&6·27F–ÆÂWFFR7F—fT7VW2Â'WBF†R'&÷w6W"FöW2æ÷B&VæFW"F†V—"æF—fR7VR&÷†W2à¢G&6²æÖöFRÒ&†–FFVâ#°¢Ò6F6‚†W'&÷"’°¢òò–væ÷&RG&6·2F†BF—6V"÷"&V¦V7BÖöFR6†ævW2GW&–ærÆ–W"WFFW2à¢Ğ¢Ğ§Ğ ¦gVæ7F–öâ&W7F÷&TæF—fUf–FVõFW‡EG&6·4–dÆÆ÷vVB‚’°¢–b†—4æWFfÆ—…vF6…vR‚’bb6†÷VÆD†–FTæF—fU7V'F—FÆW2‚’’°¢7W&W74æF—fUf–FVõFW‡EG&6·2‚“°¢æ÷F–g”Ö–åFW‡EG&6´wV&B‚“°¢&WGW&ã°¢Ğ¢&W7F÷&TæF—fUf–FVõFW‡EG&6·2‚“°§Ğ ¦gVæ7F–öâ&W7F÷&TæF—fUf–FVõFW‡EG&6·2‚’°¢f÷"†6öç7BG&6²öbvWEf–FVõFW‡EG&6·2‚’’°¢–b‚7FFRææF—fUFW‡EG&6´ÖöFT66†Ræ†2‡G&6²’’6öçF–çVS°¢6öç7B&Wf–÷W4ÖöFRÒ7FFRææF—fUFW‡EG&6´ÖöFT66†RævWB‡G&6²“°¢G'’°¢G&6²æÖöFRÒ&Wf–÷W4ÖöFRÇÂ'6†÷v–ær#°¢Ò6F6‚†W'&÷"’°¢òò–væ÷&RG&6·2F†BF—6V&VB÷"&V¦V7BÖöFR6†ævW2à¢Ğ¢Ğ¢7FFRææF—fUFW‡EG&6´ÖöFT66†RÒæWrvV´Ö‚“°§Ğ ¦gVæ7F–öâvWEf–FVõFW‡EG&6·2‚’°¢6öç7BG&6·2ÒµÓ°¢f÷"†6öç7Bf–FVòöb'&’æg&öÒ†Fö7VÖVçBçVW'•6VÆV7F÷$ÆÂ‚'f–FVò"’’’°¢–b‚f–FVòÇÂf–FVòçFW‡EG&6·2’6öçF–çVS°¢G&6·2çW6‚‚ââä'&’æg&öÒ‡f–FVòçFW‡EG&6·2’“°¢Ğ¢&WGW&âG&6·3°§Ğ ¦gVæ7F–öâ—57V'F—FÆUFW‡EG&6²‡G&6²’°¢–b‚G&6²’&WGW&âfÇ6S°¢6öç7B¶–æBÒ7G&–ær‡G&6²æ¶–æBÇÂ""’çFôÆ÷vW$66R‚“°¢&WGW&â¶–æBÓÓÒ'7V'F—FÆW2"ÇÂ¶–æBÓÓÒ&6F–öç2"ÇÂ¶–æBÓÓÒ&FW67&—F–öç2"ÇÂ¶–æC°§Ğ §Ò’‚“° Ğ 