// In-memory rate limiter — per warm serverless instance.
//
// Trade-offs we accept:
//   - Memory is per-lambda. A determined attacker who hits multiple cold
//     instances can exceed the limit. Good enough to defend against runaway
//     scripts, accidental loops, and casual abuse without standing up Redis.
//   - We key by IP from `x-forwarded-for` (Vercel sets this). Fall back to
//     `x-real-ip` then a literal "unknown" bucket.
//   - We use a sliding window via timestamp array — cheap for our request
//     volumes and avoids cron cleanup; old entries get pruned on each check.
//
// Usage:
//   const limit = checkRateLimit(req, "feedback", { limit: 5, windowMs: 60_000 });
//   if (!limit.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

type Bucket = number[]; // timestamps (ms) of recent hits within window

const buckets = new Map<string, Bucket>();

// Hard cap on buckets to bound memory in case of distributed key explosion.
// LRU-ish: when over cap, drop oldest-accessed entries.
const MAX_BUCKETS = 10_000;
const accessOrder: string[] = [];

function touch(key: string) {
  const idx = accessOrder.indexOf(key);
  if (idx !== -1) accessOrder.splice(idx, 1);
  accessOrder.push(key);
  while (accessOrder.length > MAX_BUCKETS) {
    const evict = accessOrder.shift();
    if (evict) buckets.delete(evict);
  }
}

export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export interface RateLimitOpts {
  /** Max hits allowed within the window. */
  limit: number;
  /** Sliding window length in milliseconds. */
  windowMs: number;
  /** Optional extra suffix appended to the bucket key (e.g. user id). */
  extraKey?: string;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** Seconds until the oldest hit in the window expires. 0 if not at limit. */
  retryAfter: number;
}

export function checkRateLimit(
  req: Request,
  scope: string,
  opts: RateLimitOpts
): RateLimitResult {
  const ip = getClientIp(req);
  const key = `${scope}:${ip}${opts.extraKey ? `:${opts.extraKey}` : ""}`;
  const now = Date.now();
  const cutoff = now - opts.windowMs;

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = [];
    buckets.set(key, bucket);
  }
  // Prune in place
  while (bucket.length && bucket[0]! < cutoff) bucket.shift();

  touch(key);

  if (bucket.length >= opts.limit) {
    const oldest = bucket[0]!;
    const retryAfter = Math.max(1, Math.ceil((oldest + opts.windowMs - now) / 1000));
    return { ok: false, remaining: 0, retryAfter };
  }

  bucket.push(now);
  return { ok: true, remaining: opts.limit - bucket.length, retryAfter: 0 };
}

/** Build a 429 NextResponse-compatible JSON body + headers. */
export function rateLimitHeaders(retryAfter: number): HeadersInit {
  return {
    "Retry-After": String(retryAfter),
    "Cache-Control": "no-store",
  };
}
