import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PRIORITY,
  blacklistModel,
  chooseNext,
  createBlacklist,
  createClock,
  createRuntime,
  isLocalExhaustion,
  isQuotaError,
  modelKey,
  orderedCandidates,
  shouldFallback,
} from "./lib.js";

const OPTIONS = { providers: ["opencode"] };

function fakeModels(keys = DEFAULT_PRIORITY) {
  return keys.map((key) => {
    const [providerID, id] = key.split("/");
    return {
      providerID,
      id,
      enabled: true,
      status: "active",
      capabilities: { tools: true },
      cost: [{ input: 0, output: 0, cache: { read: 0, write: 0 } }],
      limit: { context: 128000, output: 8192 },
    };
  });
}

function quotaEvent(currentKey, attempt = 2) {
  const [providerID, id] = (currentKey ?? "").split("/");
  return {
    sessionID: "ses_test",
    model: currentKey ? { providerID, id } : undefined,
    attempt,
    error: { type: "provider.quota", message: "quota exceeded" },
  };
}

test("rotates to the next model and wraps around the list", () => {
  const runtime = createRuntime(createBlacklist(), createClock(0));
  const models = fakeModels();
  const order = [];
  let current = "opencode/beam-free";

  for (let step = 0; step < DEFAULT_PRIORITY.length; step += 1) {
    const result = chooseNext(models, quotaEvent(current), OPTIONS, runtime);
    assert.ok(result.model, "a model is selected");
    assert.equal(result.reason, "round-robin");
    order.push(modelKey(result.model));
    current = order[order.length - 1];
  }

  assert.deepEqual(order, [
    ...DEFAULT_PRIORITY.slice(7),
    ...DEFAULT_PRIORITY.slice(0, 7),
  ]);
});

test("a full sweep visits every model exactly once", () => {
  const runtime = createRuntime(createBlacklist(), createClock(0));
  const models = fakeModels();
  const seen = new Set();
  let current = "opencode/deepseek-v4.1-flash-free";

  for (let step = 0; step < DEFAULT_PRIORITY.length; step += 1) {
    const result = chooseNext(models, quotaEvent(current), OPTIONS, runtime);
    seen.add(modelKey(result.model));
    current = modelKey(result.model);
  }

  assert.equal(seen.size, DEFAULT_PRIORITY.length);
});

test("skips a blacklisted model and keeps the rotation moving", () => {
  const clock = createClock(0);
  const blacklist = createBlacklist();
  const runtime = createRuntime(blacklist, clock);
  const models = fakeModels();

  blacklistModel(blacklist, "opencode/glm-5.3-flash-free", 60_000, clock.now());

  const result = chooseNext(
    models,
    quotaEvent("opencode/deepseek-v4.1-flash-free"),
    OPTIONS,
    runtime,
  );
  assert.equal(modelKey(result.model), "opencode/minimax-m3.1-flash-free");
});

test("a blacklisted model returns to the rotation once its ttl expires", () => {
  const clock = createClock(0);
  const blacklist = createBlacklist();
  const models = fakeModels();

  blacklistModel(blacklist, "opencode/glm-5.3-flash-free", 60_000, clock.now());

  const blocked = chooseNext(
    models,
    quotaEvent("opencode/deepseek-v4.1-flash-free"),
    OPTIONS,
    createRuntime(blacklist, clock),
  );
  assert.equal(modelKey(blocked.model), "opencode/minimax-m3.1-flash-free");

  clock.advance(60_001);

  const recovered = chooseNext(
    models,
    quotaEvent("opencode/deepseek-v4.1-flash-free"),
    OPTIONS,
    createRuntime(blacklist, clock),
  );
  assert.equal(modelKey(recovered.model), "opencode/glm-5.3-flash-free");
});

test("a repeated failure does not push the ttl further out", () => {
  const clock = createClock(0);
  const blacklist = createBlacklist();

  blacklistModel(blacklist, "opencode/deepseek-v4.1-flash-free", 60_000, clock.now());
  clock.advance(30_000);
  blacklistModel(blacklist, "opencode/deepseek-v4.1-flash-free", 60_000, clock.now());

  assert.equal(blacklist.get("opencode/deepseek-v4.1-flash-free"), 60_000);
});

test("waits instead of failing when every model is quota-blocked", () => {
  const clock = createClock(0);
  const blacklist = createBlacklist();
  const runtime = createRuntime(blacklist, clock);
  const models = fakeModels();

  for (const key of DEFAULT_PRIORITY) {
    blacklistModel(blacklist, key, 30 * 60_000, clock.now());
  }

  const result = chooseNext(
    models,
    quotaEvent("opencode/deepseek-v4.1-flash-free"),
    { ...OPTIONS, maxWaitMs: 900_000 },
    runtime,
  );

  assert.equal(result.model, null);
  assert.equal(result.reason, "all-blacklisted");
  assert.ok(result.waitMs > 0);
  assert.ok(result.waitMs <= 900_000);
});

test("follows an external model switch", () => {
  const runtime = createRuntime(createBlacklist(), createClock(0));
  const models = fakeModels();

  const first = chooseNext(
    models,
    quotaEvent("opencode/deepseek-v4.1-flash-free"),
    OPTIONS,
    runtime,
  );
  assert.equal(modelKey(first.model), "opencode/glm-5.3-flash-free");
  runtime.state.from = "opencode/deepseek-v4.1-flash-free";
  runtime.state.last = modelKey(first.model);

  const second = chooseNext(
    models,
    quotaEvent("opencode/iceman-free"),
    OPTIONS,
    runtime,
  );
  assert.equal(modelKey(second.model), "opencode/big-pickle");
});

test("keeps advancing when a model switch did not take effect", () => {
  const runtime = createRuntime(createBlacklist(), createClock(0));
  const models = fakeModels();

  const first = chooseNext(
    models,
    quotaEvent("opencode/deepseek-v4.1-flash-free"),
    OPTIONS,
    runtime,
  );
  runtime.state.from = "opencode/deepseek-v4.1-flash-free";
  runtime.state.last = modelKey(first.model);

  const second = chooseNext(
    models,
    quotaEvent("opencode/deepseek-v4.1-flash-free"),
    OPTIONS,
    runtime,
  );
  assert.equal(modelKey(second.model), "opencode/minimax-m3.1-flash-free");
});

test("the static strategy keeps the previous first-candidate behavior", () => {
  const runtime = createRuntime(createBlacklist(), createClock(0));
  const models = fakeModels();

  const result = chooseNext(
    models,
    quotaEvent("opencode/beam-free"),
    { ...OPTIONS, strategy: "static" },
    runtime,
  );
  assert.equal(modelKey(result.model), "opencode/deepseek-v4.1-flash-free");
});

test("the curated order comes first, the rest is appended", () => {
  const models = fakeModels([...DEFAULT_PRIORITY, "opencode/zzz-extra-free"]);
  const candidates = orderedCandidates(models, OPTIONS);

  assert.equal(candidates.length, DEFAULT_PRIORITY.length + 1);
  assert.deepEqual(
    candidates.slice(0, DEFAULT_PRIORITY.length).map(modelKey),
    DEFAULT_PRIORITY,
  );
  assert.equal(modelKey(candidates[DEFAULT_PRIORITY.length]), "opencode/zzz-extra-free");
});

test("paid models never enter the rotation", () => {
  const models = fakeModels();
  models.push({
    providerID: "opencode",
    id: "paid-model",
    enabled: true,
    cost: [{ input: 1, output: 1 }],
    limit: { context: 128000 },
  });

  const candidates = orderedCandidates(models, OPTIONS);
  assert.ok(!candidates.some((model) => model.id === "paid-model"));
});

test("models from other providers are ignored", () => {
  const models = fakeModels();
  models.push({
    providerID: "mochi",
    id: "v4.1flash",
    enabled: true,
    cost: [{ input: 0, output: 0 }],
    limit: { context: 128000 },
  });

  const candidates = orderedCandidates(models, OPTIONS);
  assert.ok(!candidates.some((model) => model.providerID === "mochi"));
});

test("detects quota failures by type and by wording", () => {
  assert.ok(isQuotaError({ error: { type: "provider.quota", message: "" } }));
  assert.ok(isQuotaError({ error: { type: "provider.free-limit", message: "" } }));
  assert.ok(isQuotaError({ error: { type: "provider.budget-limit", message: "" } }));
  assert.ok(
    isQuotaError({
      error: { type: "provider.unknown", message: "You exceeded your current quota" },
    }),
  );
  assert.ok(
    isQuotaError({
      error: {
        type: "provider.unknown",
        response: { body: '{"error":"insufficient credits"}' },
      },
    }),
  );
  assert.ok(!isQuotaError({ error: { type: "provider.transport", message: "reset" } }));
});

test("rate limits only trigger a fallback when they are enabled", () => {
  const event = {
    error: { type: "provider.rate-limit", message: "too many requests" },
    attempt: 5,
  };

  assert.equal(shouldFallback(event, { includeRateLimit: false }), false);
  assert.equal(
    shouldFallback(event, { includeRateLimit: true, rateLimitAttempts: 3 }),
    true,
  );
  assert.equal(
    shouldFallback(event, { includeRateLimit: true, rateLimitAttempts: 9 }),
    false,
  );
});

test("a local model with an empty token pool triggers a fallback", () => {
  const event = {
    sessionID: "ses_test",
    model: { providerID: "mochi", id: "v4.1flash" },
    attempt: 2,
    error: {
      type: "provider.internal",
      message: "No active tokens available",
    },
  };

  assert.ok(isLocalExhaustion(event));
  assert.equal(shouldFallback(event, {}), true);
});

test("an unrelated provider-internal error does not trigger a fallback", () => {
  const event = {
    sessionID: "ses_test",
    model: { providerID: "mochi", id: "v4.1flash" },
    attempt: 2,
    error: { type: "provider.internal", message: "upstream connection reset" },
  };

  assert.ok(!isLocalExhaustion(event));
  assert.equal(shouldFallback(event, {}), false);
});

test("falling back from the local model starts at the first candidate", () => {
  const runtime = createRuntime(createBlacklist(), createClock(0));
  const models = fakeModels();

  const result = chooseNext(
    models,
    {
      sessionID: "ses_test",
      model: { providerID: "mochi", id: "v4.1flash" },
      attempt: 2,
      error: { type: "provider.internal", message: "No active tokens available" },
    },
    OPTIONS,
    runtime,
  );

  assert.equal(modelKey(result.model), DEFAULT_PRIORITY[0]);
});
