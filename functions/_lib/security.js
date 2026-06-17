/**
 * API 安全中介層
 * 1. 驗證來源（同源 / LIFF / 信任白名單）
 * 2. 速率限制（用 KV 計數）
 * 3. CORS 設定
 */

/**
 * 預設允許的 Referer / Origin 白名單
 * 你的 Cloudflare Pages 網域、LIFF 網域、LINE 內部呼叫
 */
const DEFAULT_ALLOWED_HOSTS = [
  "royal-flow-liff.pages.dev",
  "liff.line.me",
  "static.line-scdn.net",
  "127.0.0.1",
  "localhost",
];

/**
 * 主要安全檢查函式
 * @param {object} context Pages function context
 * @param {object} options { requireAuth: bool, rateLimit: number }
 * @returns {Response | null}  若不通過回 Response，通過回 null
 */
export async function guardRequest(context, options = {}) {
  const { requireAuth = false, rateLimit = 30 } = options;

  // 1. CORS preflight
  if (context.request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(context) });
  }

  // 2. 來源驗證（Origin 或 Referer 至少有一個在白名單）
  const allowed = getAllowedHosts(context);
  const sourceOk = checkSource(context.request, allowed);

  if (!sourceOk) {
    return new Response(
      JSON.stringify({
        status: "error",
        message: "Request blocked: origin not allowed.",
      }),
      { status: 403, headers: corsHeaders(context) }
    );
  }

  // 3. 共用密鑰驗證（敏感 API 才用）
  if (requireAuth) {
    const expectedToken = context.env.API_SHARED_SECRET;
    const providedToken = context.request.headers.get("x-api-key");
    if (expectedToken && providedToken !== expectedToken) {
      return new Response(
        JSON.stringify({
          status: "error",
          message: "Unauthorized: invalid API key.",
        }),
        { status: 401, headers: corsHeaders(context) }
      );
    }
  }

  // 4. 速率限制（依 IP 計數，每分鐘 N 次）
  const rateLimitResult = await checkRateLimit(context, rateLimit);
  if (rateLimitResult) return rateLimitResult;

  return null; // 通過
}

/**
 * 取得白名單（從環境變數讀取，加上預設值）
 */
function getAllowedHosts(context) {
  const envHosts = (context.env.ALLOWED_HOSTS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...DEFAULT_ALLOWED_HOSTS, ...envHosts];
}

/**
 * 檢查 request 來源
 */
function checkSource(request, allowedHosts) {
  const origin = request.headers.get("origin") || "";
  const referer = request.headers.get("referer") || "";
  const userAgent = request.headers.get("user-agent") || "";

  // LINE 內部 webhook 一律放行（已用 signature 驗）
  if (userAgent.includes("LineBotWebhook")) return true;

  // 同站請求（Cloudflare Pages function 自身）
  const url = new URL(request.url);
  allowedHosts.push(url.hostname);

  if (origin) {
    const originHost = new URL(origin).hostname;
    if (allowedHosts.includes(originHost)) return true;
  }

  if (referer) {
    try {
      const refererHost = new URL(referer).hostname;
      if (allowedHosts.includes(refererHost)) return true;
    } catch {}
  }

  // 沒有 origin/referer 也允許（例如手動測試）但 KV 速率限制會擋
  if (!origin && !referer) return true;

  return false;
}

/**
 * 速率限制（用 ORDER_KV 暫存）
 */
async function checkRateLimit(context, limit) {
  const kv = context.env.ORDER_KV;
  if (!kv) return null; // 沒 KV 就跳過

  const ip = context.request.headers.get("cf-connecting-ip") || "unknown";
  const path = new URL(context.request.url).pathname;
  const key = `ratelimit:${ip}:${path}:${Math.floor(Date.now() / 60000)}`;

  try {
    const current = parseInt((await kv.get(key)) || "0", 10);
    if (current >= limit) {
      return new Response(
        JSON.stringify({
          status: "error",
          message: `Too many requests. Limit ${limit}/min.`,
        }),
        { status: 429, headers: { ...corsHeaders(context), "Retry-After": "60" } }
      );
    }
    // 計數 +1，TTL 60 秒
    context.waitUntil(kv.put(key, String(current + 1), { expirationTtl: 90 }));
  } catch (err) {
    console.log("Rate limit KV error:", err.message);
  }

  return null;
}

/**
 * 統一 CORS / JSON headers
 */
export function corsHeaders(context) {
  const origin = context?.request?.headers?.get("origin") || "*";
  const allowed = getAllowedHosts(context || { env: {} });

  let allowOrigin = "*";
  try {
    if (origin !== "*") {
      const host = new URL(origin).hostname;
      if (allowed.includes(host)) {
        allowOrigin = origin;
      }
    }
  } catch {}

  return {
    "Content-Type": "application/json;charset=utf-8",
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
    "Access-Control-Max-Age": "86400",
  };
}

export function jsonResponse(body, status = 200, context = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(context),
  });
}
