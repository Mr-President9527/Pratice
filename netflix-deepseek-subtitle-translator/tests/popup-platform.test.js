"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "src", "popup.js"), "utf8");
const backgroundSource = fs.readFileSync(path.join(__dirname, "..", "src", "background.js"), "utf8");
const contentSource = fs.readFileSync(path.join(__dirname, "..", "src", "content-netflix.js"), "utf8");
const guardSource = fs.readFileSync(path.join(__dirname, "..", "src", "texttrack-guard-main.js"), "utf8");

function extractFunction(name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `missing ${name}`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`unterminated ${name}`);
}

const sandbox = { URL };
vm.runInNewContext([
  extractFunction("getSupportedPlatform"),
  "globalThis.getPlatform = getSupportedPlatform;"
].join("\n"), sandbox);

assert.equal(sandbox.getPlatform("https://www.netflix.com/watch/123"), "netflix");
assert.equal(sandbox.getPlatform("https://www.youtube.com/watch?v=abc"), "youtube");
assert.equal(sandbox.getPlatform("https://m.youtube.com/watch?v=abc"), "");
assert.equal(sandbox.getPlatform("https://example.com/watch/123"), "");
assert.match(source, /src\/content-youtube\.js/);
assert.match(source, /src\/content-netflix\.js/);
assert.match(source, /CONTENT_BUILD_ID = "2026-07-14-hint-1"/);
assert.match(source, /TEXTTRACK_GUARD_BUILD_ID = "2026-07-14-hint-1"/);
assert.match(backgroundSource, /CONTENT_BUILD_ID = "2026-07-14-hint-1"/);
assert.match(backgroundSource, /TEXTTRACK_GUARD_BUILD_ID = "2026-07-14-hint-1"/);
assert.match(contentSource, /BUILD_ID = "2026-07-14-hint-1"/);
assert.match(guardSource, /BUILD_ID = "2026-07-14-hint-1"/);

console.log("popup platform regression test passed");
