"use strict";

const fields = {
  enabled: document.getElementById("enabled"),
  hideNativeSubtitles: document.getElementById("hideNativeSubtitles"),
  apiKey: document.getElementById("apiKey"),
  model: document.getElementById("model"),
  targetLanguage: document.getElementById("targetLanguage"),
  displayMode: document.getElementById("displayMode"),
  subtitleSourceMode: document.getElementById("subtitleSourceMode"),
  advancedSubtitleFallback: document.getElementById("advancedSubtitleFallback"),
  fontSize: document.getElementById("fontSize"),
  bottomOffset: document.getElementById("bottomOffset"),
  backgroundOpacity: document.getElementById("backgroundOpacity"),
  scanDebounceMs: document.getElementById("scanDebounceMs"),
  subtitleOffsetMs: document.getElementById("subtitleOffsetMs")
};

const rangeLabels = {
  fontSize: document.getElementById("fontSizeValue"),
  bottomOffset: document.getElementById("bottomOffsetValue"),
  backgroundOpacity: document.getElementById("backgroundOpacityValue"),
  scanDebounceMs: document.getElementById("scanDebounceMsValue"),
  subtitleOffsetMs: document.getElementById("subtitleOffsetMsValue")
};

const form = document.getElementById("options-form");
const statusElement = document.getElementById("status");

document.addEventListener("DOMContentLoaded", loadSettings);
form.addEventListener("submit", saveSettings);
document.getElementById("clearApiKey").addEventListener("click", clearApiKey);
document.getElementById("clearCache").addEventListener("click", clearCache);
document.getElementById("testApi").addEventListener("click", testApi);
document.getElementById("openPretranslate").addEventListener("click", openPretranslate);

for (const fieldName of ["fontSize", "bottomOffset", "backgroundOpacity", "scanDebounceMs", "subtitleOffsetMs"]) {
  fields[fieldName].addEventListener("input", updateRangeLabels);
}

async function loadSettings() {
  const response = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
  if (!response || !response.ok) {
    showStatus("读取设置失败", true);
    return;
  }
  renderSettings(response.settings);
}

function renderSettings(settings) {
  fields.enabled.checked = Boolean(settings.enabled);
  fields.hideNativeSubtitles.checked = settings.hideNativeSubtitles !== false;
  fields.advancedSubtitleFallback.checked = Boolean(settings.advancedSubtitleFallback);
  fields.apiKey.value = settings.apiKey || "";
  fields.model.value = settings.model || "deepseek-v4-flash";
  fields.targetLanguage.value = settings.targetLanguage || "zh-CN";
  fields.displayMode.value = settings.displayMode || "chinese";
  fields.subtitleSourceMode.value = settings.subtitleSourceMode || "live";
  fields.fontSize.value = settings.fontSize || 30;
  fields.bottomOffset.value = settings.bottomOffset || 9;
  fields.backgroundOpacity.value = settings.backgroundOpacity ?? 0;
  fields.scanDebounceMs.value = settings.scanDebounceMs || 250;
  fields.subtitleOffsetMs.value = settings.subtitleOffsetMs || 0;
  updateRangeLabels();
}

async function saveSettings(event) {
  if (event) event.preventDefault();
  const settings = collectSettings();
  const response = await chrome.runtime.sendMessage({
    type: "SAVE_SETTINGS",
    settings
  });
  if (!response || !response.ok) {
    showStatus(response && response.error ? response.error : "保存失败", true);
    return null;
  }
  renderSettings(response.settings);
  showStatus("设置已保存");
  return response.settings;
}

function collectSettings() {
  return {
    enabled: fields.enabled.checked,
    hideNativeSubtitles: fields.hideNativeSubtitles.checked,
    replaceOriginal: fields.hideNativeSubtitles.checked,
    apiKey: fields.apiKey.value.trim(),
    model: fields.model.value,
    targetLanguage: fields.targetLanguage.value,
    displayMode: fields.displayMode.value,
    subtitleSourceMode: fields.subtitleSourceMode.value,
    advancedSubtitleFallback: fields.advancedSubtitleFallback.checked,
    fontSize: Number(fields.fontSize.value),
    bottomOffset: Number(fields.bottomOffset.value),
    backgroundOpacity: Number(fields.backgroundOpacity.value),
    scanDebounceMs: Number(fields.scanDebounceMs.value),
    subtitleOffsetMs: Number(fields.subtitleOffsetMs.value)
  };
}

function clearApiKey() {
  fields.apiKey.value = "";
  showStatus("API Key 已清空，点击保存后生效");
}

async function clearCache() {
  const response = await chrome.runtime.sendMessage({ type: "CLEAR_CACHE" });
  if (!response || !response.ok) {
    showStatus("清空缓存失败", true);
    return;
  }
  showStatus("缓存已清空");
}

async function testApi() {
  const saved = await saveSettings();
  if (!saved) return;
  showStatus("正在测试 API...");
  const response = await chrome.runtime.sendMessage({
    type: "TEST_API",
    sourceText: "Hello, how are you?"
  });
  if (!response || !response.ok) {
    showStatus(response && response.error ? response.error : "API 测试失败", true);
    return;
  }
  showStatus(`测试成功：${response.translation}`);
}

function openPretranslate() {
  window.open(chrome.runtime.getURL("src/pretranslate.html"), "_blank");
}

function updateRangeLabels() {
  rangeLabels.fontSize.textContent = `${fields.fontSize.value}px`;
  rangeLabels.bottomOffset.textContent = `${fields.bottomOffset.value}%`;
  rangeLabels.backgroundOpacity.textContent = Number(fields.backgroundOpacity.value).toFixed(2);
  rangeLabels.scanDebounceMs.textContent = `${fields.scanDebounceMs.value}ms`;
  rangeLabels.subtitleOffsetMs.textContent = `${fields.subtitleOffsetMs.value}ms`;
}

function showStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.classList.toggle("error", isError);
}
