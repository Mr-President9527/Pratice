"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class FakeTextTrack {
  constructor(mode = "disabled") {
    this._mode = mode;
    this.kind = "subtitles";
    this.activeCues = [{ text: "Readable cue" }];
  }

  addEventListener() {}
}

Object.defineProperty(FakeTextTrack.prototype, "mode", {
  configurable: true,
  enumerable: true,
  get() {
    return this._mode;
  },
  set(value) {
    this._mode = value;
  }
});

class FakeMediaElement {
  addTextTrack() {
    return new FakeTextTrack();
  }
}

const track = new FakeTextTrack("showing");
const video = { textTracks: [track] };
const documentEvents = new Map();
const windowEvents = new Map();
const styles = new Map();
const root = {
  dataset: {},
  appendChild(element) {
    if (element.id) styles.set(element.id, element);
  }
};

const document = {
  documentElement: root,
  head: root,
  readyState: "complete",
  createElement() {
    return { dataset: {}, id: "", textContent: "" };
  },
  getElementById(id) {
    return styles.get(id) || null;
  },
  querySelectorAll(selector) {
    if (selector === "video") return [video];
    return [];
  },
  addEventListener(type, listener) {
    documentEvents.set(type, listener);
  }
};

const context = {
  console,
  document,
  location: { pathname: "/watch/123" },
  TextTrack: FakeTextTrack,
  HTMLMediaElement: FakeMediaElement,
  MutationObserver: class {
    observe() {}
    disconnect() {}
  },
  Node: { ELEMENT_NODE: 1 },
  setTimeout() { return 1; },
  clearTimeout() {},
  addEventListener(type, listener) {
    windowEvents.set(type, listener);
  }
};
context.window = context;

const guardPath = path.join(__dirname, "..", "src", "texttrack-guard-main.js");
vm.runInNewContext(fs.readFileSync(guardPath, "utf8"), context, { filename: guardPath });

assert.equal(track.mode, "hidden", "an already-showing subtitle track should be hidden immediately");
assert.equal(track.activeCues[0].text, "Readable cue", "active cues must remain readable while hidden");
assert.equal(root.dataset.ndstTextTrackGuardEnabledCount, "1");

track.mode = "showing";
assert.equal(track.mode, "hidden", "later attempts to show native subtitles should be intercepted");
assert.ok(Number(root.dataset.ndstTextTrackGuardBlockedCount) >= 1);

root.dataset.ndstHideNativeSubtitles = "false";
windowEvents.get("ndst-texttrack-guard-sync")();
assert.equal(track.mode, "showing", "turning native subtitle hiding off should restore the track");
assert.equal(root.dataset.ndstTextTrackGuardEnabledCount, "1");

track.mode = "disabled";
assert.equal(root.dataset.ndstTextTrackGuardEnabledCount, "0");

console.log("texttrack guard regression test passed");
