"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, "0.2.0");
assert.deepEqual(
  [...manifest.host_permissions].sort(),
  [
    "https://api.deepseek.com/*",
    "https://www.netflix.com/*",
    "https://www.youtube.com/*"
  ]
);
assert.equal(manifest.host_permissions.includes("<all_urls>"), false);

const netflixEntries = manifest.content_scripts.filter((entry) =>
  entry.matches.includes("https://www.netflix.com/*")
);
assert.equal(netflixEntries.length, 2);
assert.deepEqual(netflixEntries[0].js, ["src/texttrack-guard-main.js"]);
assert.deepEqual(netflixEntries[1].js, ["src/native-suppressor.js", "src/content-netflix.js"]);
assert.deepEqual(netflixEntries[1].css, ["src/overlay.css"]);
assert.equal(netflixEntries.some((entry) => entry.js.some((file) => file.includes("youtube"))), false);

const youtubeEntries = manifest.content_scripts.filter((entry) =>
  entry.matches.includes("https://www.youtube.com/*")
);
assert.equal(youtubeEntries.length, 1);
assert.deepEqual(youtubeEntries[0].js, ["src/content-youtube.js"]);
assert.deepEqual(youtubeEntries[0].css, ["src/youtube-overlay.css"]);
assert.equal(youtubeEntries[0].run_at, "document_start");

console.log("platform manifest regression test passed");
