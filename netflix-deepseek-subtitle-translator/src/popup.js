"use strict";

const elements = {
  platformText: document.getElementById("platformText"),
  enabledText: document.getElementById("enabledText"),
  apiKeyText: document.getElementById("apiKeyText"),
  modelText: document.getElementById("modelText"),
  displayModeText: document.getElementById("displayModeText"),
  hideNativeText: document.getElementById("hideNativeText"),
  subtitleSourceText: document.getElementById("subtitleSourceText"),
  pretranslatedText: document.getElementById("pretranslatedText"),
  cacheText: document.getElementById("cacheText"),
  pageControlText: document.getElementById("pageControlText"),
  buildText: document.getElementById("buildText"),
  nativeHitText: document.getElementById("nativeHitText"),
  nativeLastText: document.getElementById("nativeLastText"),
  enabledToggle: document.getElementById("enabledToggle"),
  status: document.getElementById("status")
};

const TEXTTRACK_GUARD_BUILD_ID = "2026-07-10-audit-62";
const CONTENT_BUILD_ID = "2026-07-10-audit-62";
const NATIVE_SUPPRESSOR_BUILD_ID = "2026-07-10-audit-62";
const YOUTUBE_BUILD_ID = "2026-07-11-youtube-2";

document.addEventListener("DOMContentLoaded", loadStatus);
elements.enabledToggle.addEventListener("change", toggleEnabled);
document.getElementById("openOptions").addEventListener("click", openOptions);
document.getElementById("openPretranslate").addEventListener("click", openPretranslate);
document.getElementById("clearOverlay").addEventListener("click", clearCurrentOverlay);

async function loadStatus() {
  const response = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
  if (!response || !response.ok) {
    showStatus("读取状态失败", true);
    return;
  }
  renderStatus(response.status);
  await loadPretranslatedStatus(response.status);
  await loadPageDiagnostics();
}

function renderStatus(status) {
  elements.enabledText.textContent = status.enabled ? "已启用" : "已暂停";
  elements.apiKeyText.textContent = status.hasApiKey ? "已配置" : "未配置";
  elements.modelText.textContent = status.model;
  elements.displayModeText.textContent = status.displayMode === "bilingual" ? "双语显示" : "只显示中文";
  elements.hideNativeText.textContent = status.enabled ? "强制隐藏" : (status.hideNativeSubtitles ? "已隐藏" : "未隐藏");
  elements.subtitleSourceText.textContent = status.subtitleSourceMode === "pretranslated" ? "预翻译" : "实时识别";
  elements.cacheText.textContent = `${status.cacheCount} 条`;
  elements.enabledToggle.checked = Boolean(status.enabled);
}

async function loadPretranslatedStatus(status) {
  const videoKey = await getActiveVideoKey();
  if (!videoKey) {
    elements.pretranslatedText.textContent = "未匹配页面";
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: "LOAD_PRETRANSLATED_CUES",
      query: {
        videoKey,
        targetLanguage: status.targetLanguage,
        model: status.model
      }
    });
    if (response && response.ok && response.set) {
      elements.pretranslatedText.textContent = `${response.cues.length} 条`;
    } else {
      elements.pretranslatedText.textContent = "未导入";
    }
  } catch (error) {
    elements.pretranslatedText.textContent = "读取失败";
  }
}

async function loadPageDiagnostics() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const platform = tab && tab.url ? getSupportedPlatform(tab.url) : "";
  elements.platformText.textContent = platform === "netflix"
    ? "Netflix"
    : platform === "youtube" ? "YouTube" : "不支持";
  if (!tab || !tab.id || !platform) {
    elements.pageControlText.textContent = "非支持页面";
    elements.buildText.textContent = "-";
    elements.nativeHitText.textContent = "-";
    elements.nativeLastText.textContent = "-";
    return;
  }

  if (platform === "youtube") {
    await loadYouTubePageDiagnostics(tab.id);
    return;
  }

  try {
    const response = await getPageDiagnosticsFromTab(tab.id);
    if (!response || !response.ok || !response.diagnostics) {
      const injectedResponse = await injectAndReadPageDiagnostics(tab.id);
      if (!injectedResponse || !injectedResponse.ok || !injectedResponse.diagnostics) {
        renderMissingDiagnostics("netflix");
        return;
      }
      renderPageDiagnostics(injectedResponse.diagnostics);
      return;
    }
    if (!isPageDiagnosticsCurrent(response.diagnostics)) {
      const injectedResponse = await injectAndReadPageDiagnostics(tab.id);
      if (injectedResponse && injectedResponse.ok && injectedResponse.diagnostics) {
        renderPageDiagnostics(injectedResponse.diagnostics);
        showStatus("已更新当前 Netflix 页面接管脚本");
        return;
      }
    }
    renderPageDiagnostics(response.diagnostics);
  } catch (error) {
    try {
      const injectedResponse = await injectAndReadPageDiagnostics(tab.id);
      if (injectedResponse && injectedResponse.ok && injectedResponse.diagnostics) {
        renderPageDiagnostics(injectedResponse.diagnostics);
        showStatus("已补充接管当前 Netflix 页面");
        return;
      }
    } catch (injectError) {
      console.error("[Netflix DeepSeek Translator] inject failed", injectError);
    }
    renderMissingDiagnostics("netflix");
  }
}

async function loadYouTubePageDiagnostics(tabId) {
  try {
    let response = await getPageDiagnosticsFromTab(tabId).catch(() => null);
    if (!response || !response.ok || !response.diagnostics ||
        response.diagnostics.buildId !== YOUTUBE_BUILD_ID) {
      response = await injectAndReadYouTubeDiagnostics(tabId);
    }
    if (!response || !response.ok || !response.diagnostics) {
      renderMissingDiagnostics("youtube");
      return;
    }
    renderYouTubeDiagnostics(response.diagnostics);
  } catch (error) {
    renderMissingDiagnostics("youtube");
  }
}

async function getPageDiagnosticsFromTab(tabId) {
  return chrome.tabs.sendMessage(tabId, { type: "GET_PAGE_DIAGNOSTICS" });
}

async function injectAndReadPageDiagnostics(tabId) {
  if (!chrome.scripting || !chrome.scripting.executeScript || !chrome.scripting.insertCSS) {
    return null;
  }
  const state = await readInjectedState(tabId);
  await chrome.scripting.insertCSS({
    target: { tabId },
    files: ["src/overlay.css"]
  });
  const textTrackGuardCurrent = state.textTrackGuardBuildId === TEXTTRACK_GUARD_BUILD_ID;
  const nativeCurrent = state.nativeSuppressorLoaded &&
    state.nativeSuppressorBuildId === NATIVE_SUPPRESSOR_BUILD_ID;
  const contentCurrent = state.contentLoaded &&
    state.buildId === CONTENT_BUILD_ID;
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
  await chrome.tabs.sendMessage(tabId, {
    type: "PREHIDE_NATIVE_SUBTITLES",
    durationMs: 5000
  }).catch(() => {});
  await delay(250);
  return getPageDiagnosticsFromTab(tabId);
}

async function injectAndReadYouTubeDiagnostics(tabId) {
  if (!chrome.scripting || !chrome.scripting.executeScript || !chrome.scripting.insertCSS) {
    return null;
  }
  await chrome.scripting.insertCSS({
    target: { tabId },
    files: ["src/youtube-overlay.css"]
  });
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => document.documentElement.dataset.ndstYoutubeBuildId || ""
  });
  const currentBuild = results && results[0] ? results[0].result : "";
  if (currentBuild !== YOUTUBE_BUILD_ID) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["src/content-youtube.js"]
    });
  }
  await delay(180);
  return getPageDiagnosticsFromTab(tabId);
}

function isPageDiagnosticsCurrent(diagnostics) {
  return Boolean(
    diagnostics &&
    diagnostics.buildId === CONTENT_BUILD_ID &&
    diagnostics.nativeSuppressorBuildId === NATIVE_SUPPRESSOR_BUILD_ID &&
    diagnostics.textTrackGuardBuildId === TEXTTRACK_GUARD_BUILD_ID
  );
}

async function readInjectedState(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const dataset = document.documentElement.dataset;
      return {
        textTrackGuardLoaded: dataset.ndstTextTrackGuard === "loaded",
        nativeSuppressorLoaded: dataset.ndstNativeSuppressor === "loaded",
        contentLoaded: dataset.ndstContentNetflix === "loaded",
        buildId: dataset.ndstBuildId || "",
        nativeSuppressorBuildId: dataset.ndstNativeSuppressorBuildId || "",
        textTrackGuardBuildId: dataset.ndstTextTrackGuardBuildId || ""
      };
    }
  });
  return results && results[0] && results[0].result
    ? results[0].result
    : {
      textTrackGuardLoaded: false,
      nativeSuppressorLoaded: false,
      contentLoaded: false,
      textTrackGuardBuildId: ""
    };
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function renderMissingDiagnostics(platform = "") {
  elements.pageControlText.textContent = "未接管";
  elements.buildText.textContent = "not injected";
  elements.nativeHitText.textContent = "0";
  elements.nativeLastText.textContent = `${platform === "youtube" ? "YouTube" : "Netflix"} 内容脚本未注入`;
}

function renderYouTubeDiagnostics(diagnostics) {
  const hidden = diagnostics.hideNativeSubtitles === "true";
  elements.pageControlText.textContent = `已接管 / ${hidden ? "隐藏中" : "未隐藏"}`;
  elements.buildText.textContent = diagnostics.buildId || "youtube?";
  elements.nativeHitText.textContent = `${Number(diagnostics.nativeCaptionCount || 0)} 个 / 可见 ${Number(diagnostics.nativeVisibleCount || 0)}`;
  elements.nativeLastText.textContent = diagnostics.sourceText || diagnostics.overlayText || "-";
}

function renderPageDiagnostics(diagnostics) {
  const loaded = diagnostics.nativeSuppressorLoaded && diagnostics.contentLoaded;
  const hideReason = diagnostics.hideNativeSubtitles === "true"
    ? "隐藏中"
    : getNativeHideOffReason(diagnostics);
  elements.pageControlText.textContent = loaded
    ? `已接管 / ${hideReason}`
    : "部分接管";
  const nativeCount = Number(diagnostics.nativeHiddenCount || 0);
  const contentCount = Number(diagnostics.contentNativeHiddenCount || 0);
  elements.nativeHitText.textContent = `${nativeCount}/${contentCount} ${formatNativeDiagnostics(diagnostics)}`;
  elements.buildText.textContent = [
    diagnostics.buildId || "content?",
    diagnostics.nativeSuppressorBuildId || "suppressor?",
    diagnostics.textTrackGuardBuildId || "track?"
  ].join(" / ");
  const lastText =
    diagnostics.contentNativeLastHiddenText ||
    diagnostics.nativeLastHiddenText ||
    diagnostics.overlayText ||
    "-";
  elements.nativeLastText.textContent = lastText;
}

function formatNativeDiagnostics(diagnostics) {
  const mask = diagnostics.nativeMaskRect || {};
  const playerMask = diagnostics.nativePlayerMaskRect || {};
  const tracks = diagnostics.textTrackDiagnostics || {};
  const guardCount = Number(diagnostics.textTrackGuardBlockedCount || 0);
  const guardText = diagnostics.textTrackGuardLoaded
    ? `guard:${guardCount}/${diagnostics.textTrackGuardAddTrack || "add?"}`
    : `guard:${diagnostics.textTrackGuardStatus || "off"}`;
  const maskText = mask.present
    ? `mask:${mask.width || 0}x${mask.height || 0}`
    : "mask:off";
  const playerMaskText = playerMask.present
    ? `pmask:${playerMask.width || 0}x${playerMask.height || 0}`
    : "pmask:off";
  return `${guardText} ${maskText} ${playerMaskText} tt:${tracks.hidden || 0}/${tracks.showing || 0}/${tracks.total || 0}`;
}

function getNativeHideOffReason(diagnostics) {
  if (diagnostics.nativeHideReason === "plugin-disabled") return "插件暂停";
  if (diagnostics.nativeHideReason === "replace-native-forced") return "强制隐藏";
  if (diagnostics.nativeHideReason === "hide-native-disabled") return "隐藏开关关闭";
  if (diagnostics.settingsEnabled === "false") return "插件暂停";
  if (diagnostics.settingsHideNativeSubtitles === "false") return "隐藏开关关闭";
  return "未隐藏";
}

async function toggleEnabled() {
  if (elements.enabledToggle.checked) {
    await prehideActiveSupportedTab();
  }

  const settingsResponse = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
  if (!settingsResponse || !settingsResponse.ok) {
    showStatus("读取设置失败", true);
    return;
  }

  const saveResponse = await chrome.runtime.sendMessage({
    type: "SAVE_SETTINGS",
    settings: {
      ...settingsResponse.settings,
      enabled: elements.enabledToggle.checked
    }
  });

  if (!saveResponse || !saveResponse.ok) {
    showStatus("保存状态失败", true);
    return;
  }

  await loadStatus();
  showStatus(elements.enabledToggle.checked ? "已启用" : "已暂停");
}

async function prehideActiveSupportedTab() {
  if (!chrome.scripting || !chrome.scripting.executeScript || !chrome.scripting.insertCSS) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const platform = tab && tab.url ? getSupportedPlatform(tab.url) : "";
  if (!tab || !tab.id || !platform) return;

  if (platform === "youtube") {
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ["src/youtube-overlay.css"]
    }).catch(() => {});
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["src/content-youtube.js"]
    }).catch(() => {});
    await chrome.tabs.sendMessage(tab.id, { type: "PREHIDE_NATIVE_SUBTITLES" }).catch(() => {});
    return;
  }

  if (!tab.url.startsWith("https://www.netflix.com/watch/")) return;

  await chrome.scripting.insertCSS({
    target: { tabId: tab.id },
    files: ["src/overlay.css"]
  }).catch(() => {});

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      if (!/^\/watch\//.test(location.pathname)) return;
      document.documentElement.dataset.ndstHideNativeSubtitles = "true";
      document.documentElement.dataset.ndstNativeMask = "true";
      try {
        window.dispatchEvent(new Event("ndst-texttrack-guard-sync"));
      } catch (error) {
        // Ignore dispatch failures in restricted worlds.
      }
    }
  }).catch(() => {});

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["src/texttrack-guard-main.js"],
    world: "MAIN"
  }).catch(() => {});

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["src/native-suppressor.js"]
  }).catch(() => {});

  const prehideResponse = await chrome.tabs.sendMessage(tab.id, {
    type: "PREHIDE_NATIVE_SUBTITLES",
    durationMs: 5000
  }).catch(() => null);

  if (!prehideResponse || !prehideResponse.ok) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["src/content-netflix.js"]
    }).catch(() => {});
    await delay(80);
    await chrome.tabs.sendMessage(tab.id, {
      type: "PREHIDE_NATIVE_SUBTITLES",
      durationMs: 5000
    }).catch(() => {});
  }
}

function openOptions() {
  chrome.runtime.openOptionsPage();
}

async function openPretranslate() {
  const videoKey = await getActiveVideoKey();
  const pageUrl = videoKey
    ? chrome.runtime.getURL(`src/pretranslate.html?videoKey=${encodeURIComponent(videoKey)}`)
    : chrome.runtime.getURL("src/pretranslate.html");
  await chrome.tabs.create({ url: pageUrl });
}

async function getActiveVideoKey() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) return "";

  try {
    const url = new URL(tab.url);
    if (url.hostname === "www.netflix.com") {
      const match = url.pathname.match(/\/watch\/(\d+)/);
      return match ? `netflix-${match[1]}` : "";
    }
    if (url.hostname === "www.youtube.com") {
      if (url.pathname === "/watch") {
        const id = url.searchParams.get("v");
        return id ? `youtube-${id}` : "";
      }
      const match = url.pathname.match(/^\/(?:shorts|live)\/([^/?#]+)/);
      return match ? `youtube-${match[1]}` : "";
    }
    return "";
  } catch (error) {
    return "";
  }
}

function getSupportedPlatform(urlValue) {
  try {
    const url = new URL(urlValue);
    if (url.protocol !== "https:") return "";
    if (url.hostname === "www.netflix.com") return "netflix";
    if (url.hostname === "www.youtube.com") return "youtube";
    return "";
  } catch (error) {
    return "";
  }
}

async function clearCurrentOverlay() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const platform = tab && tab.url ? getSupportedPlatform(tab.url) : "";
  if (!tab || !tab.id || !platform) {
    showStatus("请先切换到 Netflix 或 YouTube 页面", true);
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { type: "CLEAR_OVERLAY" });
    showStatus("当前页面字幕已清空");
  } catch (error) {
    showStatus(`当前 ${platform === "youtube" ? "YouTube" : "Netflix"} 页面未加载内容脚本`, true);
  }
}

function showStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle("error", isError);
}
