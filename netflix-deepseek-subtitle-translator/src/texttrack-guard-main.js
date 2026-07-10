"use strict";

(() => {
  const BUILD_ID = "2026-07-10-cue-clear-61";
  const STATE_KEY = "__NDST_TEXT_TRACK_GUARD__";
  const MAIN_STYLE_ID = "netflix-deepseek-main-native-subtitle-suppression";
  const RETRY_DELAYS_MS = [0, 25, 75, 150, 300, 600, 1000, 1600, 2400];

  const root = document.documentElement;
  if (!root) return;
  if (/^\/watch\//.test(location.pathname) && !root.dataset.ndstHideNativeSubtitles) {
    root.dataset.ndstHideNativeSubtitles = "true";
  }
  ensureMainWorldNativeStyle();

  const state = window[STATE_KEY] || {
    buildId: "",
    patched: false,
    addTextTrackPatched: false,
    trackNodeObserverStarted: false,
    blockedCount: 0,
    originalDescriptor: null,
    originalAddTextTrack: null,
    retryIndex: 0,
    retryTimer: 0,
    shortBurstPending: false,
    shortBurstTimers: [],
    trackCueGuarded: new WeakSet(),
    forcedHiddenTracks: new WeakSet()
  };
  window[STATE_KEY] = state;
  if (!state.trackCueGuarded || typeof state.trackCueGuarded.add !== "function") {
    state.trackCueGuarded = new WeakSet();
  }
  if (!state.forcedHiddenTracks || typeof state.forcedHiddenTracks.add !== "function") {
    state.forcedHiddenTracks = new WeakSet();
  }
  if (state.buildId && state.buildId !== BUILD_ID) {
    try {
      if (state.trackNodeObserver) state.trackNodeObserver.disconnect();
    } catch (error) {
      // Ignore old observer cleanup failures.
    }
    state.trackNodeObserver = null;
    state.trackNodeObserverStarted = false;
    state.eventsAttached = false;
    state.shortBurstPending = false;
    state.trackCueGuarded = new WeakSet();
    state.forcedHiddenTracks = new WeakSet();
    for (const timer of state.shortBurstTimers || []) {
      window.clearTimeout(timer);
    }
    state.shortBurstTimers = [];
  }
  state.buildId = BUILD_ID;
  state.shouldBlockShowingMode = shouldBlockShowingMode;

  markGuardState("loading");
  installOrRetry();

  function ensureMainWorldNativeStyle() {
    let style = document.getElementById(MAIN_STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = MAIN_STYLE_ID;
      (document.head || document.documentElement).appendChild(style);
    }
    if (style.dataset.ndstBuildId === BUILD_ID) return;
    style.dataset.ndstBuildId = BUILD_ID;
    style.textContent = `html:not([data-ndst-hide-native-subtitles="false"]) .player-timedtext,
html:not([data-ndst-hide-native-subtitles="false"]) .player-timedtext *,
html:not([data-ndst-hide-native-subtitles="false"]) .player-timedtext-text-container,
html:not([data-ndst-hide-native-subtitles="false"]) .player-timedtext-text-container *,
html:not([data-ndst-hide-native-subtitles="false"]) .player-subtitle-text,
html:not([data-ndst-hide-native-subtitles="false"]) .player-subtitle-text *,
html:not([data-ndst-hide-native-subtitles="false"]) [class*="player-timedtext" i],
html:not([data-ndst-hide-native-subtitles="false"]) [class*="player-timedtext" i] *,
html:not([data-ndst-hide-native-subtitles="false"]) [class*="timedtext" i],
html:not([data-ndst-hide-native-subtitles="false"]) [class*="timedtext" i] *,
html:not([data-ndst-hide-native-subtitles="false"]) [class*="texttrack" i],
html:not([data-ndst-hide-native-subtitles="false"]) [class*="texttrack" i] *,
html:not([data-ndst-hide-native-subtitles="false"]) [data-uia*="player-timedtext" i],
html:not([data-ndst-hide-native-subtitles="false"]) [data-uia*="player-timedtext" i] *,
html:not([data-ndst-hide-native-subtitles="false"]) [data-uia*="timedtext" i],
html:not([data-ndst-hide-native-subtitles="false"]) [data-uia*="timedtext" i] *,
html:not([data-ndst-hide-native-subtitles="false"]) [data-uia*="texttrack" i],
html:not([data-ndst-hide-native-subtitles="false"]) [data-uia*="texttrack" i] * {
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
html:not([data-ndst-hide-native-subtitles="false"]) video::-webkit-media-text-track-region-container,
html:not([data-ndst-hide-native-subtitles="false"]) video::-webkit-media-text-track-background,
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
}`;
  }

  function installOrRetry() {
    window.clearTimeout(state.retryTimer);
    state.retryTimer = 0;

    if (installTextTrackModePatch()) {
      state.retryIndex = 0;
      installAddTextTrackPatch();
      startTrackNodeObserver();
      addMediaEventGuards();
      suppressShowingTextTracks();
      queueInitialSuppression();
      markGuardState("active");
      return;
    }

    if (state.retryIndex >= RETRY_DELAYS_MS.length) {
      markGuardState("unavailable");
      return;
    }

    const delay = RETRY_DELAYS_MS[state.retryIndex];
    state.retryIndex += 1;
    markGuardState(`retry-${state.retryIndex}`);
    state.retryTimer = window.setTimeout(installOrRetry, delay);
  }

  function installTextTrackModePatch() {
    const TextTrackCtor = window.TextTrack;
    const prototype = TextTrackCtor && TextTrackCtor.prototype;
    const descriptor = state.originalDescriptor || findPropertyDescriptor(prototype, "mode");

    if (!prototype || !descriptor || typeof descriptor.get !== "function" || typeof descriptor.set !== "function") {
      return false;
    }

    state.originalDescriptor = descriptor;

    if (state.patched) {
      return true;
    }

    try {
      Object.defineProperty(prototype, "mode", {
        configurable: true,
        enumerable: descriptor.enumerable,
        get() {
          return state.originalDescriptor.get.call(this);
        },
        set(value) {
          const shouldBlock = typeof state.shouldBlockShowingMode === "function" &&
            state.shouldBlockShowingMode(this, value);
          const nextValue = shouldBlock ? "hidden" : value;
          if (nextValue !== value) {
            state.forcedHiddenTracks.add(this);
            state.blockedCount += 1;
            markGuardState("blocked");
          }
          return state.originalDescriptor.set.call(this, nextValue);
        }
      });
      state.patched = true;
      return true;
    } catch (error) {
      markGuardState("failed");
      return false;
    }
  }

  function findPropertyDescriptor(object, propertyName) {
    let current = object;
    while (current) {
      const currentDescriptor = Object.getOwnPropertyDescriptor(current, propertyName);
      if (currentDescriptor) return currentDescriptor;
      current = Object.getPrototypeOf(current);
    }
    return null;
  }

  function installAddTextTrackPatch() {
    const prototype = window.HTMLMediaElement && window.HTMLMediaElement.prototype;
    if (!prototype || typeof prototype.addTextTrack !== "function") return;

    if (!state.originalAddTextTrack) {
      state.originalAddTextTrack = prototype.addTextTrack;
    }
    if (state.addTextTrackPatched) return;

    try {
      Object.defineProperty(prototype, "addTextTrack", {
        configurable: true,
        writable: true,
        value: function (...args) {
          const track = state.originalAddTextTrack.apply(this, args);
          suppressTrackIfShowing(track);
          queueShortSuppressionBurst();
          return track;
        }
      });
      state.addTextTrackPatched = true;
    } catch (error) {
      markGuardState("addtrack-patch-failed");
    }
  }

  function shouldBlockShowingMode(track, value) {
    return shouldHideNativeSubtitles() &&
      isSubtitleTextTrack(track) &&
      String(value || "").toLowerCase() === "showing";
  }

  function shouldHideNativeSubtitles() {
    return /^\/watch\//.test(location.pathname) &&
      document.documentElement &&
      document.documentElement.dataset.ndstHideNativeSubtitles !== "false";
  }

  function isSubtitleTextTrack(track) {
    if (!track) return false;
    const kind = String(track.kind || "").toLowerCase();
    return kind === "subtitles" || kind === "captions" || kind === "descriptions" || !kind;
  }

  function suppressShowingTextTracks() {
    if (!shouldHideNativeSubtitles()) {
      restoreForcedHiddenTracks();
      return;
    }
    const videos = document.querySelectorAll ? document.querySelectorAll("video") : [];
    for (const video of Array.from(videos)) {
      const textTracks = video && video.textTracks ? Array.from(video.textTracks) : [];
      for (const track of textTracks) {
        attachCueGuard(track);
        suppressTrackIfShowing(track);
      }
    }
  }

  function attachCueGuard(track) {
    if (!track || !track.addEventListener || state.trackCueGuarded.has(track)) return;
    try {
      track.addEventListener("cuechange", queueShortSuppressionBurst);
      state.trackCueGuarded.add(track);
    } catch (error) {
      // Ignore tracks that reject listeners.
    }
  }

  function suppressTrackIfShowing(track) {
    if (!shouldHideNativeSubtitles() || !isSubtitleTextTrack(track)) return;
    attachCueGuard(track);
    try {
      if (String(track.mode || "").toLowerCase() !== "showing") return;
      state.forcedHiddenTracks.add(track);
      track.mode = "hidden";
      state.blockedCount += 1;
      markGuardState("forced-hidden");
    } catch (error) {
      // Ignore tracks that disappear or reject mode changes during navigation.
    }
  }

  function restoreForcedHiddenTracks() {
    const videos = document.querySelectorAll ? document.querySelectorAll("video") : [];
    for (const video of Array.from(videos)) {
      const textTracks = video && video.textTracks ? Array.from(video.textTracks) : [];
      for (const track of textTracks) {
        if (!state.forcedHiddenTracks.has(track)) continue;
        try {
          if (String(track.mode || "").toLowerCase() === "hidden") {
            track.mode = "showing";
          }
          state.forcedHiddenTracks.delete(track);
        } catch (error) {
          // Keep the marker so a later settings sync can retry restoration.
        }
      }
    }
  }

  function startTrackNodeObserver() {
    if (state.trackNodeObserverStarted || !document.documentElement || !window.MutationObserver) return;
    state.trackNodeObserverStarted = true;
    const observer = new MutationObserver((mutations) => {
      if (!shouldHideNativeSubtitles()) return;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes || []) {
          if (isElementNode(node)) {
            queueShortSuppressionBurst();
            return;
          }
        }
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
    state.trackNodeObserver = observer;
  }

  function isElementNode(node) {
    return Boolean(node && node.nodeType === Node.ELEMENT_NODE);
  }

  function addMediaEventGuards() {
    if (state.eventsAttached) return;
    state.eventsAttached = true;
    const mediaEvents = ["loadedmetadata", "loadeddata", "play", "playing", "seeking", "seeked", "timeupdate"];
    for (const eventName of mediaEvents) {
      document.addEventListener(eventName, suppressShowingTextTracks, true);
    }
    document.addEventListener("fullscreenchange", queueShortSuppressionBurst, true);
    document.addEventListener("webkitfullscreenchange", queueShortSuppressionBurst, true);
    window.addEventListener("ndst-texttrack-guard-sync", suppressShowingTextTracks);
  }

  function queueInitialSuppression() {
    for (const delay of [0, 40, 100, 220, 520, 1000, 1800]) {
      window.setTimeout(suppressShowingTextTracks, delay);
    }
  }

  function queueShortSuppressionBurst() {
    if (!shouldHideNativeSubtitles() || state.shortBurstPending) return;
    state.shortBurstPending = true;
    state.shortBurstTimers = [];
    for (const delay of [0, 8, 35, 100, 220]) {
      const timer = window.setTimeout(() => {
        suppressShowingTextTracks();
        if (delay === 220) {
          state.shortBurstPending = false;
          state.shortBurstTimers = [];
        }
      }, delay);
      state.shortBurstTimers.push(timer);
    }
  }

  function markGuardState(status) {
    const currentRoot = document.documentElement;
    if (!currentRoot) return;
    currentRoot.dataset.ndstTextTrackGuard = state.patched ? "loaded" : status;
    currentRoot.dataset.ndstTextTrackGuardBuildId = BUILD_ID;
    currentRoot.dataset.ndstTextTrackGuardStatus = status;
    currentRoot.dataset.ndstTextTrackGuardBlockedCount = String(state.blockedCount || 0);
    currentRoot.dataset.ndstTextTrackGuardAddTrack = state.addTextTrackPatched ? "true" : "false";
  }
})();
