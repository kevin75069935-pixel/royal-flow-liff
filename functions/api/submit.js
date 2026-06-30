const LINE_PUSH_ENDPOINT = "https://api.line.me/v2/bot/message/push";

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function onRequestPost(context) {
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
      const order = buildOrder(payload, result);
      cacheOrder(context, order);
      queueLineNotifications(context, order);
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

function parseJson(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch (error) {
    console.log("Submit response is not JSON", error && error.message ? error.message : String(error));
    return null;
  }
}

function buildOrder(payload, result) {
  return {
    order_id: result.orderId || payload.orderId || payload.order_id || "",
    line_user_id: payload.line_user_id || payload.lineUserId || "",
    line_display_name: payload.line_display_name || payload.lineDisplayName || "",
    name: payload.name || "",
    phone: payload.phone || "",
    service: payload.service || "",
    date: payload.date || "",
    time: payload.time || "",
    car_type: payload.carType || payload.car_type || "",
    pickup: payload.pickup || payload.airportReceptionAddress || payload.airport_reception_address || payload.receptionAddress || payload.reception_address || "",
    dropoff: payload.dropoff || payload.dropoffAirport || payload.dropoff_airport || payload.reservedAirport || payload.reserved_airport || payload.reservedPort || payload.reserved_port || "",
    passengers: payload.passengers || "",
    luggage: payload.luggage || "",
    final_price: result.finalPrice || "",
    deposit_amount: result.depositAmount || "",
    balance_amount: result.balanceAmount || "",
    payment_status: "pending",
    order_status: "pending"
  };
}

function cacheOrder(context, order) {
  const kv = context.env.ORDER_KV;
  if (!kv || !order || !order.order_id) {
    console.log("ORDER_KV cache skipped: missing binding or order id");
    return;
  }

  const writes = [
    kv.put("order:" + order.order_id, JSON.stringify(order))
  ];

  const lineUserId = String(order.line_user_id || "").trim();
  if (isUsableLineTarget(lineUserId)) {
    writes.push(kv.put("line:" + lineUserId + ":latest", order.order_id));
  }

  const task = Promise.all(writes).catch(function(error) {
    console.log("ORDER_KV cache failed", error && error.message ? error.message : String(error));
  });

  if (typeof context.waitUntil === "function") {
    context.waitUntil(task);
  }
}

function queueLineNotifications(context, order) {
  const token = context.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token || !order || !order.order_id) {
    console.log("LINE notification skipped: missing token or order id");
    return;
  }

  const tasks = [];
  const adminIds = adminLineUserIds(context);
  for (const adminId of adminIds) {
    tasks.push(pushLineMessage(token, adminId, adminOrderMessages(order), "admin"));
  }

  const customerId = String(order.line_user_id || "").trim();
  if (isUsableLineTarget(customerId)) {
    tasks.push(pushLineMessage(token, customerId, customerOrderMessages(order), "customer"));
  } else {
    console.log("Customer LINE notification skipped: unusable line_user_id", customerId);
  }

  if (!tasks.length) {
    console.log("LINE notification skipped: no valid targets");
    return;
  }

  const task = Promise.allSettled(tasks).then(function(results) {
    const failed = results.filter(function(result) {
      return result.status === "rejected";
    });
    if (failed.length) {
      console.log("LINE notification failures", failed.length);
    }
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
    .filter(isUsableLineTarget);
}

function adminOrderMessages(order) {
  return [{
    type: "text",
    text: [
      "御澤禮賓｜新訂單通知",
      "訂單編號：" + display(order.order_id),
      "客戶姓名：" + display(order.name),
      "聯絡電話：" + display(order.phone),
      "LINE 名稱：" + display(order.line_display_name),
      "",
      "服務項目：" + display(order.service),
      "車型：" + display(order.car_type),
      "用車時間：" + display(order.date) + " " + display(order.time),
      "上車地點：" + display(order.pickup),
      "下車地點：" + display(order.dropoff),
      "人數 / 行李：" + display(order.passengers) + " / " + display(order.luggage),
      "",
      "初步估價：" + money(order.final_price),
      "訂金金額：" + money(order.deposit_amount),
      "",
      "請回覆客人並確認車輛與司機檔期。"
    ].join("\n")
  }];
}

function customerOrderMessages(order) {
  return [{
    type: "text",
    text: [
      "御澤禮賓｜已收到您的預約",
      "訂單編號：" + display(order.order_id),
      "",
      "服務項目：" + display(order.service),
      "用車時間：" + display(order.date) + " " + display(order.time),
      "上車地點：" + display(order.pickup),
      "下車地點：" + display(order.dropoff),
      "",
      "初步估價：" + money(order.final_price),
      "訂金金額：" + money(order.deposit_amount),
      "",
      "禮賓專員會再確認車輛、司機與行程細節。若要查詢行程，請回覆：查詢 " + display(order.order_id),
      "若要付款資訊，請回覆：付款 " + display(order.order_id)
    ].join("\n")
  }];
}

async function pushLineMessage(token, to, messages, label) {
  const response = await fetch(LINE_PUSH_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token
    },
    body: JSON.stringify({ to, messages })
  });

  const text = await response.text();
  if (!response.ok) {
    console.log("LINE push failed", label, response.status, text.substring(0, 240));
    throw new Error("LINE push failed: " + response.status + " " + text.substring(0, 240));
  }

  console.log("LINE push success", label);
}

function isUsableLineTarget(value) {
  return /^(U|C|R)[0-9a-f]{32}$/i.test(String(value || "").trim());
}

function display(input) {
  return input === null || input === undefined || input === "" ? "-" : String(input);
}

function money(input) {
  const amount = Number(input || 0);
  if (!amount) return "待確認";
  return "NT$ " + amount.toLocaleString("zh-TW");
}
