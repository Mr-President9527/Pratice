"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const contentSource = fs.readFileSync(path.join(__dirname, "..", "src", "content-youtube.js"), "utf8");
const cssSource = fs.readFileSync(path.join(__dirname, "..", "src", "youtube-overlay.css"), "utf8");

function extractFunction(name) {
  const start = contentSource.indexOf(`function ${name}`);
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

const textSandbox = {};
vm.runInNewContext([
  "const MAX_SUBTITLE_LENGTH = 240;",
  extractFunction("normalizeSubtitleText"),
  extractFunction("mergeCaptionSegments"),
  extractFunction("getSubtitleClearDelayMs"),
  "globalThis.helpers = { normalizeSubtitleText, mergeCaptionSegments, getSubtitleClearDelayMs };"
].join("\n"), textSandbox);

assert.equal(textSandbox.helpers.normalizeSubtitleText("  Hello\u200b   world \n next line "), "Hello world\nnext line");
assert.equal(textSandbox.helpers.mergeCaptionSegments(["Hello", "world"]), "Hello\nworld");
assert.equal(textSandbox.helpers.getSubtitleClearDelayMs("Hi"), 280);
assert.equal(textSandbox.helpers.getSubtitleClearDelayMs("This is a longer subtitle line for testing"), 500);

const cueSandbox = {
  state: {
    settings: { subtitleOffsetMs: 0 },
    pretranslatedCues: [
      { id: "1", start: 1, end: 2 },
      { id: "2", start: 5, end: 6 },
      { id: "3", start: 9, end: 10 }
    ]
  }
};
vm.runInNewContext([
  extractFunction("getPretranslatedCueByCurrentTime"),
  "globalThis.getCue = getPretranslatedCueByCurrentTime;"
].join("\n"), cueSandbox);
assert.equal(cueSandbox.getCue(5.5).id, "2");
assert.equal(cueSandbox.getCue(7), null);

assert.match(contentSource, /\.ytp-caption-segment/);
assert.match(contentSource, /state\.observer\.observe\(player/);
assert.doesNotMatch(contentSource, /querySelectorAll\(["']span, div, p["']\)/);
assert.match(cssSource, /opacity:\s*0\s*!important/);
assert.match(cssSource, /visibility:\s*hidden\s*!important/);
assert.match(cssSource, /background:\s*transparent\s*!important/);
assert.doesNotMatch(cssSource, /display:\s*none\s*!important[\s\S]*ytp-caption/);

console.log("youtube content regression test passed");
