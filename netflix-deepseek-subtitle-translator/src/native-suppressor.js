"use strict";

(() => {
  const BUILD_ID = "2026-07-10-cue-clear-61";
  const STYLE_ID = "netflix-deepseek-native-subtitle-suppression";
  const MASK_ID = "netflix-deepseek-native-subtitle-mask";
  const OVERLAY_ID = "netflix-deepseek-subtitle-overlay";
  const HIDDEN_CLASS = "ndst-native-subtitle-hidden";
  const ROOT_SELECTORS = [
    '[data-uia="player"]',
    ".watch-video",
    ".nf-player-container",
    ".html5-video-container",
    ".watch-video--player-view",
    ".AkiraPlayer"
  ];
  const STYLE_GLOBAL_SELECTORS = [
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
  const STYLE_SCOPED_SELECTORS = [
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
  const MAX_ELEMENTS_PER_PASS = 24;
  const MAX_VISUAL_SCAN_PER_PASS = 48;
  const HIDE_STYLE = {
    opacity: "0",
    visibility: "hidden",
    color: "transparent",
    "-webkit-text-fill-color": "transparent",
    "-webkit-text-stroke-color": "transparent",
    "text-shadow": "none",
    background: "transparent",
    "background-color": "transparent",
    "background-image": "none",
    "border-color": "transparent",
    "box-shadow": "none",
    filter: "opacity(0)",
    "clip-path": "inset(50%)",
    "-webkit-clip-path": "inset(50%)",
    overflow: "hidden"
  };
  let suppressionBurstActive = false;
  let suppressionBurstTimers = [];
  let pendingSuppressorMutations = [];
  let pendingSuppressorTimer = 0;

  if (
    document.documentElement.dataset.ndstNativeSuppressor === "loaded" &&
    document.documentElement.dataset.ndstNativeSuppressorBuildId === BUILD_ID
  ) {
    ensureMask();
    ensureStyle();
    return;
  }

  markSuppressionDefault();
  ensureMask();
  ensureStyle();
  startEarlyDomSuppressor();
  startSteadySuppressionLoop();
  queueEarlySuppressionBurst();

  function markSuppressionDefault() {
    if (!document.documentElement) return;
    document.documentElement.dataset.ndstNativeSuppressor = "loaded";
    document.documentElement.dataset.ndstNativeSuppressorBuildId = BUILD_ID;
    if (!document.documentElement.dataset.ndstHideNativeSubtitles) {
      document.documentElement.dataset.ndstHideNativeSubtitles = "true";
    }
    if (!document.documentElement.dataset.ndstNativeMask) {
      document.documentElement.dataset.ndstNativeMask = isNetflixWatchPage() ? "true" : "false";
    }
  }

  function ensureMask() {
    let mask = document.getElementById(MASK_ID);
    if (!mask) {
      mask = document.createElement("div");
      mask.id = MASK_ID;
      mask.setAttribute("aria-hidden", "true");
      document.documentElement.appendChild(mask);
    }
    applyMaskInlineStyle(mask);
    mask.style.setProperty("display", "none", "important");
  }

  function applyMaskInlineStyle(mask) {
    const styles = {
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
    for (const [property, value] of Object.entries(styles)) {
      mask.style.setProperty(property, value, "important");
    }
  }

  function ensureStyle() {
    const directSelectors = [
      ...STYLE_GLOBAL_SELECTORS.flatMap((selector) => [
        `html:not([data-ndst-hide-native-subtitles="false"]) ${selector}`,
        `html:not([data-ndst-hide-native-subtitles="false"]) ${selector} *`
      ]),
      `html:not([data-ndst-hide-native-subtitles="false"]) .${HIDDEN_CLASS}`,
      `html:not([data-ndst-hide-native-subtitles="false"]) .${HIDDEN_CLASS} *`
    ];
    const scopedSelectors = ROOT_SELECTORS.flatMap((rootSelector) =>
      STYLE_SCOPED_SELECTORS.flatMap((selector) => [
        `html:not([data-ndst-hide-native-subtitles="false"]) ${rootSelector} ${selector}${safeBroadSelectorFilter()}`,
        `html:not([data-ndst-hide-native-subtitles="false"]) ${rootSelector} ${selector}${safeBroadSelectorFilter()} *`
      ])
    );
    const selectors = [...directSelectors, ...scopedSelectors].join(",\n");
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(style);
    }
    if (style.dataset.ndstBuildId === BUILD_ID) return;
    style.dataset.ndstBuildId = BUILD_ID;
    style.textContent = `${selectors} {
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

#${MASK_ID} {
  position: fixed;
  left: 50%;
  bottom: 6.5%;
  width: min(72vw, 980px);
  height: clamp(54px, 9vh, 112px);
  transform: translateX(-50%);
  z-index: 2147483646;
  display: none;
  pointer-events: none;
  border-radius: 6px;
  background: transparent;
}

html:not([data-ndst-hide-native-subtitles="false"]):not([data-ndst-native-mask="false"]) #${MASK_ID} {
  display: none;
}

`;
  }

  function startEarlyDomSuppressor() {
    if (!window.MutationObserver || !document.documentElement) return;
    if (window.__NDST_EARLY_DOM_SUPPRESSOR__) {
      try {
        window.__NDST_EARLY_DOM_SUPPRESSOR__.disconnect();
      } catch (error) {
        // Ignore old observer cleanup failures.
      }
    }
    const observer = new MutationObserver((mutations) => {
      if (!shouldHideNativeSubtitles()) return;
      const immediateCandidates = [];
      for (const mutation of mutations) {
        if (isPluginOrAlreadyHiddenMutation(mutation)) continue;
        collectImmediateKnownNativeSubtitleElements(mutation, immediateCandidates);
        pendingSuppressorMutations.push(mutation);
        if (pendingSuppressorMutations.length >= 80) {
          pendingSuppressorMutations = pendingSuppressorMutations.slice(-80);
          break;
        }
      }
      if (immediateCandidates.length) {
        hideKnownNativeSubtitleElements(immediateCandidates);
      }
      schedulePendingSuppressorPass();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true
    });
    window.__NDST_EARLY_DOM_SUPPRESSOR__ = observer;
  }

  function collectImmediateKnownNativeSubtitleElements(mutation, candidates) {
    if (!mutation || !candidates || candidates.length >= MAX_ELEMENTS_PER_PASS) return;
    if (mutation.type === "characterData") {
      collectKnownNativeSubtitleElements(mutation.target, candidates);
      collectImmediateVisualNativeSubtitleElement(mutation.target, candidates);
    }
    for (const node of mutation.addedNodes || []) {
      collectKnownNativeSubtitleElements(node, candidates);
      collectImmediateVisualNativeSubtitleElement(node, candidates);
      if (candidates.length >= MAX_ELEMENTS_PER_PASS) break;
    }
  }

  function collectImmediateVisualNativeSubtitleElement(node, candidates) {
    if (!isNetflixWatchPage() || !candidates || candidates.length >= MAX_ELEMENTS_PER_PASS) return;
    const element = node && node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return;
    addVisualNativeSubtitleCandidate(element, candidates);
  }

  function schedulePendingSuppressorPass() {
    if (pendingSuppressorTimer) return;
    pendingSuppressorTimer = window.setTimeout(processPendingSuppressorMutations, 50);
  }

  function processPendingSuppressorMutations() {
    pendingSuppressorTimer = 0;
    if (!shouldHideNativeSubtitles()) {
      pendingSuppressorMutations = [];
      return;
    }
    const mutations = pendingSuppressorMutations.splice(0, pendingSuppressorMutations.length);
    const candidates = [];
    for (const mutation of mutations) {
      if (mutation.type === "characterData") {
        collectKnownNativeSubtitleElements(mutation.target, candidates);
        collectVisualNativeSubtitleElements(mutation.target, candidates);
      }
      for (const node of mutation.addedNodes || []) {
        collectKnownNativeSubtitleElements(node, candidates);
        collectVisualNativeSubtitleElements(node, candidates);
        if (candidates.length >= MAX_ELEMENTS_PER_PASS) break;
      }
      if (candidates.length >= MAX_ELEMENTS_PER_PASS) break;
    }
    hideKnownNativeSubtitleElements(candidates);
    if (candidates.length) queueSuppressionBurst();
  }

  function isPluginOrAlreadyHiddenMutation(mutation) {
    const target = mutation && mutation.target;
    const element = target && target.nodeType === Node.TEXT_NODE ? target.parentElement : target;
    return Boolean(
      element &&
      element.closest &&
      element.closest(`#${OVERLAY_ID}, #${MASK_ID}, .${HIDDEN_CLASS}`)
    );
  }

  function startSteadySuppressionLoop() {
    if (window.__NDST_STEADY_DOM_SUPPRESSOR__) {
      window.clearInterval(window.__NDST_STEADY_DOM_SUPPRESSOR__);
    }
    window.__NDST_STEADY_DOM_SUPPRESSOR__ = window.setInterval(() => {
      if (!shouldHideNativeSubtitles() || !isNetflixWatchPage()) return;
      runSuppressionPass();
    }, 900);
  }

  function queueEarlySuppressionBurst() {
    for (const delay of [0, 40, 120, 300, 700, 1400]) {
      window.setTimeout(() => {
        if (!shouldHideNativeSubtitles()) return;
        runSuppressionPass();
      }, delay);
    }
  }

  function queueSuppressionBurst() {
    if (suppressionBurstActive) return;
    suppressionBurstActive = true;
    for (const timer of suppressionBurstTimers) {
      window.clearTimeout(timer);
    }
    suppressionBurstTimers = [];
    for (const delay of [0, 40, 120, 260, 520]) {
      const timer = window.setTimeout(() => {
        if (shouldHideNativeSubtitles() && isNetflixWatchPage()) {
          runSuppressionPass();
        }
        if (delay === 520) {
          suppressionBurstActive = false;
          suppressionBurstTimers = [];
        }
      }, delay);
      suppressionBurstTimers.push(timer);
    }
  }

  function runSuppressionPass() {
    hideKnownNativeSubtitleElements([
      ...findKnownNativeSubtitleElements(),
      ...(suppressionBurstActive ? findVisualNativeSubtitleElements() : [])
    ]);
  }

  function collectKnownNativeSubtitleElements(node, candidates) {
    const element = node && node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return;
    const selector = getKnownNativeSelector();
    if (element.matches && element.matches(selector)) {
      candidates.push(element);
    }
    if (element.closest) {
      const closest = element.closest(selector);
      if (closest) candidates.push(closest);
    }
    if (element.querySelectorAll) {
      for (const match of element.querySelectorAll(selector)) {
        candidates.push(match);
        if (candidates.length >= MAX_ELEMENTS_PER_PASS) break;
      }
    }
  }

  function collectVisualNativeSubtitleElements(node, candidates) {
    if (!isNetflixWatchPage()) return;
    const element = node && node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return;
    addVisualNativeSubtitleCandidate(element, candidates);
    if (!element.querySelectorAll || candidates.length >= MAX_ELEMENTS_PER_PASS) return;
    const nodes = element.querySelectorAll("span, div, p");
    for (let index = nodes.length - 1, visited = 0; index >= 0 && visited < MAX_VISUAL_SCAN_PER_PASS; index -= 1, visited += 1) {
      addVisualNativeSubtitleCandidate(nodes[index], candidates);
      if (candidates.length >= MAX_ELEMENTS_PER_PASS) break;
    }
  }

  function findKnownNativeSubtitleElements() {
    const elements = [];
    const selector = getKnownNativeSelector();
    for (const root of getPlayerRoots()) {
      if (!root || !root.querySelectorAll) continue;
      if (root.matches && root.matches(selector)) {
        elements.push(root);
      }
      for (const element of root.querySelectorAll(selector)) {
        elements.push(element);
        if (elements.length >= MAX_ELEMENTS_PER_PASS) return Array.from(new Set(elements));
      }
    }
    return Array.from(new Set(elements));
  }

  function findVisualNativeSubtitleElements() {
    if (!isNetflixWatchPage()) return [];
    const elements = [];
    for (const root of getPlayerRoots()) {
      if (!root || !root.querySelectorAll) continue;
      const nodes = root.querySelectorAll("span, div, p");
      for (let index = nodes.length - 1, visited = 0; index >= 0 && visited < MAX_VISUAL_SCAN_PER_PASS; index -= 1, visited += 1) {
        addVisualNativeSubtitleCandidate(nodes[index], elements);
        if (elements.length >= MAX_ELEMENTS_PER_PASS) return Array.from(new Set(elements));
      }
    }
    return Array.from(new Set(elements));
  }

  function addVisualNativeSubtitleCandidate(element, candidates) {
    if (!looksLikeVisualNativeSubtitleElement(element)) return;
    candidates.push(element);
    const stableParent = findStableVisualSubtitleContainer(element);
    if (stableParent && stableParent !== element) {
      candidates.push(stableParent);
    }
  }

  function findStableVisualSubtitleContainer(element) {
    if (!element || !element.parentElement) return element;
    const baseText = normalizeText(element.innerText || element.textContent);
    const baseRect = element.getBoundingClientRect();
    if (!baseText || !isUsableSubtitleRect(baseRect)) return element;

    let best = element;
    let current = element.parentElement;
    let depth = 0;
    while (current && depth < 3 && isInsidePlayerRoot(current)) {
      if (current.id === OVERLAY_ID || current.id === MASK_ID || isExcludedUiElement(current)) break;
      const text = normalizeText(current.innerText || current.textContent);
      if (!text || text.length > 240) break;
      if (!text.includes(baseText) && !baseText.includes(text)) break;
      const rect = current.getBoundingClientRect();
      if (!isUsableSubtitleRect(rect)) break;
      if (rect.width > Math.max(baseRect.width + 260, baseRect.width * 3)) break;
      if (rect.height > Math.max(baseRect.height + 96, baseRect.height * 4)) break;
      best = current;
      current = current.parentElement;
      depth += 1;
    }
    return best;
  }

  function looksLikeVisualNativeSubtitleElement(element) {
    if (!isNetflixWatchPage()) return false;
    if (!element || !["DIV", "P", "SPAN"].includes(element.tagName)) return false;
    if (element.id === OVERLAY_ID || element.id === MASK_ID) return false;
    if (element.closest && element.closest(`#${OVERLAY_ID}, #${MASK_ID}`)) return false;
    if (!isInsidePlayerRoot(element)) return false;
    if (isExcludedUiElement(element)) return false;
    const text = normalizeText(element.innerText || element.textContent);
    if (!isPlausibleSubtitleText(text)) return false;
    return isUsableSubtitleRect(element.getBoundingClientRect());
  }

  function isUsableSubtitleRect(rect) {
    if (!rect || rect.width < 16 || rect.height < 8) return false;
    const width = window.innerWidth || document.documentElement.clientWidth || 0;
    const height = window.innerHeight || document.documentElement.clientHeight || 0;
    if (!width || !height) return false;
    if (rect.left < -4 || rect.right > width + 4) return false;
    if (rect.bottom <= 0 || rect.top >= height) return false;
    if (rect.width > width * 0.9 || rect.height > height * 0.26) return false;
    const inSubtitleBand = rect.top > height * 0.42 && rect.bottom < height + 4;
    const centered = rect.left < width * 0.84 && rect.right > width * 0.16;
    return inSubtitleBand && centered;
  }

  function isInsidePlayerRoot(element) {
    return getPlayerRoots().some((root) => root === element || (root.contains && root.contains(element)));
  }

  function hideKnownNativeSubtitleElements(elements) {
    if (!elements || !elements.length || !shouldHideNativeSubtitles()) return;
    let hiddenCount = Number(document.documentElement.dataset.ndstNativeHiddenCount || 0);
    for (const element of Array.from(new Set(elements)).slice(0, MAX_ELEMENTS_PER_PASS)) {
      if (!element || element.id === MASK_ID || element.closest(`#${MASK_ID}`)) continue;
      if (!matchesDirectKnownSubtitleSelector(element) && isExcludedUiElement(element)) continue;
      if (!element.classList.contains(HIDDEN_CLASS)) {
        element.classList.add(HIDDEN_CLASS);
        hiddenCount += 1;
      }
      for (const [property, value] of Object.entries(HIDE_STYLE)) {
        if (
          element.style.getPropertyValue(property) !== value ||
          element.style.getPropertyPriority(property) !== "important"
        ) {
          element.style.setProperty(property, value, "important");
        }
      }
      recordHiddenElement(element, hiddenCount);
    }
    document.documentElement.dataset.ndstNativeHiddenCount = String(hiddenCount);
  }

  function recordHiddenElement(element, hiddenCount) {
    const text = normalizeText(element.innerText || element.textContent);
    document.documentElement.dataset.ndstNativeHiddenCount = String(hiddenCount);
    document.documentElement.dataset.ndstNativeLastHiddenAt = String(Date.now());
    document.documentElement.dataset.ndstNativeLastHiddenText = text.slice(0, 80);
    document.documentElement.dataset.ndstNativeLastHiddenClass = String(element.className || "").slice(0, 120);
    document.documentElement.dataset.ndstNativeLastHiddenUia = element.getAttribute("data-uia") || "";
  }

  function getKnownNativeSelector() {
    const global = STYLE_GLOBAL_SELECTORS.join(",");
    const scoped = ROOT_SELECTORS.flatMap((rootSelector) =>
      STYLE_SCOPED_SELECTORS.map((selector) =>
        `${rootSelector} ${selector}${safeBroadSelectorFilter()}`
      )
    ).join(",");
    return `${global},${scoped},.${HIDDEN_CLASS}`;
  }

  function matchesDirectKnownSubtitleSelector(element) {
    return Boolean(element && element.matches && element.matches(STYLE_GLOBAL_SELECTORS.join(",")));
  }

  function getPlayerRoots() {
    const roots = [];
    for (const selector of ROOT_SELECTORS) {
      const element = document.querySelector(selector);
      if (element) roots.push(element);
    }
    if (document.fullscreenElement) roots.push(document.fullscreenElement);
    return roots.length ? Array.from(new Set(roots)) : [];
  }

  function shouldHideNativeSubtitles() {
    return document.documentElement &&
      document.documentElement.dataset.ndstHideNativeSubtitles !== "false";
  }

  function isExcludedUiElement(element) {
    if (!element || !element.closest) return true;
    const interactiveAncestor = element.closest([
      "button",
      "input",
      "select",
      "textarea",
      '[role="button"]',
      '[role="menu"]',
      '[role="menuitem"]',
      '[data-uia*="control" i]',
      '[data-uia*="button" i]',
      '[data-uia*="progress" i]',
      '[data-uia*="duration" i]',
      '[data-uia*="menu" i]',
      '[data-uia*="title" i]'
    ].join(","));
    if (interactiveAncestor) return true;
    return Boolean(element.matches && element.matches('[aria-label]'));
  }

  function normalizeText(text) {
    return String(text || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isPlausibleSubtitleText(text) {
    if (!text || text.length > 220) return false;
    const lines = text.split(/\s*\n\s*/).filter(Boolean);
    if (lines.length > 3) return false;
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(text)) return false;
    if (/^(Skip|Intro|Next|Episode|Pause|Play|Audio|Subtitles|Settings)$/i.test(text)) return false;
    if (/^(跳过|播放|暂停|音频|字幕|设置|下一集|片头)$/.test(text)) return false;
    if (/^(Episodes|More Like This|Trailers|Audio|Subtitles|Next Episode|Resume|Restart|My List|Rate|Details|Skip Intro|Skip Recap)$/i.test(text)) return false;
    if (/^(剧集|更多类似影片|预告片|音频|字幕|下一集|继续播放|重新开始|我的片单|评分|详情|跳过片头|跳过前情提要)$/.test(text)) return false;
    if (/^S\d+\s*E\d+/i.test(text)) return false;
    if (/\bSeason\s*\d+\b.*\bEpisode\s*\d+\b/i.test(text)) return false;
    if (/第\s*\d+\s*季\s*第?\s*\d+\s*集/.test(text)) return false;
    if (/第\s*\d+\s*集\s*[“"「『]/.test(text)) return false;
    if (/^\d{1,2}:\d{2}.*第\s*\d+\s*集/.test(text)) return false;
    return /[A-Za-z\u3040-\u30ff\u3400-\u9fff]/.test(text);
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

  function isNetflixWatchPage() {
    return /^\/watch\//.test(location.pathname);
  }
})();
