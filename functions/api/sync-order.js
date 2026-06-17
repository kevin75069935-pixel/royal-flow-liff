export async function onRequestPost(context) {
  try {
    const payload = await context.request.json();
    const orderId = String(payload.orderId || payload.order_id || "").trim().toUpperCase();

    if (!orderId) {
      return jsonResponse({
        status: "error",
        message: "缺少 orderId。"
      }, 400);
    }

    if (context.env.SYNC_SECRET) {
      const provided = context.request.headers.get("x-sync-secret") || payload.syncSecret || "";
      if (provided !== context.env.SYNC_SECRET) {
        return jsonResponse({
          status: "error",
          message: "同步密鑰不正確。"
        }, 401);
      }
    }

    const result = await gasAction(context, "getOrder", { orderId });
    if (!result || result.status !== "success" || !result.order) {
      return jsonResponse({
        status: "not_found",
        message: result && result.message ? result.message : "查無此訂單。",
        orderId
      }, 404);
    }

    await cacheOrder(context, result.order);

    return jsonResponse({
      status: "success",
      message: "訂單已同步到 KV。",
      orderId
    }, 200);
  } catch (error) {
    return jsonResponse({
      status: "error",
      message: error && error.message ? error.message : String(error)
    }, 500);
  }
}

export async function onRequestGet() {
  return jsonResponse({
    status: "ok",
    service: "royal-flow-sync-order"
  }, 200);
}

async function gasAction(context, action, payload) {
  const gasUrl = context.env.GAS_WEB_APP_URL;
  if (!gasUrl) {
    return {
      status: "error",
      message: "Cloudflare Pages 尚未設定 GAS_WEB_APP_URL。"
    };
  }

  const response = await fetch(gasUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify({
      action,
      payload
    })
  });

  const text = await response.text();
  if (!response.ok) {
    return {
      status: "error",
      message: "Apps Script HTTP " + response.status + "：" + text.substring(0, 160)
    };
  }

  try {
    return text ? JSON.parse(text) : {};
  } catch (error) {
    return {
      status: "error",
      message: "Apps Script 回傳不是 JSON：" + text.substring(0, 160)
    };
  }
}

async function cacheOrder(context, order) {
  const kv = context.env.ORDER_KV;
  const orderId = String(order.order_id || "").trim().toUpperCase();
  if (!kv || !orderId) {
    throw new Error("ORDER_KV 未綁定或訂單缺少 order_id。");
  }

  await kv.put("order:" + orderId, JSON.stringify(order));

  const lineUserId = order.line_user_id || order.lineUserId;
  if (lineUserId && lineUserId !== "LINE_NOT_READY") {
    await kv.put("line:" + lineUserId + ":latest", orderId);
  }
}

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json;charset=utf-8",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
