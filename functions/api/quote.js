import { guardRequest, corsHeaders, jsonResponse } from "../_lib/security.js";

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: corsHeaders(context) });
}

export async function onRequestPost(context) {
  // 報價預覽：較高速率（30/min/IP），公開可用
  const blocked = await guardRequest(context, { rateLimit: 30 });
  if (blocked) return blocked;
  return forwardToGas(context, "previewQuote");
}

async function forwardToGas(context, action) {
  try {
    const gasUrl = context.env.GAS_WEB_APP_URL;
    if (!gasUrl) {
      return jsonResponse(
        {
          status: "error",
          message: "Cloudflare Pages 尚未設定 GAS_WEB_APP_URL 環境變數。",
        },
        500,
        context
      );
    }

    const payload = await context.request.json();
    const response = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, payload }),
    });

    const text = await response.text();
    return new Response(text, {
      status: response.ok ? 200 : response.status,
      headers: corsHeaders(context),
    });
  } catch (error) {
    return jsonResponse(
      {
        status: "error",
        message: error && error.message ? error.message : String(error),
      },
      500,
      context
    );
  }
}
