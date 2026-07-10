"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const sandbox = { self: {} };
const source = fs.readFileSync(path.join(__dirname, "..", "src", "subtitle-parser.js"), "utf8");
vm.runInNewContext(source, sandbox);
const parser = sandbox.self.NDSTSubtitleParser;

const srt = parser.parseSubtitleFile(
  "\uFEFF1\r\n00:00:01,250 --> 00:00:03,500\r\nHello\r\nworld\r\n\r\n2\r\n00:01:00.000 --> 00:01:02.000\r\nGoodbye",
  "episode.srt"
);
assert.equal(srt.length, 2);
assert.equal(srt[0].start, 1.25);
assert.equal(srt[0].end, 3.5);
assert.equal(srt[0].sourceText, "Hello\nworld");
assert.equal(srt[1].start, 60);

const vtt = parser.parseSubtitleFile(
  "WEBVTT\n\ncue-a\n00:00.500 --> 00:02.000 align:start\n<i>Styled</i> text",
  "episode.vtt"
);
assert.equal(vtt.length, 1);
assert.equal(vtt[0].id, "cue-a");
assert.equal(vtt[0].start, 0.5);
assert.equal(vtt[0].sourceText, "Styled text");

console.log("subtitle parser regression test passed");
