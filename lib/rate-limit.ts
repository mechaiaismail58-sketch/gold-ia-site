import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (redis) return redis;
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

// Lazy-initialized limiters — one instance reused across invocations
const limiters = new Map<string, Ratelimit>();

function getLimiter(key: string, factory: () => Ratelimit): Ratelimit {
  if (!limiters.has(key)) limiters.set(key, factory());
  return limiters.get(key)!;
}

export type LimitType = "chat" | "chat_day" | "demo_minute" | "demo_day" | "login";

/**
 * Check a rate limit for the given identifier.
 * Returns `{ limited: false }` when Upstash is not configured (graceful degradation).
 * Returns `{ limited: true, response }` with a ready-to-return 429 when the limit is exceeded.
 */
export async function checkRateLimit(
  identifier: string,
  type: LimitType,
): Promise<{ limited: false } | { limited: true; response: Response }> {
  const r = getRedis();
  // Upstash not configured — skip silently rather than hard-failing
  if (!r) return { limited: false };

  let limiter: Ratelimit;

  switch (type) {
    case "chat":
      limiter = getLimiter("chat", () =>
        new Ratelimit({ redis: r, limiter: Ratelimit.slidingWindow(20, "1 m"), prefix: "rl:chat" }),
      );
      break;
    case "chat_day":
      limiter = getLimiter("chat_day", () =>
        new Ratelimit({ redis: r, limiter: Ratelimit.slidingWindow(40, "1 d"), prefix: "rl:chat:day" }),
      );
      break;
    case "demo_minute":
      limiter = getLimiter("demo_minute", () =>
        new Ratelimit({ redis: r, limiter: Ratelimit.slidingWindow(5, "1 m"), prefix: "rl:demo:min" }),
      );
      break;
    case "demo_day":
      limiter = getLimiter("demo_day", () =>
        new Ratelimit({ redis: r, limiter: Ratelimit.slidingWindow(10, "1 d"), prefix: "rl:demo:day" }),
      );
      break;
    case "login":
      limiter = getLimiter("login", () =>
        new Ratelimit({ redis: r, limiter: Ratelimit.slidingWindow(5, "1 m"), prefix: "rl:login" }),
      );
      break;
  }

  const { success, limit, remaining, reset } = await limiter.limit(identifier);

  if (!success) {
    return {
      limited: true,
      response: Response.json(
        { error: type === "chat_day"
            ? "You've reached today's analysis limit (40). This resets in 24h — see you tomorrow."
            : "Too many requests. Please slow down." },
        {
          status: 429,
          headers: {
            "Retry-After":          String(Math.ceil((reset - Date.now()) / 1000)),
            "X-RateLimit-Limit":    String(limit),
            "X-RateLimit-Remaining": String(remaining),
          },
        },
      ),
    };
  }

  return { limited: false };
}

/** Extract the best available IP from a Next.js App Router request. */
export function getIP(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}
