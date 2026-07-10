"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const contentPath = path.join(__dirname, "..", "src", "content-netflix.js");
const contentSource = fs.readFileSync(contentPath, "utf8");

function extractFunction(name) {
  const marker = `function ${name}`;
  const start = contentSource.indexOf(marker);
  assert.notEqual(start, -1, `missing ${name}`);
  const bodyStart = contentSource.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < contentSource.length; index += 1) {
    if (contentSource[index] === "{") depth += 1;
    if (contentSource[index] === "}") depth -= 1;
    if (depth === 0) return contentSource.slice(start, index + 1);
  }
  throw new Error(`unterminated ${name}`);
}

const sandbox = {};
vm.runInNewContext([
  "const MAX_SAME_SUBTITLE_HOLD_MS = 14000;",
  extractFunction("normalizeSubtitleText"),
  extractFunction("isLikelyEpisodeMetadataText"),
  extractFunction("isTrustedRecentlyHiddenSubtitleCandidate"),
  extractFunction("getSubtitleClearDelayMs"),
  extractFunction("getSubtitleMaxHoldMs"),
  "globalThis.helpers = { isLikelyEpisodeMetadataText, isTrustedRecentlyHiddenSubtitleCandidate, getSubtitleClearDelayMs, getSubtitleMaxHoldMs };"
].join("\n"), sandbox);

const {
  isLikelyEpisodeMetadataText,
  isTrustedRecentlyHiddenSubtitleCandidate,
  getSubtitleClearDelayMs,
  getSubtitleMaxHoldMs
} = sandbox.helpers;

assert.equal(
  isLikelyEpisodeMetadataText("关于我转生变成史莱姆这档事 第1集“暴风龙维鲁德拉”"),
  true
);
assert.equal(isLikelyEpisodeMetadataText("第 1 季第 2 集“新的冒险”"), true);
assert.equal(isLikelyEpisodeMetadataText("Extra skill: Sage acquisition successful."), false);

assert.equal(isTrustedRecentlyHiddenSubtitleCandidate({
  className: "player-timedtext-text-container ndst-native-subtitle-hidden",
  dataUia: ""
}), true);
assert.equal(isTrustedRecentlyHiddenSubtitleCandidate({
  className: "default-ltr-iqcdef-cache-1m81c36 ndst-native-subtitle-hidden",
  dataUia: ""
}), false);

assert.equal(getSubtitleClearDelayMs("Hi"), 250);
assert.equal(getSubtitleClearDelayMs("A normal subtitle"), 350);
assert.equal(getSubtitleClearDelayMs("This subtitle is deliberately a little longer"), 550);
assert.equal(getSubtitleMaxHoldMs("Hi"), 8000);
assert.equal(getSubtitleMaxHoldMs("A normal subtitle"), 10000);
assert.equal(getSubtitleMaxHoldMs("This subtitle is deliberately a little longer"), 14000);

assert.match(contentSource, /setInterval\(runLiveRecognitionWatchdog, 350\)/);
assert.match(contentSource, /function runLiveRecognitionWatchdog\(\)[\s\S]*?startObserver\(\)/);
assert.match(contentSource, /if \(!sourceText\)[\s\S]*?scheduleClear\(\)/);
assert.match(contentSource, /cancelScheduledClear\(\)/);
assert.match(contentSource, /advancedSubtitleFallback !== true\) return "";[\s\S]*?findFromRecentlyHiddenNativeSubtitleText/);
assert.match(contentSource, /clearCurrentSubtitleState\(\{ ignoreSourceText: true \}\)/);
assert.doesNotMatch(contentSource, /PENDING_TRANSLATION_GRACE_MS/);

const quiesceSandbox = {
  state: {
    extensionContextInvalidated: false,
    requestSequence: 1,
    pendingSourceText: "cue",
    pendingSubtitleAt: 1,
    liveRecognitionInterval: 1,
    nativeSuppressionInterval: 2,
    pretranslatedTimer: 3,
    locationPollTimer: 4,
    observer: { disconnect() {} },
    nativeSuppressionObserver: { disconnect() {} }
  },
  window: { clearInterval() {}, clearTimeout() {} },
  document: { documentElement: { dataset: {} } },
  clearNativeHideReapplyTimers() {},
  clearNativeHideBurstTimers() {},
  removeNativeTextTrackGuards() {}
};
vm.runInNewContext([
  extractFunction("quiesceInvalidatedExtensionContext"),
  "globalThis.quiesce = quiesceInvalidatedExtensionContext;"
].join("\n"), quiesceSandbox);

assert.equal(quiesceSandbox.quiesce(new Error("Extension context invalidated.")), true);
assert.equal(quiesceSandbox.state.extensionContextInvalidated, true);
assert.equal(quiesceSandbox.state.liveRecognitionInterval, 0);
assert.equal(quiesceSandbox.document.documentElement.dataset.ndstExtensionContext, "invalidated-stopped");
assert.equal(quiesceSandbox.quiesce(new Error("network failed")), false);

console.log("content subtitle recognition regression test passed");
