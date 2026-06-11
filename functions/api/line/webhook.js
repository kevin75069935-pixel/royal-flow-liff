const LINE_REPLY_ENDPOINT = "https://api.line.me/v2/bot/message/reply";

export async function onRequestPost(context) {
  try {
    console.log("LINE webhook POST received");
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
      console.log("LINE signature verification failed");
      return jsonResponse({
        status: "error",
        message: "LINE signature 驗證失敗。"
      }, 401);
    }

    const body = JSON.parse(bodyText || "{}");
    const events = Array.isArray(body.events) ? body.events : [];
    console.log("LINE webhook event count", events.length);

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
          text: "很抱歉，系統暫時無法完成回覆。禮賓團隊會盡快協助確認。錯誤：" + (error && error.message ? error.message : String(error)).substring(0, 160)
        }]);
      } catch (replyError) {
        console.log("LINE fallback reply failed", replyError);
      }
    }
  }
}

async function handleEvent(context, event, channelAccessToken) {
  if (!event || !event.replyToken) {
    console.log("LINE event skipped: no replyToken");
    return;
  }

  const userId = event.source && event.source.userId ? event.source.userId : "";
  const text = eventText(event);
  console.log("LINE event received", {
    eventType: event.type || "",
    messageType: event.message && event.message.type ? event.message.type : "",
    hasUserId: Boolean(userId),
    text
  });

  if (!text) {
    return reply(channelAccessToken, event.replyToken, [menuMessage(context)]);
  }

  const lowerText = text.toLowerCase();

  if (matchesAny(lowerText, ["測試", "test", "ping"])) {
    return reply(channelAccessToken, event.replyToken, [{
      type: "text",
      text: "御澤禮賓系統測試完成，LINE 回覆服務目前正常。"
    }]);
  }

  if (matchesAny(lowerText, ["hi", "hello", "您好", "你好", "我要預約", "選單", "開始"])) {
    return reply(channelAccessToken, event.replyToken, [serviceMenuMessage(context)]);
  }

  if (matchesAny(lowerText, ["機場接送", "送機", "接機"])) {
    return reply(channelAccessToken, event.replyToken, [airportIntakeMessage(context)]);
  }

  if (matchesAny(lowerText, ["商務接送", "商務用車", "商務包車"])) {
    return reply(channelAccessToken, event.replyToken, [businessIntakeMessage(context)]);
  }

  if (matchesAny(lowerText, ["包車旅遊", "旅遊包車", "半日包車", "一日包車"])) {
    return reply(channelAccessToken, event.replyToken, [charterPackageMessage(context)]);
  }

  if (matchesAny(lowerText, ["預約", "book", "booking"])) {
    return reply(channelAccessToken, event.replyToken, [serviceMenuMessage(context)]);
  }

  if (matchesAny(lowerText, ["報價", "估價", "quote", "price", "費用"])) {
    return reply(channelAccessToken, event.replyToken, [quoteGuideMessage(context)]);
  }

  if (matchesAny(lowerText, ["查詢", "訂單", "行程", "狀態", "我的預約"])) {
    return reply(channelAccessToken, event.replyToken, [simpleOrderLookupMessage(context, text)]);
  }

  if (matchesAny(lowerText, ["付款", "支付", "訂金", "pay", "payment"])) {
    return reply(channelAccessToken, event.replyToken, [simplePaymentLookupMessage(context, text)]);
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

function simpleOrderLookupMessage(context, text) {
  const orderId = extractOrderId(text);
  return {
    type: "text",
    text: [
      "已為您收到行程查詢需求。",
      orderId ? "訂單編號：" + orderId : "為精準核對行程，請提供訂單編號，例如：查詢 RF20260611184411244",
      "若需重新填寫或補充資料，可由下方開啟預約表單：",
      bookingUrl(context)
    ].join("\n")
  };
}

function simplePaymentLookupMessage(context, text) {
  const orderId = extractOrderId(text);
  return {
    type: "text",
    text: [
      "已為您收到付款查詢需求。",
      orderId ? "訂單編號：" + orderId : "為精準核對款項，請提供訂單編號，例如：付款 RF20260611184411244",
      "禮賓專員確認車輛與行程後，將提供專屬訂金付款連結。"
    ].join("\n")
  };
}

async function orderLookupMessage(context, userId, text) {
  const orderId = extractOrderId(text);
  if (!userId && !orderId) {
    return {
      type: "text",
      text: "很抱歉，目前無法確認您的 LINE 身分。請先由官方帳號聊天室傳送「預約」，或透過表單完成一次預約，以利禮賓團隊為您核對行程。",
      quickReply: quickReply(context)
    };
  }

  const result = orderId
    ? await gasAction(context, "getOrder", { orderId })
    : await gasAction(context, "getLatestOrder", { lineUserId: userId });

  if (!result || result.status !== "success" || !result.order) {
    return {
      type: "text",
      text: "已為您收到行程查詢需求。\n" + (result && result.message ? result.message : "目前尚未查到您的預約紀錄。您也可以點選下方重新預約，禮賓專員將協助確認。"),
      quickReply: quickReply(context)
    };
  }

  const order = result.order;
  return {
    type: "text",
    text: [
      "已為您完成行程查詢。",
      "以下為目前預約資訊：",
      "訂單編號：" + display(order.order_id),
      "狀態：" + display(order.order_status || "pending"),
      "服務：" + display(order.service),
      "日期：" + displayDate(order.date),
      "時間：" + displayTime(order.time),
      "上車：" + display(order.pickup),
      "下車：" + display(order.dropoff),
      "報價：NT$ " + display(order.final_price),
      "付款：" + display(order.payment_status || "pending")
    ].map(safeLineText).filter(Boolean).join("\n")
  };
}

async function paymentLookupMessage(context, userId, text) {
  const orderId = extractOrderId(text);
  if (!userId && !orderId) {
    return {
      type: "text",
      text: "很抱歉，目前無法確認您的 LINE 身分。請先由官方帳號聊天室傳送「預約」，或透過表單完成一次預約，以利禮賓團隊為您核對款項。",
      quickReply: quickReply(context)
    };
  }

  const result = orderId
    ? await gasAction(context, "getOrder", { orderId })
    : await gasAction(context, "getLatestOrder", { lineUserId: userId });

  if (!result || result.status !== "success" || !result.order) {
    return {
      type: "text",
      text: "已為您收到付款查詢需求。\n目前尚未查到可付款的預約。請先完成預約，禮賓專員確認車輛與行程後，將提供訂金付款連結。",
      quickReply: quickReply(context)
    };
  }

  const order = result.order;
  const paymentUrl = order.payment_url || "";
  if (!paymentUrl) {
    return {
      type: "text",
      text: "已為您收到付款查詢需求。\n訂單 " + display(order.order_id) + " 尚未產生付款連結。禮賓專員確認車輛與行程後，將為您補上專屬付款連結。",
      quickReply: quickReply(context)
    };
  }

  return {
    type: "text",
    text: [
      "已為您完成付款查詢。",
      "以下為訂金付款資訊：",
      "訂單編號：" + display(order.order_id),
      "建議訂金：NT$ " + display(order.deposit_amount),
      "付款狀態：" + display(order.payment_status || "pending"),
      paymentUrl
    ].join("\n"),
    quickReply: quickReply(context)
  };
}

function menuMessage(context) {
  return serviceMenuMessage(context);
}

function serviceMenuMessage(context) {
  return {
    type: "flex",
    altText: "御澤禮賓服務選單",
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#111026",
        paddingAll: "18px",
        contents: [
          {
            type: "text",
            text: "ROYAL FLOW",
            color: "#D7AE54",
            weight: "bold",
            size: "lg"
          },
          {
            type: "text",
            text: "Concierge",
            color: "#F4E4BC",
            size: "sm",
            margin: "xs"
          }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#FFFFFF",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "您好，歡迎使用御澤禮賓商務",
            weight: "bold",
            size: "lg",
            color: "#222222"
          },
          {
            type: "text",
            text: "請選擇需要協助的服務，禮賓專員將依您的行程需求細緻安排。",
            wrap: true,
            color: "#666666",
            size: "sm"
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        backgroundColor: "#FFFFFF",
        contents: [
          flexMessageButton("商務接送", "商務接送", "#111026"),
          flexMessageButton("機場接送", "機場接送", "#111026"),
          flexMessageButton("包車旅遊", "包車旅遊", "#D7AE54"),
          flexUriButton("開啟專屬預約表單", bookingUrl(context), "#6B7280")
        ]
      }
    },
    quickReply: quickReply(context)
  };
}

function bookingEntryMessage(context) {
  return {
    type: "template",
    altText: "御澤禮賓預約服務",
    template: {
      type: "buttons",
      title: "御澤禮賓預約服務",
      text: "為節省您的寶貴時間，您可於 LINE 內完成機場接送、商務接送與包車需求填寫。",
      actions: [
        {
          type: "uri",
          label: "開啟專屬預約表單",
          uri: bookingUrl(context)
        },
        {
          type: "message",
          label: "先行估算費用",
          text: "報價"
        }
      ]
    }
  };
}

function airportIntakeMessage(context) {
  return {
    type: "flex",
    altText: "機場接送資料填寫",
    contents: {
      type: "bubble",
      size: "mega",
      header: flexHeader("機場接送", "送機 / 接機專屬安排"),
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#FFFFFF",
        spacing: "sm",
        contents: [
          flexText("請提供以下資訊，我們將立即為您確認路線與費用：", true),
          flexSeparator(),
          flexText("接送地址", false),
          flexText("機場：桃園 / 松山 / 台中 / 小港", false),
          flexText("航廈：T1 / T2 / 國際線 / 國內線", false),
          flexText("航班號碼：例 BR001，無則填無", false),
          flexText("用車日期與時間", false),
          flexText("乘客人數與行李件數", false),
          flexText("安全座椅需求與聯絡電話", false),
          flexNotice("建議直接開啟表單填寫，可避免資訊遺漏，並取得初步估價。")
        ]
      },
      footer: flexFooter([
        flexUriButton("開啟機場接送預約", bookingUrl(context), "#D7AE54"),
        flexMessageButton("需要調整或詢問", "客服", "#6B7280")
      ])
    },
    quickReply: quickReply(context)
  };
}

function businessIntakeMessage(context) {
  return {
    type: "flex",
    altText: "商務接送資料填寫",
    contents: {
      type: "bubble",
      size: "mega",
      header: flexHeader("商務接送", "企業接待 / 主管用車 / 多點行程"),
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#FFFFFF",
        spacing: "sm",
        contents: [
          flexText("請提供以下資訊，我們將為您安排合適車型與專屬報價：", true),
          flexSeparator(),
          flexText("上車地點", false),
          flexText("目的地或多點行程", false),
          flexText("日期與時間", false),
          flexText("預計用車小時：3 小時 / 8 小時 / 客製", false),
          flexText("乘客人數與行李件數", false),
          flexText("是否跨縣市或需等待", false),
          flexText("聯絡電話", false),
          flexNotice("商務行程可先收集需求，最終車輛與司機將由禮賓專員確認。")
        ]
      },
      footer: flexFooter([
        flexUriButton("開啟商務接送預約", bookingUrl(context), "#D7AE54"),
        flexMessageButton("需要禮賓專員協助", "客服", "#6B7280")
      ])
    },
    quickReply: quickReply(context)
  };
}

function charterPackageMessage(context) {
  return {
    type: "flex",
    altText: "包車旅遊方案",
    contents: {
      type: "bubble",
      size: "mega",
      header: flexHeader("包車旅遊方案", "半日 / 一日 / 客製行程"),
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#FFFFFF",
        spacing: "md",
        contents: [
          flexText("半日包車（4 小時）", true),
          flexText("適合市區短程、飯店接送、會議與景點安排。", false),
          flexSeparator(),
          flexText("一日包車（8 小時）", true),
          flexText("適合北部景點、客戶接待、家庭旅遊與彈性停留。", false),
          flexSeparator(),
          flexText("客製行程", true),
          flexText("可依出發地、景點、天數、車型與司機住宿需求另行規劃。", false),
          flexNotice("請於表單填寫出發地、想去景點、日期、人數與聯絡電話。")
        ]
      },
      footer: flexFooter([
        flexUriButton("半日 / 一日包車預約", bookingUrl(context), "#D7AE54"),
        flexMessageButton("客製行程洽詢", "客服", "#6B7280")
      ])
    },
    quickReply: quickReply(context)
  };
}

function quoteGuideMessage(context) {
  return {
      type: "text",
      text: [
        "御澤禮賓將依您的車型需求、行程路線、用車時間與加值服務，先行提供初步費用估算。",
      "禮賓等級可選：尊榮標準服務、VIP 商務服務、皇家禮賓服務。亦可加選怡雲礦泉水、氣泡水、咖啡/茶飲、一次性拖鞋、車內薄毯、靜音乘車、花束禮品代購與企業 Logo 舉牌等服務。",
      "請開啟預約表單並填寫上車與下車地點，再點選「取得路線估價」。最終車輛、司機與費用將由禮賓專員為您確認。",
      bookingUrl(context)
    ].join("\n\n"),
    quickReply: quickReply(context)
  };
}

function humanSupportMessage(context) {
  const supportUrl = context.env.SUPPORT_URL || bookingUrl(context);
  return {
    type: "text",
    text: "已為您轉接禮賓專員。若方便，請先留下用車日期、航班或行程、上車地點與乘客人數，我們將為您細緻確認。也可先填寫預約表單：" + supportUrl,
    quickReply: quickReply(context)
  };
}

function flexHeader(title, subtitle) {
  return {
    type: "box",
    layout: "vertical",
    backgroundColor: "#111026",
    paddingAll: "18px",
    contents: [
      {
        type: "text",
        text: title,
        color: "#D7AE54",
        weight: "bold",
        size: "lg"
      },
      {
        type: "text",
        text: subtitle,
        color: "#F4E4BC",
        size: "sm",
        margin: "xs",
        wrap: true
      }
    ]
  };
}

function flexFooter(contents) {
  return {
    type: "box",
    layout: "vertical",
    spacing: "sm",
    backgroundColor: "#FFFFFF",
    contents
  };
}

function flexText(text, bold) {
  return {
    type: "text",
    text,
    wrap: true,
    size: "sm",
    color: bold ? "#222222" : "#555555",
    weight: bold ? "bold" : "regular"
  };
}

function flexNotice(text) {
  return {
    type: "box",
    layout: "vertical",
    backgroundColor: "#FFF7E6",
    cornerRadius: "md",
    paddingAll: "10px",
    margin: "md",
    contents: [
      {
        type: "text",
        text,
        wrap: true,
        size: "xs",
        color: "#8A6728"
      }
    ]
  };
}

function flexSeparator() {
  return {
    type: "separator",
    margin: "sm",
    color: "#E8E1D4"
  };
}

function flexMessageButton(label, text, color) {
  return {
    type: "button",
    style: "primary",
    height: "sm",
    color,
    action: {
      type: "message",
      label,
      text
    }
  };
}

function flexUriButton(label, uri, color) {
  return {
    type: "button",
    style: "primary",
    height: "sm",
    color,
    action: {
      type: "uri",
      label,
      uri
    }
  };
}

function quickReply(context) {
  return {
    items: [
      quickMessage("專屬預約", "預約"),
      quickMessage("禮賓估價", "報價"),
      quickMessage("查詢行程", "查詢行程"),
      quickMessage("付款資訊", "付款"),
      quickMessage("禮賓專員", "客服")
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
  console.log("LINE reply start", {
    messageCount: Array.isArray(messages) ? messages.length : 0,
    firstType: messages && messages[0] ? messages[0].type : ""
  });

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
    console.log("LINE reply API failed", response.status, text.substring(0, 240));
    throw new Error("LINE reply API 失敗：" + text.substring(0, 240));
  }

  console.log("LINE reply API success");
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

function safeLineText(input) {
  return String(input || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .substring(0, 450);
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
