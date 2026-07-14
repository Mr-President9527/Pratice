"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const expected = {
  "src/content-netflix.js": "6d1418ea34deaac665157907158656e8654cc49d2614aebdfe929dcc8d85c345",
  "src/native-suppressor.js": "9f7399f7f506ebe13f853c78587e356c34f8f8e9f9ff4c9ef652699c15c2aa79",
  "src/texttrack-guard-main.js": "c6bf7726d25a35822c7fcb462eb5e4c3707ac585d67418015800d7e016d38e6d",
  "src/overlay.css": "6e1e5db915f2502fa83e145c39c85cc621de04768c7b26759391daacbcd8811f"
};

for (const [relativePath, expectedHash] of Object.entries(expected)) {
  const bytes = fs.readFileSync(path.join(__dirname, "..", relativePath));
  const actualHash = crypto.createHash("sha256").update(bytes).digest("hex");
  assert.equal(actualHash, expectedHash, `${relativePath} changed unexpectedly`);
}

console.log("netflix runtime integrity test passed");
