const LINE_REPLY_ENDPOINT = "https://api.line.me/v2/bot/message/reply";

export async function onRequestPost(context) {
  try {
    const channelSecret = context.env.LINE_CHANNEL_SECRET;
    const channelAccessToken = context.env.LINE_CHANNEL_ACCESS_TOKEN;

    if (!channelSecret) {
      return jsonResponse({
        status: "error",
        message: "Cloudflare Pages 尚未設定 LINE_CHANNEL_SECRET。"
      }, 500);
    }

    const bodyText = await context.request.text();
    const signature = context.request.headers.get("x-line-signature") || "";
    const valid = await verifyLineSignature(bodyText, signature, channelSecret);

    if (!valid) {
      return jsonResponse({
        status: "error",
        message: "LINE signature 驗證失敗。"
      }, 401);
    }

    const body = JSON.parse(bodyText || "{}");
    const events = Array.isArray(body.events) ? body.events : [];

    if (!events.length) {
      return jsonResponse({
        status: "success",
        message: "LINE webhook verify ok"
      }, 200);
    }

    if (!channelAccessToken) {
      return jsonResponse({
        status: "error",
        message: "Cloudflare Pages 尚未設定 LINE_CHANNEL_ACCESS_TOKEN。"
      }, 500);
    }

    await Promise.all(events.map((event) => safeHandleEvent(context, event, channelAccessToken)));

    return jsonResponse({
      status: "success"
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
    service: "royal-flow-line-webhook"
  }, 200);
}

async function safeHandleEvent(context, event, channelAccessToken) {
  try {
    await handleEvent(context, event, channelAccessToken);
  } catch (error) {
    if (event && event.replyToken) {
      try {
        await reply(channelAccessToken, event.replyToken, [{
          type: "text",
          text: "系統暫時無法回覆，請稍後再試。錯誤：" + (error && error.message ? error.message : String(error)).substring(0, 160)
        }]);
      } catch (replyError) {
        console.log("LINE fallback reply failed", replyError);
      }
    }
  }
}

async function handleEvent(context, event, channelAccessToken) {
  if (!event || !event.replyToken) {
    return;
  }

  const userId = event.source && event.source.userId ? event.source.userId : "";
  const text = eventText(event);

  if (!text) {
    return reply(channelAccessToken, event.replyToken, [menuMessage(context)]);
  }

  const lowerText = text.toLowerCase();

  if (matchesAny(lowerText, ["測試", "test", "ping"])) {
    return reply(channelAccessToken, event.replyToken, [{
      type: "text",
      text: "Webhook 測試成功，LINE 回覆功能正常。"
    }]);
  }

  if (matchesAny(lowerText, ["預約", "book", "booking", "機場", "商務"])) {
    return reply(channelAccessToken, event.replyToken, [bookingEntryMessage(context)]);
  }

  if (matchesAny(lowerText, ["報價", "估價", "quote", "price", "費用"])) {
    return reply(channelAccessToken, event.replyToken, [quoteGuideMessage(context)]);
  }

  if (matchesAny(lowerText, ["查詢", "訂單", "行程", "狀態", "我的預約"])) {
    return reply(channelAccessToken, event.replyToken, [await orderLookupMessage(context, userId, text)]);
  }

  if (matchesAny(lowerText, ["付款", "支付", "訂金", "pay", "payment"])) {
    return reply(channelAccessToken, event.replyToken, [await paymentLookupMessage(context, userId, text)]);
  }

  if (matchesAny(lowerText, ["客服", "人工", "help", "聯絡"])) {
    return reply(channelAccessToken, event.replyToken, [humanSupportMessage(context)]);
  }

  return reply(channelAccessToken, event.replyToken, [menuMessage(context)]);
}

function eventText(event) {
  if (event.type === "message" && event.message && event.message.type === "text") {
    return String(event.message.text || "").trim();
  }

  if (event.type === "postback" && event.postback) {
    return String(event.postback.data || event.postback.params || "").trim();
  }

  return "";
}

async function orderLookupMessage(context, userId, text) {
  const orderId = extractOrderId(text);
  if (!userId && !orderId) {
    return {
      type: "text",
      text: "目前無法取得您的 LINE 身分，請先從官方帳號聊天室傳送「預約」或用 LIFF 完成一次預約。",
      quickReply: quickReply(context)
    };
  }

  const result = orderId
    ? await gasAction(context, "getOrder", { orderId })
    : await gasAction(context, "getLatestOrder", { lineUserId: userId });

  if (!result || result.status !== "success" || !result.order) {
    return {
      type: "text",
      text: "已收到查詢行程請求。\n" + (result && result.message ? result.message : "目前查不到預約紀錄。您也可以點選下方重新預約。"),
      quickReply: quickReply(context)
    };
  }

  const order = result.order;
  return {
    type: "text",
    text: [
      "已收到查詢行程請求。",
      "您的行程資訊",
      "訂單：" + display(order.order_id),
      "狀態：" + display(order.order_status || "pending"),
      "服務：" + display(order.service),
      "日期：" + displayDate(order.date) + " " + displayTime(order.time),
      "上車：" + display(order.pickup),
      "下車：" + display(order.dropoff),
      "報價：NT$ " + display(order.final_price),
      "付款：" + display(order.payment_status || "pending"),
      order.driver_note ? "司機/客服備註：" + order.driver_note : ""
    ].filter(Boolean).join("\n"),
    quickReply: quickReply(context)
  };
}

async function paymentLookupMessage(context, userId, text) {
  const orderId = extractOrderId(text);
  if (!userId && !orderId) {
    return {
      type: "text",
      text: "目前無法取得您的 LINE 身分，請先從官方帳號聊天室傳送「預約」或用 LIFF 完成一次預約。",
      quickReply: quickReply(context)
    };
  }

  const result = orderId
    ? await gasAction(context, "getOrder", { orderId })
    : await gasAction(context, "getLatestOrder", { lineUserId: userId });

  if (!result || result.status !== "success" || !result.order) {
    return {
      type: "text",
      text: "已收到付款查詢請求。\n目前查不到可付款的預約。請先完成預約，客服確認後會提供訂金付款連結。",
      quickReply: quickReply(context)
    };
  }

  const order = result.order;
  const paymentUrl = order.payment_url || "";
  if (!paymentUrl) {
    return {
      type: "text",
      text: "已收到付款查詢請求。\n訂單 " + display(order.order_id) + " 尚未產生付款連結，客服確認車輛後會補上。",
      quickReply: quickReply(context)
    };
  }

  return {
    type: "text",
    text: [
      "已收到付款查詢請求。",
      "訂金付款資訊",
      "訂單：" + display(order.order_id),
      "建議訂金：NT$ " + display(order.deposit_amount),
      "付款狀態：" + display(order.payment_status || "pending"),
      paymentUrl
    ].join("\n"),
    quickReply: quickReply(context)
  };
}

function menuMessage(context) {
  return {
    type: "text",
    text: "您好，這裡是御澤禮賓商務。請選擇服務：",
    quickReply: quickReply(context)
  };
}

function bookingEntryMessage(context) {
  return {
    type: "template",
    altText: "開啟御澤禮賓預約表單",
    template: {
      type: "buttons",
      title: "立即預約",
      text: "機場接送、商務接送、旅遊包車皆可在 LINE 內完成填寫。",
      actions: [
        {
          type: "uri",
          label: "開啟預約表單",
          uri: bookingUrl(context)
        },
        {
          type: "message",
          label: "先取得報價",
          text: "報價"
        }
      ]
    }
  };
}

function quoteGuideMessage(context) {
  return {
    type: "text",
    text: [
      "AI 自動報價會依車型、路程、時間與加購服務估算。",
      "請點選預約表單，填寫上車/下車地點後按「取得 Google Routes 估價」，系統會即時計算距離、車程與初步報價。",
      bookingUrl(context)
    ].join("\n\n"),
    quickReply: quickReply(context)
  };
}

function humanSupportMessage(context) {
  const supportUrl = context.env.SUPPORT_URL || bookingUrl(context);
  return {
    type: "text",
    text: "已收到人工客服需求。請留下航班、日期、上車地點與人數，禮賓專員會接手確認。也可先填寫表單：" + supportUrl,
    quickReply: quickReply(context)
  };
}

function quickReply(context) {
  return {
    items: [
      quickMessage("立即預約", "預約"),
      quickMessage("AI 報價", "報價"),
      quickMessage("查詢行程", "查詢行程"),
      quickMessage("付款", "付款"),
      quickMessage("人工客服", "客服")
    ]
  };
}

function quickMessage(label, text) {
  return {
    type: "action",
    action: {
      type: "message",
      label,
      text
    }
  };
}

async function reply(channelAccessToken, replyToken, messages) {
  const response = await fetch(LINE_REPLY_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + channelAccessToken
    },
    body: JSON.stringify({
      replyToken,
      messages
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error("LINE reply API 失敗：" + text.substring(0, 240));
  }
}

async function gasAction(context, action, payload) {
  const gasUrl = context.env.GAS_WEB_APP_URL;
  if (!gasUrl) {
    return {
      status: "error",
      message: "Cloudflare Pages 尚未設定 GAS_WEB_APP_URL。"
    };
  }

  const response = await fetchWithTimeout(gasUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify({
      action,
      payload
    })
  }, 9000);

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

async function fetchWithTimeout(url, options, timeoutMs) {
  const timeout = new Promise((resolve) => {
    setTimeout(() => {
      resolve(new Response(JSON.stringify({
        status: "error",
        message: "Apps Script 查詢逾時，請確認 Apps Script Web App 已重新部署。"
      }), {
        status: 504,
        headers: {
          "Content-Type": "application/json;charset=utf-8"
        }
      }));
    }, timeoutMs);
  });

  return Promise.race([
    fetch(url, options),
    timeout
  ]);
}

async function verifyLineSignature(bodyText, signature, channelSecret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(channelSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(bodyText));
  const expected = arrayBufferToBase64(digest);
  return timingSafeEqual(expected, signature);
}

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function timingSafeEqual(left, right) {
  if (!left || !right || left.length !== right.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < left.length; i++) {
    result |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return result === 0;
}

function bookingUrl(context) {
  return context.env.LIFF_URL || "https://liff.line.me/2010083928-gA1wvCJ0";
}

function matchesAny(text, keywords) {
  return keywords.some((keyword) => text.indexOf(keyword.toLowerCase()) >= 0);
}

function extractOrderId(text) {
  const match = String(text || "").match(/RF\d{14,18}/i);
  return match ? match[0].toUpperCase() : "";
}

function display(input) {
  return input === null || input === undefined || input === "" ? "-" : String(input);
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

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json;charset=utf-8"
    }
  });
}
