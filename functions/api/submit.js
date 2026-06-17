import { guardRequest, corsHeaders as secCorsHeaders, jsonResponse as secJsonResponse } from "../_lib/security.js";

const LINE_PUSH_ENDPOINT = "https://api.line.me/v2/bot/message/push";

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: secCorsHeaders(context) });
}

export async function onRequestPost(context) {
  // 送單 API：較嚴速率（10/min/IP），防灌單
  const blocked = await guardRequest(context, { rateLimit: 10 });
  if (blocked) return blocked;
  return forwardToGas(context, "submitBooking");
}

async function forwardToGas(context, action) {
  try {
    const gasUrl = context.env.GAS_WEB_APP_URL;
    if (!gasUrl) {
      return jsonResponse({
        status: "error",
        message: "Cloudflare Pages 尚未設定 GAS_WEB_APP_URL 環境變數。"
      }, 500);
    }

    const payload = await context.request.json();
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
    const result = parseJson(text);
    if (response.ok && result && result.status === "success") {
      const order = cacheOrder(context, payload, result);
      notifyAdminNewOrder(context, order);
      notifyDriversNewOrder(context, order);
      notifyCustomerOrderConfirmation(context, order);
      syncAiAssistantOrder(context, order);
    }

    return new Response(text, {
      status: response.ok ? 200 : response.status,
      headers: corsHeaders()
    });
  } catch (error) {
    return jsonResponse({
      status: "error",
      message: error && error.message ? error.message : String(error)
    }, 500);
  }
}

function cacheOrder(context, payload, result) {
  const kv = context.env.ORDER_KV;
  const orderId = result.orderId || payload.orderId || payload.order_id;
  if (!kv || !orderId) {
    return buildOrderCache(payload, result, orderId || "");
  }

  const order = buildOrderCache(payload, result, orderId);
  const writes = [
    kv.put("order:" + orderId, JSON.stringify(order))
  ];

  const lineUserId = order.line_user_id || order.lineUserId;
  if (lineUserId && lineUserId !== "LINE_NOT_READY") {
    writes.push(kv.put("line:" + lineUserId + ":latest", orderId));
  }

  const task = Promise.all(writes).catch(function(error) {
    console.log("ORDER_KV cache failed", error && error.message ? error.message : String(error));
  });

  if (typeof context.waitUntil === "function") {
    context.waitUntil(task);
  }

  return order;
}

function buildOrderCache(payload, result, orderId) {
  const order = {
    order_id: orderId,
    created_at: new Date().toISOString(),
    line_user_id: payload.line_user_id || payload.lineUserId || "",
    line_display_name: payload.line_display_name || payload.lineDisplayName || "",
    name: payload.name || "",
    phone: payload.phone || "",
    service: payload.service || "",
    date: payload.date || "",
    time: payload.time || "",
    car_type: payload.carType || payload.car_type || "",
    pickup: payload.pickup || "",
    dropoff: payload.dropoff || "",
    airport_reception_address: payload.airportReceptionAddress || payload.airport_reception_address || "",
    reception_address: payload.receptionAddress || payload.reception_address || "",
    dropoff_airport: payload.dropoffAirport || payload.dropoff_airport || "",
    reserved_airport: payload.reservedAirport || payload.reserved_airport || "",
    reserved_port: payload.reservedPort || payload.reserved_port || "",
    passengers: payload.passengers || "",
    luggage: payload.luggage || "",
    flight: payload.flight || "",
    service_tier: payload.serviceTier || payload.service_tier || "",
    premium_addons: payload.premiumAddons || payload.premium_addons || "",
    special_requests: payload.specialRequests || payload.special_requests || "",
    final_price: result.finalPrice || "",
    deposit_amount: result.depositAmount || "",
    balance_amount: result.balanceAmount || "",
    payment_status: "pending",
    order_status: "pending"
  };

  return order;
}

function notifyAdminNewOrder(context, order) {
  const adminIds = adminLineUserIds(context);
  const fallbackTargets = notificationFallbackTargets(context);
  const targets = uniqueIds(adminIds.concat(fallbackTargets));
  const token = context.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!targets.length || !token || !order || !order.order_id) {
    console.log("Admin LINE notification skipped", JSON.stringify({
      hasTargets: Boolean(targets.length),
      hasAdminIds: Boolean(adminIds.length),
      hasFallbackTargets: Boolean(fallbackTargets.length),
      hasToken: Boolean(token),
      hasOrderId: Boolean(order && order.order_id)
    }));
    return;
  }

  const task = Promise.all(targets.map(function(targetId) {
    return pushLineMessage(token, targetId, adminNewOrderMessages(context, order))
      .catch(function(error) {
        console.log("Admin LINE notification failed (" + targetId + "):", error && error.message ? error.message : String(error));
      });
  })).catch(function(error) {
    console.log("Admin LINE notification failed", error && error.message ? error.message : String(error));
  });

  if (typeof context.waitUntil === "function") {
    context.waitUntil(task);
  }
}

function adminLineUserIds(context) {
  return String(context.env.ADMIN_LINE_USER_ID || context.env.ADMIN_LINE_USER_IDS || "")
    .split(",")
    .map(function(id) {
      return id.trim();
    })
    .filter(Boolean);
}

function notificationFallbackTargets(context) {
  return String(
    context.env.ORDER_NOTIFY_LINE_TARGETS ||
    context.env.DRIVER_LINE_TARGETS ||
    context.env.DRIVER_GROUP_IDS ||
    context.env.DRIVER_LINE_USER_IDS ||
    ""
  )
    .split(",")
    .map(function(id) { return id.trim(); })
    .filter(Boolean);
}

function uniqueIds(ids) {
  return Array.from(new Set(ids.filter(Boolean)));
}

// ─── 司機派遣通知（群組或個人 ID）────────────────────────────
function driverTargetIds(context) {
  return String(
    context.env.DRIVER_LINE_TARGETS ||
    context.env.DRIVER_GROUP_IDS ||
    context.env.DRIVER_LINE_USER_IDS ||
    ""
  )
    .split(",")
    .map(function(id) { return id.trim(); })
    .filter(Boolean);
}

function notifyDriversNewOrder(context, order) {
  const targets = driverTargetIds(context);
  const token = context.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!targets.length || !token || !order || !order.order_id) return;

  const task = Promise.all(targets.map(function(targetId) {
    return pushLineMessage(token, targetId, driverDispatchMessages(context, order))
      .catch(function(error) {
        console.log("Driver notify failed (" + targetId + "):", error && error.message ? error.message : String(error));
      });
  }));

  if (typeof context.waitUntil === "function") {
    context.waitUntil(task);
  }
}

function driverDispatchMessages(context, order) {
  const orderId = display(order.order_id);
  const summary = [
    "🚘 御澤禮賓｜派車通知",
    "━━━━━━━━━━━━",
    "訂單編號：" + orderId,
    "客戶姓名：" + display(order.name),
    "聯絡電話：" + display(order.phone),
    "",
    "📋 服務內容",
    "服務項目：" + display(order.service),
    "車型需求：" + display(order.car_type || "客服確認"),
    "",
    "📅 用車時間",
    "日期：" + displayDate(order.date),
    "時間：" + displayTime(order.time),
    "",
    "📍 路線資訊",
    "上車：" + display(order.pickup || order.airport_reception_address || order.reception_address),
    "下車：" + display(order.dropoff || order.dropoff_airport || order.reserved_airport || order.reserved_port),
    "",
    "👥 乘客 / 行李",
    "人數：" + display(order.passengers || "-") + " 位",
    "行李：" + display(order.luggage || "-") + " 件",
    display(order.flight) !== "-" ? "航班：" + display(order.flight) : "",
    "",
    "💰 報價：" + money(order.final_price) + "（訂金 " + money(order.deposit_amount) + "）",
    display(order.special_requests) !== "-" ? "備註：" + display(order.special_requests) : "",
    "",
    "請於 LINE 回覆「接單 " + orderId + "」確認"
  ].filter(Boolean).join("\n");

  return [
    {
      type: "text",
      text: summary
    },
    driverActionTemplate(context, orderId)
  ];
}

function driverActionTemplate(context, orderId) {
  return {
    type: "template",
    altText: "派車通知 " + orderId,
    template: {
      type: "buttons",
      title: "派車通知 " + shortOrderId(orderId),
      text: "請確認接單狀態並核對行程資訊",
      actions: [
        { type: "message", label: "確認接單", text: "接單 " + orderId },
        { type: "message", label: "訂單詳情", text: "查詢 " + orderId },
        { type: "message", label: "回報問題", text: "客服 " + orderId }
      ]
    }
  };
}

function notifyCustomerOrderConfirmation(context, order) {
  const token = context.env.LINE_CHANNEL_ACCESS_TOKEN;
  const customerId = String(order && (order.line_user_id || order.lineUserId) || "").trim();
  if (!token || !customerId || customerId === "LINE_NOT_READY" || !order || !order.order_id) {
    return;
  }

  const task = pushLineMessage(token, customerId, customerOrderConfirmationMessages(context, order))
    .catch(function(error) {
      console.log("Customer LINE confirmation failed", error && error.message ? error.message : String(error));
    });

  if (typeof context.waitUntil === "function") {
    context.waitUntil(task);
  }
}

function syncAiAssistantOrder(context, order) {
  const syncUrl = String(context.env.AI_ASSISTANT_SYNC_URL || "").trim();
  if (!syncUrl || !order || !order.order_id) {
    return;
  }

  const headers = {
    "Content-Type": "application/json"
  };
  const secret = String(context.env.AI_ASSISTANT_SYNC_SECRET || "").trim();
  if (secret) {
    headers["x-sync-secret"] = secret;
  }

  const task = fetch(syncUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      source: "royal-line",
      order
    })
  }).then(async function(response) {
    if (!response.ok) {
      const text = await response.text();
      throw new Error("AI assistant sync failed: " + response.status + " " + text.substring(0, 240));
    }
  }).catch(function(error) {
    console.log("AI assistant sync failed", error && error.message ? error.message : String(error));
  });

  if (typeof context.waitUntil === "function") {
    context.waitUntil(task);
  }
}

function customerOrderConfirmationMessages(context, order) {
  const orderId = display(order.order_id);
  const name = display(order.name);
  const summary = [
    "御澤禮賓｜預約已送出",
    "━━━━━━━━━━━━",
    name !== "-" ? name + " 您好，已收到您的預約需求。" : "您好，已收到您的預約需求。",
    "訂單編號：" + orderId,
    "",
    "服務項目：" + display(order.service),
    "用車日期：" + displayDate(order.date),
    "用車時間：" + displayTime(order.time),
    "上車地點：" + display(order.pickup || order.airport_reception_address || order.reception_address),
    "下車地點：" + display(order.dropoff || order.dropoff_airport || order.reserved_airport || order.reserved_port),
    "乘客 / 行李：" + display(order.passengers || "-") + " 人 / " + display(order.luggage || "-") + " 件",
    "",
    "禮賓專員將為您確認最終車輛、司機與費用。若需補充航班、接待點或特殊需求，可直接於 LINE 回覆。"
  ].join("\n");

  return [
    {
      type: "text",
      text: summary
    },
    customerOrderActionTemplate(context, orderId)
  ];
}

function customerOrderActionTemplate(context, orderId) {
  return {
    type: "template",
    altText: "御澤禮賓預約確認 " + orderId,
    template: {
      type: "buttons",
      title: "預約已送出",
      text: "您可查詢訂單、查看付款資訊，或聯繫禮賓專員補充需求。",
      actions: [
        {
          type: "message",
          label: "訂單查詢",
          text: "查詢 " + orderId
        },
        {
          type: "message",
          label: "付款資訊",
          text: "付款 " + orderId
        },
        {
          type: "message",
          label: "聯繫禮賓專員",
          text: "客服 " + orderId
        },
        {
          type: "uri",
          label: "開啟預約表單",
          uri: bookingUrl(context)
        }
      ]
    }
  };
}

function adminNewOrderMessages(context, order) {
  const orderId = display(order.order_id);
  const amount = money(order.final_price);
  const deposit = money(order.deposit_amount);
  const summary = [
    "御澤禮賓｜新訂單通知",
    "━━━━━━━━━━━━",
    "訂單編號：" + orderId,
    "客戶姓名：" + display(order.name),
    "聯絡電話：" + display(order.phone),
    "服務項目：" + display(order.service),
    "用車日期：" + displayDate(order.date),
    "用車時間：" + displayTime(order.time),
    "上車地點：" + display(order.pickup || order.airport_reception_address || order.reception_address),
    "下車地點：" + display(order.dropoff || order.dropoff_airport || order.reserved_airport || order.reserved_port),
    "乘客 / 行李：" + display(order.passengers || "-") + " 人 / " + display(order.luggage || "-") + " 件",
    "車型需求：" + display(order.car_type || "禮賓專員確認中"),
    "初步估價：" + amount,
    "建議訂金：" + deposit,
    "",
    "請盡快確認車輛檔期、司機安排與是否需聯繫客人。"
  ].join("\n");

  return [
    {
      type: "text",
      text: summary
    },
    adminOrderActionTemplate(context, orderId)
  ];
}

function adminOrderActionTemplate(context, orderId) {
  const actions = [
    {
      type: "message",
      label: "訂單查詢",
      text: "查詢 " + orderId
    },
    {
      type: "message",
      label: "付款資訊",
      text: "付款 " + orderId
    },
    {
      type: "uri",
      label: "開啟預約表單",
      uri: bookingUrl(context)
    }
  ];

  const sheetUrl = adminSheetUrl(context);
  if (sheetUrl) {
    actions.push({
      type: "uri",
      label: "開啟訂單表",
      uri: sheetUrl
    });
  }

  return {
    type: "template",
    altText: "御澤禮賓新訂單 " + orderId,
    template: {
      type: "buttons",
      title: "新訂單 " + shortOrderId(orderId),
      text: "已收到新預約。請確認訂單、付款與派車狀態。",
      actions
    }
  };
}

async function pushLineMessage(channelAccessToken, to, messages) {
  const response = await fetch(LINE_PUSH_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + channelAccessToken
    },
    body: JSON.stringify({
      to,
      messages
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error("LINE push API failed: " + response.status + " " + text.substring(0, 240));
  }
}

function bookingUrl(context) {
  return context.env.LIFF_URL || "https://liff.line.me/2010083928-gA1wvCJ0";
}

function adminSheetUrl(context) {
  return String(context.env.ADMIN_SHEET_URL || context.env.GOOGLE_SHEET_URL || "").trim();
}

function shortOrderId(orderId) {
  const text = String(orderId || "");
  return text.length > 18 ? text.slice(0, 18) : text;
}

function display(input) {
  return input === null || input === undefined || input === "" ? "-" : String(input);
}

function money(input) {
  const amount = Number(input || 0);
  if (!amount) {
    return "待確認";
  }
  return "NT$ " + amount.toLocaleString("zh-TW");
}

function displayDate(input) {
  const text = display(input);
  return text.replace(/\s+00:00:00$/, "");
}

function displayTime(input) {
  const text = display(input);
  const match = text.match(/(?:1899-12-30\s+)?(\d{1,2}:\d{2})(?::\d{2})?/);
  return match ? match[1] : text;
}

function parseJson(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch (error) {
    return null;
  }
}

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders()
  });
}

function corsHeaders() {
  return {
    "Content-Type": "application/json;charset=utf-8",
    "Access-Control-Allow-Origin": "*"
  };
}
