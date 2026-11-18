// Pure selection logic for quota-fallback. Kept separate from the plugin entry so
// it can be exercised without the OpenCode runtime.

export const DEFAULT_PROVIDERS = ["opencode", "opencode-go"];

// Preferred order for coding. Any model that is unavailable or no longer free is
// skipped, and any other zero-cost model from an allowed provider is appended.
export const DEFAULT_PRIORITY = [
  "opencode/deepseek-v4.1-flash-free",
  "opencode/glm-5.3-flash-free",
  "opencode/minimax-m3.1-flash-free",
  "opencode/flint-40b-free",
  "opencode/mimo-v2.6-flash-free",
  "opencode/longcat-2.5-free",
  "opencode/beam-free",
  "opencode/nemotron-3.5-lightning-free",
  "opencode/inkling-2-small-free",
  "opencode/nemotron-3.5-super-vl-free",
  "opencode/iceman-free",
  "opencode/big-pickle",
];

// OpenCode reports exhausted quota, credits, and plan budgets under these types.
export const QUOTA_ERROR_TYPES = new Set([
  "provider.quota",
  "provider.free-limit",
  "provider.budget-limit",
  "provider.go-limit",
  "provider.model-budget-limit",
  "provider.chatgpt-limit",
]);

// Match quota/billing wording even when a proxy reports it as a generic 429 or
// 402 instead of the provider.quota error type.
export const QUOTA_PATTERN =
  /quota|insufficient[-_\s]?(?:quota|balance|credit|funds)|credit[-_\s]?limit|usage[-_\s]?limit|billing|budget[-_\s]?(?:exceeded|limit)|spend(?:ing)?[-_\s]?limit|limit[-_\s]?(?:reached|exhausted)|out of credits|plan has expired|free usage|payment required/i;

// Local model daemons (deeperseeker-rs / Mochi) drain a pool of upstream tokens
// and report an empty pool as a provider-internal failure instead of a quota
// error. The wording is distinctive, so treat it as exhaustion and rotate away.
export const LOCAL_EXHAUSTION_PATTERN = /no active tokens/i;

export const ROUND_ROBIN = "round-robin";
export const STATIC = "static";
export const DEFAULT_STRATEGY = ROUND_ROBIN;
export const DEFAULT_BLACKLIST_MINUTES = 30;
export const DEFAULT_MAX_WAIT_MS = 15 * 60 * 1000;
export const DEFAULT_DELAY_MS = 500;

export function asPositiveNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : fallback;
}

export function modelKey(model) {
  if (!model || typeof model.providerID !== "string" || typeof model.id !== "string") {
    return "";
  }
  return `${model.providerID}/${model.id}`;
}

export function isZeroCost(model) {
  if (!Array.isArray(model.cost) || model.cost.length === 0) return false;
  return model.cost.every(
    (tier) =>
      (tier.input ?? 0) === 0 &&
      (tier.output ?? 0) === 0 &&
      (tier.cache?.read ?? 0) === 0 &&
      (tier.cache?.write ?? 0) === 0,
  );
}

export function isEligible(model, providers) {
  if (!providers.includes(model.providerID)) return false;
  if (model.enabled === false) return false;
  if (model.status && model.status !== "active" && model.status !== "beta") {
    return false;
  }
  // A free model without tool support cannot continue an autonomous agent loop.
  if (model.capabilities && model.capabilities.tools === false) return false;
  return isZeroCost(model);
}

export function errorText(error) {
  return [error?.message, error?.response?.body]
    .filter((part) => typeof part === "string")
    .join(" ");
}

export function isQuotaError(event) {
  const error = event.error ?? {};
  if (QUOTA_ERROR_TYPES.has(error.type)) return true;
  return QUOTA_PATTERN.test(errorText(error));
}

// A local model whose token pool is empty cannot make progress and will keep
// answering with the same provider-internal error, so it is treated as exhausted.
export function isLocalExhaustion(event) {
  return LOCAL_EXHAUSTION_PATTERN.test(errorText(event?.error));
}

export function shouldFallback(event, options = {}) {
  if (isQuotaError(event)) return true;
  if (isLocalExhaustion(event)) return true;

  const error = event.error ?? {};
  if (options.includeRateLimit === true && error.type === "provider.rate-limit") {
    const threshold = asPositiveNumber(options.rateLimitAttempts, 3);
    return event.attempt >= threshold;
  }

  return false;
}

function rank(models, priority) {
  const order = new Map(priority.map((id, index) => [id, index]));
  return [...models].sort((a, b) => {
    const aRank = order.get(modelKey(a)) ?? Number.MAX_SAFE_INTEGER;
    const bRank = order.get(modelKey(b)) ?? Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    const byContext = (b.limit?.context ?? 0) - (a.limit?.context ?? 0);
    if (byContext !== 0) return byContext;
    return modelKey(a).localeCompare(modelKey(b));
  });
}

// The rotation order: the curated list first, then every other zero-cost model.
export function orderedCandidates(models, options = {}) {
  const providers =
    Array.isArray(options.providers) && options.providers.length > 0
      ? options.providers
      : DEFAULT_PROVIDERS;
  const explicit =
    Array.isArray(options.fallbackModels) && options.fallbackModels.length > 0
      ? options.fallbackModels
      : DEFAULT_PRIORITY;

  const eligible = models.filter((model) => isEligible(model, providers));
  const explicitSet = new Set(explicit);
  const preferred = eligible.filter((model) => explicitSet.has(modelKey(model)));
  const rest = eligible.filter((model) => !explicitSet.has(modelKey(model)));
  return [...rank(preferred, explicit), ...rank(rest, DEFAULT_PRIORITY)];
}

export function strategyOf(options = {}) {
  return options.strategy === STATIC ? STATIC : DEFAULT_STRATEGY;
}

export function createSessionState() {
  return { cursor: -1, seeded: false, from: undefined, last: undefined };
}

export function createBlacklist() {
  return new Map();
}

export function createClock(start = Date.now()) {
  let current = start;
  return {
    now: () => current,
    advance(ms) {
      current += ms;
      return current;
    },
  };
}

export function createRuntime(blacklist = createBlacklist(), clock = createClock()) {
  return { state: createSessionState(), blacklist, clock };
}

export function pruneBlacklist(blacklist, now) {
  for (const [key, expiresAt] of blacklist) {
    if (expiresAt <= now) blacklist.delete(key);
  }
}

// The TTL runs from the first failure: a model that keeps failing does not push
// its own expiry further out.
export function blacklistModel(blacklist, key, ttlMs, now) {
  if (!key) return;
  const existing = blacklist.get(key);
  if (existing !== undefined && existing > now) return;
  blacklist.set(key, now + ttlMs);
}

export function blacklistTtlMs(options = {}) {
  const minutes = asPositiveNumber(options.blacklistMinutes, DEFAULT_BLACKLIST_MINUTES);
  return Math.round(minutes * 60_000);
}

// How long to hold the step when every candidate is quota-blocked.
function waitForBlacklist(blacklist, now, options) {
  let soonest = Infinity;
  for (const expiresAt of blacklist.values()) {
    if (expiresAt > now && expiresAt < soonest) soonest = expiresAt;
  }
  if (!Number.isFinite(soonest)) return 0;
  const cap = asPositiveNumber(options.maxWaitMs, DEFAULT_MAX_WAIT_MS);
  return Math.min(soonest - now, cap);
}

// Picks the next model in a circular rotation. The cursor starts at the session's
// current model and advances one slot per switch, wrapping at the end of the
// list, so every candidate is reached no matter where the rotation began.
export function chooseNext(models, event, options = {}, runtime) {
  const { state, blacklist, clock } = runtime;
  const now = clock.now();
  const candidates = orderedCandidates(models, options);
  if (candidates.length === 0) {
    return { model: null, waitMs: 0, reason: "no-candidates" };
  }

  pruneBlacklist(blacklist, now);
  const current = modelKey(event.model);

  if (strategyOf(options) === STATIC) {
    const model = candidates.find((candidate) => modelKey(candidate) !== current) ?? null;
    return { model, waitMs: 0, reason: model ? "static" : "no-alternative" };
  }

  const movedElsewhere =
    state.seeded && state.last !== current && state.from !== current;
  if (!state.seeded || movedElsewhere) {
    const index = candidates.findIndex((candidate) => modelKey(candidate) === current);
    state.cursor = index >= 0 ? index : -1;
    state.seeded = true;
  }

  const count = candidates.length;
  for (let step = 1; step <= count; step += 1) {
    const index = (state.cursor + step) % count;
    const candidate = candidates[index];
    if (blacklist.has(modelKey(candidate))) continue;
    state.cursor = index;
    return { model: candidate, waitMs: 0, reason: "round-robin" };
  }

  return {
    model: null,
    waitMs: waitForBlacklist(blacklist, now, options),
    reason: "all-blacklisted",
  };
}

export async function pickNextModel(ctx, event, options, runtime) {
  const result = await ctx.model.list();
  const models = Array.isArray(result)
    ? result
    : Array.isArray(result?.data)
      ? result.data
      : [];
  return chooseNext(models, event, options, runtime);
}
