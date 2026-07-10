"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "src", "pretranslate.js"), "utf8");

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

const sandbox = {};
vm.runInNewContext([
  extractFunction("normalizeCueSourceText"),
  extractFunction("buildExistingTranslationMap"),
  extractFunction("getReusableTranslation"),
  "globalThis.helpers = { buildExistingTranslationMap, getReusableTranslation };"
].join("\n"), sandbox);

const existing = sandbox.helpers.buildExistingTranslationMap([
  { cueId: "1", sourceText: "Hello   there", translation: "你好" }
]);
assert.equal(sandbox.helpers.getReusableTranslation({ id: "1", sourceText: "Hello there" }, existing), "你好");
assert.equal(sandbox.helpers.getReusableTranslation({ id: "1", sourceText: "Different subtitle" }, existing), "");
assert.equal(sandbox.helpers.getReusableTranslation({ id: "2", sourceText: "Hello there" }, existing), "");

console.log("pretranslate resume regression test passed");
