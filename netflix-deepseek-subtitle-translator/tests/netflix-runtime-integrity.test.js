"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const expected = {
  "src/content-netflix.js": "eda7024b440fb0b3af4ea771383fa0ca703315fe047983119b0a880ddce1a62e",
  "src/native-suppressor.js": "9f7399f7f506ebe13f853c78587e356c34f8f8e9f9ff4c9ef652699c15c2aa79",
  "src/texttrack-guard-main.js": "69580f39cf3228e0145e1477f17b74d74253b0e29baaca3bb139a6fa8b2f85a0",
  "src/overlay.css": "6e1e5db915f2502fa83e145c39c85cc621de04768c7b26759391daacbcd8811f"
};

for (const [relativePath, expectedHash] of Object.entries(expected)) {
  const bytes = fs.readFileSync(path.join(__dirname, "..", relativePath));
  const actualHash = crypto.createHash("sha256").update(bytes).digest("hex");
  assert.equal(actualHash, expectedHash, `${relativePath} changed unexpectedly`);
}

console.log("netflix runtime integrity test passed");
