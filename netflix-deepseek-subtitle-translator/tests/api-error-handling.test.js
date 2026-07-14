"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const backgroundPath = path.join(__dirname, "..", "src", "background.js");
const event = { addListener() {} };
let fetchHandler = async () => { throw new Error("fetch handler not configured"); };
let fetchCount = 0;

const chrome = {
  runtime: { onInstalled: event, onStartup: event, onMessage: event },
  webNavigation: {
    onBeforeNavigate: event,
    onCommitted: event,
    onHistoryStateUpdated: event
  },
  storage: {
    local: {
      async get() { return {}; },
      async set() {}
    }
  },
  tabs: { query() {} },
  scripting: null
};

const sandbox = {
  AbortController,
  chrome,
  self: { NDSTPretranslatedStore: {} },
  console,
  setTimeout,
  clearTimeout,
  fetch: async (...args) => {
    fetchCount += 1;
    return fetchHandler(...args);
  }
};

const source = fs.readFileSync(backgroundPath, "utf8")
  .replace('importScripts("pretranslated-store.js");', "")
  .concat(`\n;globalThis.apiHelpers = { requestDeepSeekJson, toUserError };`);
vm.runInNewContext(source, sandbox);

function mockResponse(status, body, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name) {
        return headers[String(name).toLowerCase()] || null;
      }
    },
    async text() { return JSON.stringify(body); }
  };
}

(async () => {
  const { requestDeepSeekJson, toUserError } = sandbox.apiHelpers;
  const payload = {
    model: "deepseek-v4-flash",
    messages: [{ role: "user", content: "Hello" }]
  };

  fetchCount = 0;
  fetchHandler = async () => mockResponse(402, {
    error: { message: "Insufficient Balance" }
  });
  await assert.rejects(
    requestDeepSeekJson(payload, "sk-test", "API"),
    (error) => {
      assert.equal(error.status, 402);
      assert.match(toUserError(error), /余额不足/);
      return true;
    }
  );
  assert.equal(fetchCount, 1, "non-retryable account errors must not be retried");

  fetchCount = 0;
  fetchHandler = async () => {
    if (fetchCount === 1) {
      return mockResponse(503, { error: { message: "Server overloaded" } });
    }
    return mockResponse(200, {
      choices: [{ finish_reason: "stop", message: { content: "你好" } }]
    });
  };
  const recovered = await requestDeepSeekJson(payload, "sk-test", "API");
  assert.equal(recovered.choices[0].message.content, "你好");
  assert.equal(fetchCount, 2, "transient server failures should retry once");

  fetchCount = 0;
  fetchHandler = async () => { throw new TypeError("Failed to fetch"); };
  await assert.rejects(
    requestDeepSeekJson(payload, "sk-test", "API"),
    (error) => {
      assert.match(error.code, /NETWORK_ERROR/);
      assert.match(toUserError(error), /无法连接 DeepSeek API/);
      return true;
    }
  );
  assert.equal(fetchCount, 2, "network failures should retry once");

  assert.match(toUserError({ status: 401, message: "API_REQUEST_FAILED 401" }), /Key 无效/);
  assert.match(toUserError({ status: 429, message: "API_REQUEST_FAILED 429" }), /请求过于频繁/);
  assert.match(toUserError({ status: 503, message: "API_REQUEST_FAILED 503" }), /服务繁忙/);
  assert.match(toUserError({ message: "API_TIMEOUT: request timed out" }), /响应超时/);

  console.log("api error handling regression test passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
