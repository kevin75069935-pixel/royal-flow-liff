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

  // ─── 司機任務回報：位置訊息處理 ─────────────────────────────
  if (event.type === "message" && event.message && event.message.type === "location") {
    return reply(channelAccessToken, event.replyToken, await handleDriverLocation(context, userId, event.message));
  }

  if (!text) {
    return reply(channelAccessToken, event.replyToken, [menuMessage(context)]);
  }

  // ─── 司機任務回報：階段關鍵字（行前/出發/到點/上車/下車/完成）──
  const taskStage = parseDriverTaskStage(text);
  if (taskStage) {
    return reply(channelAccessToken, event.replyToken, await driverTaskStageMessage(context, userId, taskStage));
  }

  // 取消司機任務回報
  if (text === "取消回報") {
    if (context.env.ORDER_KV) {
      await context.env.ORDER_KV.delete("driver_task:" + userId).catch(() => {});
    }
    return reply(channelAccessToken, event.replyToken, [{
      type: "text",
      text: "已取消任務回報。需要再次回報時請重新輸入階段名稱。"
    }]);
  }

  const lowerText = text.toLowerCase();

  if (matchesAny(lowerText, ["測試", "test", "ping"])) {
    return reply(channelAccessToken, event.replyToken, [{
      type: "text",
      text: "御澤禮賓系統測試完成，LINE 回覆服務目前正常。"
    }]);
  }

  if (matchesAny(lowerText, ["服務車型", "車型", "車款", "車種", "car type", "vehicle"])) {
    return reply(channelAccessToken, event.replyToken, [vehicleCarouselMessage(context)]);
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

  if (matchesAny(lowerText, ["寰宇", "商務中心", "環宇", "貴賓室", "vip lounge", "lounge"])) {
    return reply(channelAccessToken, event.replyToken, [universalLoungeMessage(context)]);
  }

  if (matchesAny(lowerText, ["保障", "保險", "安全", "隱私", "保密", "服務保障"])) {
    return reply(channelAccessToken, event.replyToken, [assuranceMessage(context)]);
  }

  if (matchesAny(lowerText, ["企業接待", "公司接待", "月結", "統編", "發票", "報價單"])) {
    return reply(channelAccessToken, event.replyToken, [enterpriseReceptionMessage(context)]);
  }

  if (matchesAny(lowerText, ["預約", "book", "booking"])) {
    return reply(channelAccessToken, event.replyToken, [serviceMenuMessage(context)]);
  }

  // ─── AI 自動報價（智慧解析自然語言）─────────────────
  // 偵測「A到B」「A→B」「A 到 B 多少」等模式
  const autoQuote = parseAutoQuoteIntent(text);
  if (autoQuote && autoQuote.origin && autoQuote.destination) {
    return reply(channelAccessToken, event.replyToken, await autoQuoteMessages(context, autoQuote));
  }

  if (matchesAny(lowerText, ["報價", "估價", "quote", "price", "費用"])) {
    return reply(channelAccessToken, event.replyToken, [quoteGuideMessage(context)]);
  }

  if (matchesAny(lowerText, ["同步", "更新付款", "同步付款", "更新訂單"])) {
    return reply(channelAccessToken, event.replyToken, [await syncOrderFromSheetMessage(context, text)]);
  }

  // 司機接單回覆
  if (text.startsWith("接單") || text.startsWith("accept")) {
    return reply(channelAccessToken, event.replyToken, [await driverAcceptMessage(context, userId, text)]);
  }

  if (matchesAny(lowerText, ["查詢", "訂單", "行程", "狀態", "我的預約"])) {
    return reply(channelAccessToken, event.replyToken, await orderLookupMessages(context, userId, text));
  }

  if (matchesAny(lowerText, ["付款", "支付", "訂金", "pay", "payment"])) {
    return reply(channelAccessToken, event.replyToken, await paymentInfoMessages(context, userId, text));
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
      "已為您收到行程查詢需求，禮賓專員將依訂單資料協助核對。",
      orderId ? "訂單編號：" + orderId : "為精準核對行程，請提供訂單編號，例如：查詢 RF20260611184411244",
      "查詢內容將包含目前狀態、服務項目、用車時間、上下車地點、初步禮賓估價與付款狀態。",
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
      "禮賓專員確認車輛與行程後，將提供專屬訂金付款資訊。",
      "付款確認後將為您保留車輛與司機檔期；尾款、收據、統編發票或企業月結可依需求由專員協助。"
    ].join("\n")
  };
}

function immediateOrderLookupText(context, text) {
  const orderId = extractOrderId(text);
  const lines = [
    "御澤禮賓｜訂單查詢",
    "━━━━━━━━━━━━"
  ];

  if (orderId) {
    lines.push(
      "已收到您的行程查詢需求。",
      "訂單編號：" + orderId,
      "",
      "禮賓專員將依此訂單編號核對 Sheet 內的預約資料，包含用車時間、上下車地點、車型、報價與付款狀態。"
    );
  } else {
    lines.push(
      "為保護您的行程隱私，請提供訂單編號以便核對。",
      "",
      "請輸入：",
      "查詢 RF20260611184411244",
      "",
      "若您剛完成預約，訂單編號會顯示於送出成功畫面，也會寫入訂單資料表。"
    );
  }

  lines.push(
    "",
    "需要補充或重新預約：",
    bookingUrl(context)
  );

  return {
    type: "text",
    text: lines.join("\n")
  };
}

async function orderLookupMessages(context, userId, text) {
  const message = await kvOrderLookupText(context, userId, text);
  return [
    message,
    orderActionTemplate(context, extractOrderId(text))
  ];
}

async function paymentInfoMessages(context, userId, text) {
  const message = await kvPaymentText(context, userId, text);
  return [
    message,
    paymentActionTemplate(context, extractOrderId(text))
  ];
}

function immediatePaymentText(context, text) {
  const orderId = extractOrderId(text);
  const bank = bankTransferInfo(context);
  const lines = [
    "御澤禮賓｜付款資訊",
    "━━━━━━━━━━━━"
  ];

  if (orderId) {
    lines.push("訂單編號：" + orderId, "");
  }

  lines.push(
    "銀行：" + bank.bankName,
    "銀行代碼：" + bank.bankCode,
    "戶名：" + bank.accountName,
    "帳號：" + bank.accountNumber,
    "",
    "銀行轉帳 QR Code：",
    bankQrImageUrl(context),
    "",
    "付款頁面：",
    paymentPageUrl(context, orderId),
    "",
    bank.note,
    "",
    orderId ? "匯款完成後請回覆：已匯款 " + orderId + " 末五碼：" : "匯款完成後請回覆：已匯款 末五碼："
  );

  return {
    type: "text",
    text: lines.join("\n")
  };
}

async function kvOrderLookupText(context, userId, text) {
  try {
    const order = await findCachedOrder(context, userId, extractOrderId(text));
    if (order) {
      return orderSummaryTextMessage(context, order);
    }
  } catch (error) {
    console.log("ORDER_KV lookup failed", error && error.message ? error.message : String(error));
  }

  return immediateOrderLookupText(context, text);
}

async function syncOrderFromSheetMessage(context, text) {
  const orderId = extractOrderId(text);
  if (!orderId) {
    return {
      type: "text",
      text: [
        "御澤禮賓｜訂單同步",
        "━━━━━━━━━━━━",
        "請提供要同步的訂單編號。",
        "",
        "範例：",
        "同步 RF20260611184411244"
      ].join("\n")
    };
  }

  try {
    const result = await gasAction(context, "getOrder", { orderId });
    if (!result || result.status !== "success" || !result.order) {
      return {
        type: "text",
        text: [
          "御澤禮賓｜訂單同步",
          "━━━━━━━━━━━━",
          "查無此訂單，尚未同步。",
          "訂單編號：" + orderId,
          "",
          result && result.message ? result.message : "請確認 Google Sheet 內是否已有此訂單。"
        ].join("\n")
      };
    }

    await cacheOrderToKv(context, result.order);
    return {
      type: "text",
      text: [
        "御澤禮賓｜訂單同步完成",
        "━━━━━━━━━━━━",
        "訂單編號：" + orderId,
        "付款狀態：" + paymentStatusText(result.order.payment_status || "pending"),
        "訂單狀態：" + orderStatusText(result.order.order_status || "pending"),
        "",
        "現在客人輸入「查詢 " + orderId + "」即可看到最新 KV 摘要。"
      ].join("\n")
    };
  } catch (error) {
    return {
      type: "text",
      text: [
        "御澤禮賓｜訂單同步失敗",
        "━━━━━━━━━━━━",
        "訂單編號：" + orderId,
        "錯誤：" + (error && error.message ? error.message : String(error))
      ].join("\n")
    };
  }
}

async function kvPaymentText(context, userId, text) {
  try {
    const order = await findCachedOrder(context, userId, extractOrderId(text));
    if (order) {
      return bankTransferTextMessage(context, order);
    }
  } catch (error) {
    console.log("ORDER_KV payment lookup failed", error && error.message ? error.message : String(error));
  }

  return immediatePaymentText(context, text);
}

async function cacheOrderToKv(context, order) {
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

async function findCachedOrder(context, userId, orderId) {
  const kv = context.env.ORDER_KV;
  if (!kv) {
    return null;
  }

  let lookupOrderId = orderId || "";
  if (!lookupOrderId && userId) {
    lookupOrderId = await kv.get("line:" + userId + ":latest") || "";
  }

  if (!lookupOrderId) {
    return null;
  }

  const orderText = await kv.get("order:" + lookupOrderId);
  if (!orderText) {
    return null;
  }

  return JSON.parse(orderText);
}

function orderActionTemplate(context, orderId) {
  return {
    type: "template",
    altText: "御澤禮賓訂單查詢操作",
    template: {
      type: "buttons",
      title: "訂單查詢",
      text: orderId ? "可繼續付款、補充資料或聯繫禮賓專員。" : "請提供訂單編號，或開啟表單補充資料。",
      actions: [
        {
          type: "message",
          label: orderId ? "付款資訊" : "輸入訂單編號",
          text: orderId ? "付款 " + orderId : "查詢 RF"
        },
        {
          type: "uri",
          label: "開啟預約表單",
          uri: bookingUrl(context)
        },
        {
          type: "message",
          label: "禮賓專員",
          text: orderId ? "客服 " + orderId : "客服"
        }
      ]
    }
  };
}

function paymentActionTemplate(context, orderId) {
  return {
    type: "template",
    altText: "御澤禮賓付款操作",
    template: {
      type: "buttons",
      title: "付款資訊",
      text: "可開啟付款頁複製帳號、下載 QR Code，或前往中國信託網站匯款。",
      actions: [
        {
          type: "uri",
          label: "開啟付款頁",
          uri: paymentPageUrl(context, orderId)
        },
        {
          type: "uri",
          label: "下載 QR Code",
          uri: bankQrImageUrl(context)
        },
        {
          type: "uri",
          label: "中國信託網站",
          uri: bankOnlineUrl(context)
        },
        {
          type: "message",
          label: "回傳末五碼",
          text: orderId ? "已匯款 " + orderId + " 末五碼：" : "已匯款 末五碼："
        }
      ]
    }
  };
}

async function orderLookupMessage(context, userId, text, lineDisplayName) {
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
    : await gasAction(context, "getLatestOrder", { lineUserId: userId, lineDisplayName });

  if (!result || result.status !== "success" || !result.order) {
    return {
      type: "text",
      text: "已為您收到行程查詢需求。\n" + (result && result.message ? result.message : "目前尚未查到您的預約紀錄。您也可以點選下方重新預約，禮賓專員將協助確認。"),
      quickReply: quickReply(context)
    };
  }

  const order = result.order;
  return orderSummaryTextMessage(context, order);
}

async function paymentLookupMessage(context, userId, text, lineDisplayName) {
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
    : await gasAction(context, "getLatestOrder", { lineUserId: userId, lineDisplayName });

  if (!result || result.status !== "success" || !result.order) {
    return bankTransferTextMessage(context, null);
  }

  return bankTransferTextMessage(context, result.order);
}

function orderSummaryTextMessage(context, order) {
  const orderId = display(order.order_id);
  return {
    type: "text",
    text: [
      "御澤禮賓｜訂單查詢",
      "━━━━━━━━━━━━",
      "訂單編號：" + orderId,
      "目前狀態：" + orderStatusText(order.order_status || "pending"),
      "付款狀態：" + paymentStatusText(order.payment_status || "pending"),
      "",
      "服務項目：" + display(order.service),
      "車型需求：" + display(order.car_type || "禮賓專員確認中"),
      "用車日期：" + displayDate(order.date),
      "用車時間：" + displayTime(order.time),
      "上車地點：" + display(order.pickup || order.airport_reception_address || order.reception_address),
      "下車地點：" + display(order.dropoff || order.dropoff_airport || order.reserved_airport || order.reserved_port),
      "乘客 / 行李：" + display(order.passengers || "-") + " 人 / " + display(order.luggage || "-") + " 件",
      "禮賓等級：" + display(order.service_tier || "尊榮標準服務"),
      "",
      "初步估價：" + money(order.final_price),
      "建議訂金：" + money(order.deposit_amount),
      "",
      "此為系統訂單摘要。實際派車、司機、停車等候、跨區與加值服務，將由禮賓專員最終確認。",
      "",
      "您可點選下方按鈕查看付款資訊、補充預約資料或聯繫禮賓專員。"
    ].map(safeLineText).join("\n")
  };
}

function bankTransferTextMessage(context, order) {
  const bank = bankTransferInfo(context);
  const orderId = order ? display(order.order_id) : "";
  const qrUrl = bankQrImageUrl(context);
  const lines = [
    "御澤禮賓｜付款資訊",
    "━━━━━━━━━━━━"
  ];

  if (order) {
    lines.push(
      "訂單編號：" + orderId,
      "服務項目：" + display(order.service),
      "用車日期：" + displayDate(order.date) + " " + displayTime(order.time),
      "初步估價：" + money(order.final_price),
      "建議訂金：" + money(order.deposit_amount),
      "待付金額：" + money(order.balance_amount || order.final_price || order.deposit_amount),
      ""
    );
  } else {
    lines.push(
      "目前尚未查到您的最新訂單。",
      "您仍可先查看匯款資訊；實際付款金額請依禮賓專員確認為準。",
      ""
    );
  }

  lines.push(
    "銀行：" + bank.bankName,
    "銀行代碼：" + bank.bankCode,
    "戶名：" + bank.accountName,
    "帳號：" + bank.accountNumber,
    "",
    "銀行轉帳 QR Code：",
    qrUrl,
    "",
    "付款頁面：",
    paymentPageUrl(context, orderId),
    "",
    bank.note,
    "",
    orderId ? "匯款完成後請回覆：已匯款 " + orderId + " 末五碼：" : "匯款完成後請回覆：已匯款 末五碼："
  );

  return {
    type: "text",
    text: lines.map(safeLineText).join("\n")
  };
}

function orderSummaryFlexMessage(context, order) {
  const orderId = display(order.order_id);
  const price = money(order.final_price);
  const deposit = money(order.deposit_amount);
  const balance = money(order.balance_amount);
  const statusText = orderStatusText(order.order_status || "pending");
  const paymentText = paymentStatusText(order.payment_status || "pending");

  const service = display(order.service);
  const carType = display(order.car_type || "禮賓專員確認中");
  const tier = display(order.service_tier || "尊榮標準服務");
  const tripDate = displayDate(order.date);
  const tripTime = displayTime(order.time);
  const pickup = display(order.pickup || order.airport_reception_address || order.reception_address);
  const dropoff = display(order.dropoff || order.dropoff_airport || order.reserved_airport || order.reserved_port);
  const passengers = display(order.passengers || "-");
  const luggage = display(order.luggage || "-");
  const flight = display(order.flight);
  const terminal = display(order.terminal || order.airport_terminal);

  // 加值服務集合
  const addons = [];
  if (isYesValue_(order.sign_service)) addons.push("舉牌服務");
  if (isYesValue_(order.child_seat)) addons.push("兒童座椅");
  if (isYesValue_(order.english_driver)) addons.push("英文司機");
  if (order.premium_addons && display(order.premium_addons) !== "-") addons.push(display(order.premium_addons));
  const addonText = addons.length ? addons.join("、") : "—";

  // 狀態顏色
  const statusColor = orderStatusColor_(order.order_status);
  const paymentColor = paymentStatusColor_(order.payment_status);

  return {
    type: "flex",
    altText: "御澤禮賓｜行程資訊 " + orderId,
    contents: {
      type: "bubble",
      size: "giga",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#050505",
        paddingAll: "20px",
        paddingBottom: "16px",
        contents: [
          {
            type: "box", layout: "horizontal", alignItems: "center",
            contents: [
              { type: "text", text: "御澤禮賓", color: "#D7AE54", weight: "bold", size: "lg", flex: 1 },
              { type: "text", text: "ROYAL FLOW", color: "#8F6424", size: "xxs", align: "end", flex: 0 }
            ]
          },
          { type: "text", text: "Concierge Order Summary", color: "#c7baa1", size: "xxs", margin: "xs" },
          {
            type: "box", layout: "vertical", margin: "md",
            paddingTop: "10px", paddingBottom: "10px",
            paddingStart: "12px", paddingEnd: "12px",
            backgroundColor: "#171411", cornerRadius: "8px",
            contents: [
              { type: "text", text: "訂單編號", color: "#8F6424", size: "xxs" },
              { type: "text", text: orderId, color: "#f8f2df", size: "md", weight: "bold", margin: "xs" }
            ]
          },
          {
            type: "box", layout: "horizontal", margin: "md", spacing: "sm",
            contents: [
              {
                type: "box", layout: "vertical", flex: 1,
                paddingAll: "8px", backgroundColor: "#101010", cornerRadius: "6px",
                contents: [
                  { type: "text", text: "訂單狀態", color: "#8F6424", size: "xxs" },
                  { type: "text", text: statusText, color: statusColor, size: "sm", weight: "bold", margin: "xs" }
                ]
              },
              {
                type: "box", layout: "vertical", flex: 1,
                paddingAll: "8px", backgroundColor: "#101010", cornerRadius: "6px",
                contents: [
                  { type: "text", text: "付款狀態", color: "#8F6424", size: "xxs" },
                  { type: "text", text: paymentText, color: paymentColor, size: "sm", weight: "bold", margin: "xs" }
                ]
              }
            ]
          }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#0d0a07",
        paddingAll: "20px",
        spacing: "md",
        contents: [
          // ─── 服務區塊 ─────────────────────────────
          sectionHeader_("🚘", "服務內容"),
          luxRow_("服務項目", service),
          luxRow_("禮賓等級", tier),
          luxRow_("車型需求", carType),

          { type: "separator", color: "#D7AE54", margin: "md" },

          // ─── 行程區塊 ─────────────────────────────
          sectionHeader_("📅", "用車行程"),
          luxRow_("日期", tripDate),
          luxRow_("時間", tripTime),
          luxRow_("上車地點", pickup, true),
          luxRow_("下車地點", dropoff, true),
          flight !== "-" ? luxRow_("航班資訊", flight) : { type: "filler" },
          terminal !== "-" ? luxRow_("航廈", terminal) : { type: "filler" },

          { type: "separator", color: "#D7AE54", margin: "md" },

          // ─── 乘客 ─────────────────────────────────
          sectionHeader_("👥", "乘客資訊"),
          luxRow_("乘客 / 行李", passengers + " 位 / " + luggage + " 件"),
          luxRow_("加值服務", addonText, true),

          { type: "separator", color: "#D7AE54", margin: "md" },

          // ─── 費用區塊（突出顯示） ────────────────
          sectionHeader_("💰", "費用資訊"),
          {
            type: "box", layout: "vertical",
            paddingAll: "12px",
            backgroundColor: "#171411",
            cornerRadius: "8px",
            contents: [
              {
                type: "box", layout: "horizontal",
                contents: [
                  { type: "text", text: "初步估價", color: "#c7baa1", size: "sm", flex: 2 },
                  { type: "text", text: price, color: "#D7AE54", size: "lg", weight: "bold", align: "end", flex: 3 }
                ]
              },
              {
                type: "box", layout: "horizontal", margin: "sm",
                contents: [
                  { type: "text", text: "建議訂金", color: "#c7baa1", size: "sm", flex: 2 },
                  { type: "text", text: deposit, color: "#f4d98b", size: "md", align: "end", flex: 3 }
                ]
              },
              balance !== "待確認" ? {
                type: "box", layout: "horizontal", margin: "sm",
                contents: [
                  { type: "text", text: "尾款", color: "#c7baa1", size: "sm", flex: 2 },
                  { type: "text", text: balance, color: "#c7baa1", size: "sm", align: "end", flex: 3 }
                ]
              } : { type: "filler" }
            ].filter(c => c.type !== "filler")
          },

          // ─── 提示 ─────────────────────────────────
          {
            type: "box", layout: "vertical", margin: "md",
            paddingAll: "10px",
            backgroundColor: "rgba(215,174,84,0.08)",
            cornerRadius: "6px",
            contents: [
              {
                type: "text",
                text: "✦ 實際派車、司機、跨區與加值服務，將由禮賓專員最終確認。",
                color: "#c7baa1", size: "xxs", wrap: true
              }
            ]
          }
        ].filter(c => c.type !== "filler")
      },
      footer: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#050505",
        paddingAll: "16px",
        spacing: "sm",
        contents: [
          {
            type: "button", style: "primary", color: "#D7AE54", height: "sm",
            action: { type: "message", label: "💳 付款資訊", text: "付款 " + orderId }
          },
          {
            type: "box", layout: "horizontal", spacing: "sm",
            contents: [
              {
                type: "button", style: "secondary", color: "#171411", height: "sm", flex: 1,
                action: { type: "uri", label: "修改預約", uri: bookingUrl(context) }
              },
              {
                type: "button", style: "secondary", color: "#171411", height: "sm", flex: 1,
                action: { type: "message", label: "聯繫客服", text: "客服 " + orderId }
              }
            ]
          }
        ]
      },
      styles: {
        header: { backgroundColor: "#050505" },
        body: { backgroundColor: "#0d0a07" },
        footer: { backgroundColor: "#050505" }
      }
    },
    quickReply: quickReply(context)
  };
}

// ─── 訂單卡片輔助函式 ──────────────────────────────────────
function sectionHeader_(emoji, label) {
  return {
    type: "box", layout: "horizontal", margin: "sm",
    contents: [
      { type: "text", text: emoji, size: "sm", flex: 0 },
      { type: "text", text: label, color: "#D7AE54", weight: "bold", size: "sm", margin: "sm", flex: 1 }
    ]
  };
}

function luxRow_(label, value, wrap) {
  return {
    type: "box", layout: "baseline", spacing: "sm",
    contents: [
      { type: "text", text: label, color: "#8F6424", size: "xs", flex: 3 },
      {
        type: "text",
        text: value || "-",
        color: "#f8f2df", size: "sm",
        flex: 7, wrap: wrap === true
      }
    ]
  };
}

function orderStatusColor_(status) {
  const s = String(status || "").toLowerCase();
  if (s === "completed" || s === "已完成") return "#7de0a4";
  if (s === "confirmed" || s === "已確認") return "#f4d98b";
  if (s === "dispatched" || s === "已派車") return "#D7AE54";
  if (s === "cancelled" || s === "已取消") return "#ff8a9a";
  return "#c7baa1";
}

function paymentStatusColor_(status) {
  const s = String(status || "").toLowerCase();
  if (s === "paid" || s === "已付款") return "#7de0a4";
  if (s === "refunded" || s === "已退款") return "#ff8a9a";
  if (s === "failed" || s === "失敗") return "#ff8a9a";
  return "#f4d98b";
}

function isYesValue_(input) {
  const s = String(input || "").toLowerCase().trim();
  return s === "是" || s === "yes" || s === "y" || s === "true" || s === "需要" || s === "1";
}

function bankTransferFlexMessage(context, order) {
  const bank = bankTransferInfo(context);
  const orderId = order ? display(order.order_id) : "";
  const amount = order ? money(order.balance_amount || order.final_price || order.deposit_amount) : "請依禮賓專員確認金額";
  const deposit = order ? money(order.deposit_amount) : "請依禮賓專員確認金額";

  const contents = [
    {
      type: "image",
      url: bankQrImageUrl(context),
      size: "full",
      aspectRatio: "20:31",
      aspectMode: "fit",
      backgroundColor: "#F8F8F8"
    },
    flexText("以下為銀行匯款資訊。匯款前請確認訂單編號與金額，匯款後請回傳末五碼，禮賓專員將協助核對。", true)
  ];

  if (order) {
    contents.push(
      flexInfoRow("訂單編號", orderId),
      flexInfoRow("服務項目", display(order.service)),
      flexInfoRow("用車日期", displayDate(order.date) + " " + displayTime(order.time)),
      flexInfoRow("初步估價", money(order.final_price)),
      flexInfoRow("建議訂金", deposit),
      flexInfoRow("待付金額", amount),
      flexSeparator()
    );
  } else {
    contents.push(
      flexNotice("目前尚未查到您的最新訂單。若已完成預約，請輸入「付款 RF訂單編號」查詢專屬付款資訊。"),
      flexSeparator()
    );
  }

  contents.push(
    flexInfoRow("銀行", bank.bankName),
    flexInfoRow("銀行代碼", bank.bankCode),
    flexInfoRow("戶名", bank.accountName),
    flexInfoRow("帳號", bank.accountNumber),
    flexNotice(bank.note)
  );

  return {
    type: "flex",
    altText: "御澤禮賓付款資訊" + (orderId ? " " + orderId : ""),
    contents: {
      type: "bubble",
      size: "mega",
      header: flexHeader("付款資訊", "銀行匯款 / 車資訂金"),
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#FFFFFF",
        spacing: "md",
        contents
      },
      footer: flexFooter([
        orderId ? flexMessageButton("我已匯款，回傳末五碼", "已匯款 " + orderId + " 末五碼：", "#D7AE54") : flexUriButton("先完成預約", bookingUrl(context), "#D7AE54"),
        flexMessageButton("聯繫禮賓專員", orderId ? "客服 " + orderId : "客服", "#111026")
      ])
    },
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
          flexMessageButton("寰宇商務中心", "寰宇商務中心禮賓套餐", "#D7AE54"),
          flexMessageButton("服務保障", "服務保障", "#6B7280"),
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

function universalLoungeMessage(context) {
  return {
    type: "flex",
    altText: "寰宇商務中心禮賓套餐",
    contents: {
      type: "bubble",
      size: "mega",
      header: flexHeader("寰宇商務中心禮賓套餐", "代訂禮賓服務 + 商務車 / 保姆車接送"),
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#FFFFFF",
        spacing: "md",
        contents: [
          flexText("可協助代訂寰宇商務中心禮賓服務，並依行程搭配商務車、豪華保姆車或多人保姆車。", true),
          flexSeparator(),
          flexText("可選方案", true),
          flexText("寰宇商務中心代訂", false),
          flexText("接機禮賓 + 商務車", false),
          flexText("送機禮賓 + 商務車", false),
          flexText("外賓快速接待方案", false),
          flexText("企業主管機場禮賓方案", false),
          flexText("商務車 / 保姆車 + 寰宇商務中心套餐", false),
          flexSeparator(),
          flexText("報價方式", true),
          flexText("車輛費用依所選車型、路線與用車時間計算；商務中心費用、可訂席次與禮賓服務內容需依當日方案確認。", false),
          flexNotice("請於表單選擇「寰宇商務中心禮賓套餐」，並填寫機場、航班、使用人數與需求備註。")
        ]
      },
      footer: flexFooter([
        flexUriButton("開啟套餐預約表單", bookingUrl(context), "#D7AE54"),
        flexMessageButton("需要禮賓專員協助", "客服", "#6B7280")
      ])
    },
    quickReply: quickReply(context)
  };
}

function assuranceMessage(context) {
  return {
    type: "text",
    text: [
      "御澤禮賓服務保障",
      "",
      "乘客保障：乘客保險、車況檢核、司機資格與服儀規範。",
      "車內品質：車內清潔、礦泉水、濕紙巾、充電線、薄荷糖與航班追蹤。",
      "隱私保密：企業主管、外賓、藝人名流與私人行程皆以保密原則處理。",
      "航班與等候：接送機可依航班動態協助調整接待時間；停車、等候、跨區與超時費用將於正式報價中確認。",
      "",
      "可加選 VIP 商務服務或皇家禮賓服務，包含靜音乘車、一次性拖鞋、薄毯、英文司機、舉牌接待、花束禮品代購與企業 Logo 舉牌等安排。",
      bookingUrl(context)
    ].join("\n"),
    quickReply: quickReply(context)
  };
}

function enterpriseReceptionMessage(context) {
  return {
    type: "text",
    text: [
      "企業接待與單據需求可於預約表單填寫：",
      "",
      "公司名稱 / 接待單位",
      "統一編號",
      "接待對象與接待層級",
      "正式報價單、收據或統編發票需求",
      "企業月結洽談",
      "多車調度、保密行程、英文司機與企業 Logo 舉牌",
      "",
      "禮賓專員會依車輛檔期、司機安排與行程細節，提供正式報價與付款方式。",
      bookingUrl(context)
    ].join("\n"),
    quickReply: quickReply(context)
  };
}

function vehicleCarouselMessage(context) {
  const vehicles = vehicleProfiles(context);
  return {
    type: "flex",
    altText: "御澤禮賓服務車型",
    contents: {
      type: "carousel",
      contents: vehicles.map(function(vehicle) {
        return {
          type: "bubble",
          size: "mega",
          hero: {
            type: "image",
            url: vehicle.imageUrl,
            size: "full",
            aspectRatio: "16:10",
            aspectMode: "cover"
          },
          body: {
            type: "box",
            layout: "vertical",
            backgroundColor: "#FFFFFF",
            spacing: "sm",
            contents: [
              {
                type: "text",
                text: vehicle.name,
                weight: "bold",
                color: "#111026",
                size: "lg",
                wrap: true
              },
              {
                type: "text",
                text: vehicle.summary,
                color: "#555555",
                size: "sm",
                wrap: true
              },
              flexSeparator(),
              flexText("服務：" + vehicle.service, false),
              flexText("最佳乘客：" + vehicle.bestPassengers, true)
            ]
          },
          footer: flexFooter([
            flexUriButton("選擇此車型預約", bookingUrl(context), "#D7AE54"),
            flexMessageButton("諮詢此車型", "客服 " + vehicle.name, "#6B7280")
          ])
        };
      })
    },
    quickReply: quickReply(context)
  };
}

function vehicleProfiles(context) {
  return [
    {
      name: "Lexus LM 40 / 35",
      imageUrl: assetUrl(context, "/assets/vehicles/lexus-lm.jpg"),
      summary: "旗艦級豪華保姆車，靜謐座艙與高規格後座，適合高端貴賓、企業主管與外賓長程移動。",
      service: "VIP 機場接送、企業主管、外賓接待、婚禮與外交禮賓",
      bestPassengers: "2-4 位 / 建議 2-4 件行李"
    },
    {
      name: "Toyota Alphard 40 / 35",
      imageUrl: assetUrl(context, "/assets/vehicles/toyota-alphard.jpg"),
      summary: "高端商務接送主力車型，乘坐舒適、行李彈性佳，適合機場接送、家庭貴賓與商務會議。",
      service: "機場接送、商務接送、包車旅遊、飯店貴賓接待",
      bestPassengers: "2-5 位 / 建議 3-5 件行李"
    },
    {
      name: "Toyota Granvia 6/7人座",
      imageUrl: assetUrl(context, "/assets/vehicles/toyota-granvia.png"),
      summary: "多人商務與旅遊兼具，座位與行李配置均衡，適合家庭、團體、中長程與多點接待。",
      service: "商務包車、旅遊包車、港口接送、多點接待",
      bestPassengers: "4-6 位 / 建議 4-6 件行李"
    },
    {
      name: "Benz V-Class V300d / V250d",
      imageUrl: assetUrl(context, "/assets/vehicles/benz-vclass.jpg"),
      summary: "歐系商務保姆車，座艙質感沉穩，適合外賓、會議接待、長程商務與高階團體。",
      service: "外賓接待、商務接送、會議接送、長程包車",
      bestPassengers: "3-6 位 / 建議 3-5 件行李"
    },
    {
      name: "Benz Vito 9人座",
      imageUrl: assetUrl(context, "/assets/vehicles/benz-vito.jpg"),
      summary: "團體接送實用車型，座位與行李容量平衡，適合活動、港口接送與企業車隊。",
      service: "團體接送、展演活動、港口接送、企業車隊",
      bestPassengers: "5-8 位 / 建議 5-7 件行李"
    },
    {
      name: "VW Crafter / Sprinter 旗艦8人座",
      imageUrl: assetUrl(context, "/assets/vehicles/vw-crafter.jpg"),
      summary: "大型高端保姆車，同級可安排 Sprinter 或 Crafter，適合 VIP 團體、展演活動、外交禮賓與高規格企業接待。",
      service: "VIP 團體、展演活動、外交禮賓、企業接待",
      bestPassengers: "最多 8 位 / 建議 6-8 件行李"
    }
  ];
}

// ═══════════════════════════════════════════════════════════
// 司機任務回報系統（含自動定位）
// ═══════════════════════════════════════════════════════════

const DRIVER_TASK_STAGES = [
  { key: "pre_check",       keywords: ["行前檢查", "車檢", "pre_check"],   label: "行前檢查", emoji: "🔧" },
  { key: "depart",          keywords: ["出發", "禮賓出發", "depart"],        label: "禮賓駕駛出發", emoji: "🚘" },
  { key: "arrive_pickup",   keywords: ["到點", "到達上車", "arrive_pickup"], label: "禮賓駕駛到點", emoji: "📍" },
  { key: "guest_onboard",   keywords: ["上車", "貴賓上車", "onboard"],       label: "預約貴賓上車", emoji: "👤" },
  { key: "guest_offboard",  keywords: ["下車", "貴賓下車", "offboard"],      label: "預約貴賓下車", emoji: "🛬" },
  { key: "complete",        keywords: ["服務完成", "完成", "complete"],      label: "禮賓駕駛服務完成", emoji: "✅" }
];

/**
 * 解析司機任務階段關鍵字
 * 支援：「行前檢查 RF...」、「出發」、「上車 RF...」
 */
function parseDriverTaskStage(text) {
  if (!text || text.length > 100) return null;

  const lower = text.toLowerCase();
  for (const stage of DRIVER_TASK_STAGES) {
    for (const kw of stage.keywords) {
      if (text.startsWith(kw) || lower.startsWith(kw.toLowerCase())) {
        const orderId = extractOrderId(text);
        return { ...stage, orderId, raw: text };
      }
    }
  }
  return null;
}

/**
 * 司機輸入任務階段後：暫存階段到 KV，提示傳送位置
 */
async function driverTaskStageMessage(context, userId, stage) {
  if (!userId) {
    return [{
      type: "text",
      text: "無法識別您的 LINE 身分，請從預約系統發送訊息。"
    }];
  }

  // 暫存階段到 KV（10 分鐘有效）
  const kv = context.env.ORDER_KV;
  if (kv) {
    const stageData = {
      stage_key: stage.key,
      stage_label: stage.label,
      stage_emoji: stage.emoji,
      order_id: stage.orderId || "",
      created_at: new Date().toISOString()
    };
    try {
      await kv.put("driver_task:" + userId, JSON.stringify(stageData), { expirationTtl: 600 });
    } catch (e) {
      console.log("driver task stage cache failed:", e.message);
    }
  }

  const lines = [
    stage.emoji + " 御澤禮賓｜任務回報",
    "━━━━━━━━━━━━",
    "已記錄階段：" + stage.label,
    stage.orderId ? "訂單編號：" + stage.orderId : "未指定訂單（系統將以最近接單為主）",
    "",
    "請點下方按鈕「📍 傳送目前位置」",
    "完成定位回報。",
    "",
    "若 10 分鐘內未傳送位置，本次回報將失效。"
  ];

  return [
    {
      type: "text",
      text: lines.join("\n"),
      quickReply: {
        items: [
          {
            type: "action",
            action: {
              type: "location",
              label: "📍 傳送目前位置"
            }
          },
          {
            type: "action",
            action: {
              type: "message",
              label: "取消回報",
              text: "取消回報"
            }
          }
        ]
      }
    }
  ];
}

/**
 * 處理司機傳送的位置訊息
 * 找出暫存的任務階段，合併寫入訂單
 */
async function handleDriverLocation(context, userId, locationMessage) {
  if (!userId) {
    return [{ type: "text", text: "無法識別您的 LINE 身分。" }];
  }

  const kv = context.env.ORDER_KV;
  if (!kv) {
    return [{ type: "text", text: "系統暫時無法處理任務回報（KV 未啟用）。" }];
  }

  // 讀取暫存階段
  let stageData = null;
  try {
    const raw = await kv.get("driver_task:" + userId);
    if (raw) stageData = JSON.parse(raw);
  } catch (e) {
    console.log("driver task stage read failed:", e.message);
  }

  if (!stageData) {
    return [{
      type: "text",
      text: [
        "📍 位置已收到，但目前沒有進行中的任務階段。",
        "",
        "請先輸入任務階段（含訂單編號）：",
        "• 行前檢查 RF20260616xxx",
        "• 出發",
        "• 到點",
        "• 上車",
        "• 下車",
        "• 服務完成",
        "",
        "輸入後系統會請您再次傳送位置。"
      ].join("\n")
    }];
  }

  const lat = locationMessage.latitude;
  const lng = locationMessage.longitude;
  const address = locationMessage.address || "";
  const reportedAt = new Date().toISOString();

  // 寫入 Google Sheet（透過 Apps Script）
  try {
    const result = await gasAction(context, "logDriverTaskStage", {
      lineUserId: userId,
      orderId: stageData.order_id || "",
      stageKey: stageData.stage_key,
      stageLabel: stageData.stage_label,
      latitude: lat,
      longitude: lng,
      address,
      reportedAt
    });

    // 清除暫存
    await kv.delete("driver_task:" + userId).catch(() => {});

    // 通知後台管理員（含位置詳情）
    notifyAdminDriverTaskStage(context, {
      driverLineUserId: userId,
      orderId: stageData.order_id || (result && result.matchedOrderId) || "未指定",
      stageLabel: stageData.stage_label,
      stageEmoji: stageData.stage_emoji,
      latitude: lat,
      longitude: lng,
      address,
      reportedAt,
      driverName: result && result.driverName ? result.driverName : "",
      customerName: result && result.customerName ? result.customerName : ""
    });

    // 通知客戶（不含位置詳情，只通知狀態）
    const customerLineUserId = result && result.customerLineUserId ? result.customerLineUserId : "";
    notifyCustomerDriverStage(context, {
      customerLineUserId,
      orderId: stageData.order_id || (result && result.matchedOrderId) || "",
      stageKey: stageData.stage_key,
      stageLabel: stageData.stage_label,
      stageEmoji: stageData.stage_emoji,
      reportedAt
    });

    // 回覆司機簡短確認（不洩漏客戶資訊）
    return [{
      type: "text",
      text: [
        "✅ " + stageData.stage_label + " 已回報",
        "━━━━━━━━━━━━",
        stageData.order_id ? "訂單：" + stageData.order_id : "",
        "位置：" + (address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`),
        "時間：" + new Date(reportedAt).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }),
        "",
        "已自動同步後台。感謝您的回報 🙏"
      ].filter(Boolean).join("\n")
    }];

  } catch (err) {
    console.log("logDriverTaskStage failed:", err.message);
    return [{
      type: "text",
      text: "回報已收到，但系統同步異常。請聯絡客服。"
    }];
  }
}

/**
 * 通知後台管理員（非同步、不擋使用者）
 */
function notifyAdminDriverTaskStage(context, info) {
  const adminIds = String(context.env.ADMIN_LINE_USER_ID || context.env.ADMIN_LINE_USER_IDS || "")
    .split(",").map(s => s.trim()).filter(Boolean);
  const token = context.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!adminIds.length || !token) return;

  const mapUrl = `https://maps.google.com/?q=${info.latitude},${info.longitude}`;
  const tw = new Date(info.reportedAt).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false });

  const messages = [{
    type: "flex",
    altText: `${info.stageEmoji} ${info.stageLabel}｜${info.orderId}`,
    contents: {
      type: "bubble",
      header: {
        type: "box", layout: "vertical", backgroundColor: "#111026", paddingAll: "16px",
        contents: [
          { type: "text", text: info.stageEmoji + " 司機任務回報", color: "#D7AE54", weight: "bold", size: "lg" },
          { type: "text", text: info.stageLabel, color: "#cccccc", size: "sm" }
        ]
      },
      body: {
        type: "box", layout: "vertical", spacing: "sm",
        contents: [
          { type: "text", text: "訂單：" + info.orderId, size: "sm", weight: "bold" },
          info.driverName ? { type: "text", text: "司機：" + info.driverName, size: "sm", color: "#666666" } : { type: "filler" },
          info.customerName ? { type: "text", text: "客戶：" + info.customerName, size: "sm", color: "#666666" } : { type: "filler" },
          { type: "separator", margin: "md" },
          { type: "text", text: "📍 回報位置", size: "xs", color: "#999999", margin: "md" },
          { type: "text", text: info.address || `${info.latitude.toFixed(5)}, ${info.longitude.toFixed(5)}`, size: "sm", wrap: true },
          { type: "text", text: "🕐 " + tw, size: "xs", color: "#999999", margin: "sm" }
        ].filter(c => c.type !== "filler")
      },
      footer: {
        type: "box", layout: "vertical", spacing: "sm",
        contents: [
          {
            type: "button", style: "primary", color: "#D7AE54",
            action: { type: "uri", label: "🗺 在地圖查看", uri: mapUrl }
          },
          info.orderId !== "未指定" ? {
            type: "button", style: "secondary",
            action: { type: "message", label: "查詢訂單", text: "查詢 " + info.orderId }
          } : { type: "filler" }
        ].filter(c => c.type !== "filler")
      }
    }
  }];

  const task = Promise.all(adminIds.map(adminId =>
    pushAdminMessage(context, adminId, messages).catch(e =>
      console.log("admin task notify failed:", e.message)
    )
  ));

  if (typeof context.waitUntil === "function") {
    context.waitUntil(task);
  }
}

async function pushAdminMessage(context, to, messages) {
  const token = context.env.LINE_CHANNEL_ACCESS_TOKEN;
  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
    body: JSON.stringify({ to, messages })
  });
  if (!response.ok) {
    throw new Error("push failed: " + response.status);
  }
}

/**
 * 通知預約客戶 — 司機進入特定階段時
 * 客戶不會收到位置詳情，只收到階段通知（讓客戶知道司機狀態）
 */
function notifyCustomerDriverStage(context, info) {
  if (!info.customerLineUserId || info.customerLineUserId === "LINE_NOT_READY") return;

  // 只在「出發」「到點」「服務完成」三個階段通知客戶
  const notifyStages = ["depart", "arrive_pickup", "complete"];
  if (!notifyStages.includes(info.stageKey)) return;

  const token = context.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return;

  // 客戶看到的訊息（友善版，不含經緯度）
  const customerLabels = {
    depart: { title: "🚘 您的禮賓駕駛已出發", subtitle: "正前往上車地點，請耐心等候" },
    arrive_pickup: { title: "📍 您的禮賓駕駛已抵達", subtitle: "請於約定時間至上車地點" },
    complete: { title: "✅ 本次行程已圓滿完成", subtitle: "感謝您選擇御澤禮賓" }
  };

  const label = customerLabels[info.stageKey];
  if (!label) return;

  const tw = new Date(info.reportedAt).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false });

  const messages = [{
    type: "flex",
    altText: label.title,
    contents: {
      type: "bubble",
      header: {
        type: "box", layout: "vertical", backgroundColor: "#111026", paddingAll: "16px",
        contents: [
          { type: "text", text: label.title, color: "#D7AE54", weight: "bold", size: "lg", wrap: true },
          { type: "text", text: label.subtitle, color: "#cccccc", size: "sm", wrap: true }
        ]
      },
      body: {
        type: "box", layout: "vertical", spacing: "sm",
        contents: [
          info.orderId ? { type: "text", text: "訂單：" + info.orderId, size: "sm", color: "#666666" } : { type: "filler" },
          { type: "text", text: "時間：" + tw, size: "sm", color: "#666666" },
          { type: "separator", margin: "md" },
          {
            type: "text",
            text: "如有任何需求，請於 LINE 直接告訴禮賓專員 🙏",
            size: "xs", color: "#888888", wrap: true, margin: "md"
          }
        ].filter(c => c.type !== "filler")
      }
    }
  }];

  const task = pushAdminMessage(context, info.customerLineUserId, messages)
    .catch(e => console.log("customer stage notify failed:", e.message));

  if (typeof context.waitUntil === "function") {
    context.waitUntil(task);
  }
}

// ─── 司機接單回覆 ──────────────────────────────────────────
async function driverAcceptMessage(context, userId, text) {
  const orderId = extractOrderId(text);
  if (!orderId) {
    return {
      type: "text",
      text: "請提供訂單編號，例如：接單 RF20260616184411244"
    };
  }

  try {
    const result = await gasAction(context, "getOrder", { orderId });
    if (!result || result.status !== "success" || !result.order) {
      return {
        type: "text",
        text: "查無此訂單編號：" + orderId
      };
    }

    return {
      type: "text",
      text: [
        "✅ 御澤禮賓｜接單確認",
        "━━━━━━━━━━━━",
        "訂單：" + orderId,
        "客戶：" + (result.order.name || "-"),
        "日期：" + (result.order.date || "-") + " " + (result.order.time || "-"),
        "",
        "已記錄您的接單意願。",
        "禮賓客服將於系統內標記指派並通知客戶您的車輛資訊。"
      ].join("\n")
    };
  } catch (err) {
    return {
      type: "text",
      text: "接單記錄失敗：" + (err.message || "請聯絡客服")
    };
  }
}

// ─── AI 自動報價：自然語言解析（強化版）─────────────────────
function parseAutoQuoteIntent(text) {
  if (!text || text.length < 5 || text.length > 300) return null;

  // 跳過已有命令關鍵字的訊息
  const skipKeywords = [
    "查詢", "付款", "訂單", "客服", "預約", "選單", "測試",
    "接單", "同步", "更新", "test", "ping", "hi", "hello",
    "行前檢查", "出發", "到點", "上車", "下車", "服務完成", "取消回報"
  ];
  for (const k of skipKeywords) {
    if (text.toLowerCase().startsWith(k.toLowerCase()) || text.startsWith(k)) return null;
  }

  // ━━━ 先從整段文字抽出附加資訊（人數、行李、時間等）━━━
  const extras = extractTripExtras(text);

  // ━━━ 路線解析（多模式）━━━
  // 先清理可能干擾的句尾（多少、要多少錢...）
  let workText = text;
  const trailingNoise = /[,，。、\s]*(多少錢?|要多少|報價|估價|費用|車資|價錢|價格|怎麼算|請問|幫我|可以嗎|請報價|想知道|請問一下)[\s\S]*$/;
  workText = workText.replace(trailingNoise, "").trim();

  // 模式：A 到/至/→/-> /前往/出發到 B
  const patterns = [
    /^(.+?)\s*[到至→]+\s*(.+?)$/,
    /^從\s*(.+?)\s*[到至→]+\s*(.+?)$/,
    /^(.+?)\s*-+>\s*(.+?)$/,
    /^(.+?)\s*前往\s*(.+?)$/,
    /^(.+?)\s*出發\s*[到至]\s*(.+?)$/
  ];

  for (const pattern of patterns) {
    const m = workText.match(pattern);
    if (m) {
      let origin = m[1].trim();
      let destination = m[2].trim();

      // 移除人數行李等資訊（避免污染地點名稱）
      origin = cleanLocationName(origin);
      destination = cleanLocationName(destination);

      if (origin.length < 2 || destination.length < 2) continue;
      if (origin.length > 50 || destination.length > 50) continue;

      // 偵測機場 / 港口
      const airportKw = /(桃園機場|松山機場|台中機場|高雄機場|小港機場|TPE|TSA|RMQ|KHH)/i;
      const portKw = /(基隆港|台北港|蘇澳港|台中港|高雄港|花蓮港|布袋港|馬公港)/i;
      const isAirport = airportKw.test(origin) || airportKw.test(destination);
      const isPort = portKw.test(origin) || portKw.test(destination);

      return {
        origin,
        destination,
        isAirport,
        isPort,
        extras,
        raw: text
      };
    }
  }

  return null;
}

// 從整段文字抽取人數、行李、時間等附加資訊
function extractTripExtras(text) {
  const extras = {};

  // 人數：「6位」「6人」「人數6」「6個人」「passenger 6」
  const paxMatch = text.match(/(?:人數|乘客)?\s*(\d{1,2})\s*[位人個](?:大人)?|passenger[s]?\s*[:：]?\s*(\d{1,2})/i);
  if (paxMatch) extras.passengers = parseInt(paxMatch[1] || paxMatch[2]);

  // 行李：「行李7件」「7件行李」「luggage 7」
  const lugMatch = text.match(/行李\s*(\d{1,2})\s*件|(\d{1,2})\s*件\s*行李|luggage[s]?\s*[:：]?\s*(\d{1,2})/i);
  if (lugMatch) extras.luggage = parseInt(lugMatch[1] || lugMatch[2] || lugMatch[3]);

  // 兒童座椅
  if (/兒童座椅|安全座椅|child\s*seat|baby\s*seat/i.test(text)) extras.childSeat = "是";

  // 舉牌
  if (/舉牌|接機牌|sign[\s-]?service|meet\s*&?\s*greet/i.test(text)) extras.signService = "是";

  // 英文司機
  if (/英文司機|english\s*driver/i.test(text)) extras.englishDriver = "是";

  // 日期（簡單抓 yyyy/MM/dd 或 MM/dd）
  const dateMatch = text.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})|(\d{1,2})[\/\-](\d{1,2})(?![\d\/])/);
  if (dateMatch) {
    if (dateMatch[1]) extras.date = `${dateMatch[1]}/${dateMatch[2].padStart(2,"0")}/${dateMatch[3].padStart(2,"0")}`;
    else {
      const year = new Date().getFullYear();
      extras.date = `${year}/${dateMatch[4].padStart(2,"0")}/${dateMatch[5].padStart(2,"0")}`;
    }
  }

  // 時間（HH:MM）
  const timeMatch = text.match(/(\d{1,2})[:：](\d{2})/);
  if (timeMatch) extras.time = `${timeMatch[1].padStart(2,"0")}:${timeMatch[2]}`;

  return extras;
}

// 御澤禮賓車型推薦邏輯（依乘客人數）
function recommendVehicleByPax_(pax) {
  const n = Number(pax) || 1;

  if (n <= 2) {
    return {
      tierLabel: "頂級禮賓",
      primary: "LEXUS LM",
      alternatives: ["Toyota Alphard", "Mercedes-Benz V-Class V300d"],
      description: "頂級禮賓・多人商務・旅遊・機場接送"
    };
  }

  if (n <= 4) {
    return {
      tierLabel: "高端商務",
      primary: "Mercedes-Benz V-Class V300d",
      alternatives: ["Mercedes-Benz V-Class V250d", "Toyota Alphard", "Mercedes-Benz VITO 豪華版"],
      description: "豪華版・多人商務・旅遊・機場接送"
    };
  }

  if (n <= 6) {
    return {
      tierLabel: "高端禮賓",
      primary: "Mercedes-Benz VITO 豪華版",
      alternatives: ["Toyota GranVia", "Mercedes-Benz V-Class V300d", "Toyota Alphard"],
      description: "高端禮賓・多人商務・旅遊・機場接送"
    };
  }

  if (n <= 8) {
    return {
      tierLabel: "大型保姆車",
      primary: "Mercedes-Benz Sprinter",
      alternatives: ["VW Crafter", "Mercedes-Benz VITO 9人座", "Toyota GranVia"],
      description: "大型保姆車・多人商務・旅遊・機場接送（最多 8 位）"
    };
  }

  return {
    tierLabel: "包車服務",
    primary: "請聯繫客服安排",
    alternatives: ["可協調多輛車隊調度"],
    description: "9 位以上請由禮賓專員協助規劃車隊調度"
  };
}

// 清理地點名稱（移除附加描述）
function cleanLocationName(loc) {
  return loc
    // 去除句首句尾標點
    .replace(/^[，,、。\s]+|[，,、。\s]+$/g, "")
    // 去除人數行李等資訊
    .replace(/[,，、]?\s*\d+\s*[位人個](?:大人)?(?:行李\s*\d+\s*件)?\s*$/g, "")
    .replace(/[,，、]?\s*行李\s*\d+\s*件\s*$/g, "")
    .replace(/[,，、]?\s*\d+\s*件\s*行李\s*$/g, "")
    .replace(/[,，、]?\s*(兒童座椅|安全座椅|舉牌|英文司機).*$/g, "")
    // 去除多餘空白
    .trim();
}

async function autoQuoteMessages(context, intent) {
  const { origin, destination, isAirport, isPort, extras = {} } = intent;

  try {
    // 呼叫 Apps Script 拿距離跟報價
    const estimate = await gasAction(context, "getRouteEstimate", { origin, destination });

    if (!estimate || estimate.status !== "success") {
      return [aiQuoteFallbackMessage(context, intent, estimate)];
    }

    const distanceKm = estimate.distanceKm || estimate.distance_km || 0;
    const durationMin = estimate.durationMin || estimate.duration_min || 0;

    // 依人數推薦車型（御澤禮賓車隊配置）
    const passengers = extras.passengers || 2;
    const luggage = extras.luggage || 2;
    const recommendation = recommendVehicleByPax_(passengers);
    const recommendedCar = recommendation.primary;
    const alternativeCars = recommendation.alternatives;

    // 呼叫 previewQuote 拿真實報價
    const quote = await gasAction(context, "previewQuote", {
      service: isAirport ? "機場接送" : (isPort ? "港口接送" : "商務接送"),
      carType: recommendedCar,
      pickup: origin,
      dropoff: destination,
      distanceKm,
      durationMin,
      passengers,
      luggage,
      childSeat: extras.childSeat || "",
      signService: extras.signService || "",
      englishDriver: extras.englishDriver || ""
    });

    const finalPrice = quote && quote.finalPrice ? Number(quote.finalPrice) : 0;
    const depositAmount = quote && quote.depositAmount ? Number(quote.depositAmount) : 0;

    return [aiQuoteResultMessage(context, intent, {
      distanceKm,
      durationMin,
      finalPrice,
      depositAmount,
      recommendedCar,
      alternativeCars,
      paxTier: recommendation.tierLabel,
      passengers,
      luggage,
      extras,
      breakdown: quote && quote.breakdown
    })];

  } catch (error) {
    console.log("AI auto quote failed:", error && error.message ? error.message : String(error));
    return [aiQuoteFallbackMessage(context, intent, null)];
  }
}

function aiQuoteResultMessage(context, intent, data) {
  const { origin, destination, isAirport, isPort } = intent;
  const {
    distanceKm, durationMin, finalPrice, depositAmount,
    recommendedCar = "Mercedes-Benz V-Class",
    alternativeCars = [],
    paxTier = "",
    passengers = 2, luggage = 2, extras = {}
  } = data;

  const serviceLabel = isAirport ? "機場接送" : (isPort ? "港口接送" : "商務接送");

  // 浮動區間 ±5%
  const lo = finalPrice ? Math.floor(finalPrice * 0.95 / 100) * 100 : 0;
  const hi = finalPrice ? Math.ceil(finalPrice * 1.05 / 100) * 100 : 0;

  const priceText = finalPrice
    ? `NT$ ${lo.toLocaleString()} ～ ${hi.toLocaleString()}`
    : "禮賓專員為您確認";

  // 加值服務清單
  const addons = [];
  if (extras.signService) addons.push("舉牌服務");
  if (extras.childSeat) addons.push("兒童座椅");
  if (extras.englishDriver) addons.push("英文司機");
  const addonText = addons.length ? addons.join("、") : "—";

  // ─── 車型推薦區塊（含等級 + 主推 + 備選）─────────────────
  const vehicleBlock = {
    type: "box", layout: "vertical",
    paddingAll: "12px",
    backgroundColor: "#171411",
    cornerRadius: "8px",
    margin: "md",
    contents: [
      paxTier ? {
        type: "text", text: "🚘 " + paxTier, color: "#D7AE54", size: "xs", weight: "bold"
      } : { type: "filler" },
      {
        type: "text", text: recommendedCar,
        color: "#f8f2df", size: "md", weight: "bold", margin: "xs", wrap: true
      },
      alternativeCars.length ? {
        type: "text",
        text: "備選：" + alternativeCars.join("、"),
        color: "#c7baa1", size: "xxs", wrap: true, margin: "sm"
      } : { type: "filler" }
    ].filter(c => c.type !== "filler")
  };

  // 行程詳細資訊
  const detailRows = [
    {
      type: "box", layout: "baseline", spacing: "sm",
      contents: [
        { type: "text", text: "乘客 / 行李", color: "#8F6424", size: "xs", flex: 3 },
        { type: "text", text: passengers + " 位 / " + luggage + " 件", color: "#f8f2df", size: "sm", flex: 5 }
      ]
    },
    {
      type: "box", layout: "baseline", spacing: "sm",
      contents: [
        { type: "text", text: "預估距離", color: "#8F6424", size: "xs", flex: 3 },
        { type: "text", text: distanceKm + " km", color: "#f8f2df", size: "sm", flex: 5 }
      ]
    },
    {
      type: "box", layout: "baseline", spacing: "sm",
      contents: [
        { type: "text", text: "預估時間", color: "#8F6424", size: "xs", flex: 3 },
        { type: "text", text: durationMin + " 分鐘", color: "#f8f2df", size: "sm", flex: 5 }
      ]
    }
  ];

  if (addons.length) {
    detailRows.push({
      type: "box", layout: "baseline", spacing: "sm",
      contents: [
        { type: "text", text: "加值服務", color: "#8F6424", size: "xs", flex: 3 },
        { type: "text", text: addonText, color: "#D7AE54", size: "sm", flex: 5, wrap: true }
      ]
    });
  }

  return {
    type: "flex",
    altText: `AI 智慧報價：${origin} → ${destination}`,
    contents: {
      type: "bubble",
      size: "giga",
      header: {
        type: "box", layout: "vertical", backgroundColor: "#050505", paddingAll: "18px",
        contents: [
          {
            type: "box", layout: "horizontal", alignItems: "center",
            contents: [
              { type: "text", text: "🤖 AI 智慧報價", color: "#D7AE54", weight: "bold", size: "lg", flex: 1 },
              { type: "text", text: "ROYAL FLOW", color: "#8F6424", size: "xxs", align: "end", flex: 0 }
            ]
          },
          { type: "text", text: serviceLabel, color: "#c7baa1", size: "xs", margin: "xs" }
        ]
      },
      body: {
        type: "box", layout: "vertical", backgroundColor: "#0d0a07", paddingAll: "18px", spacing: "sm",
        contents: [
          // 路線
          {
            type: "box", layout: "vertical", spacing: "xs",
            contents: [
              { type: "text", text: "📍 路線", color: "#8F6424", size: "xs" },
              { type: "text", text: origin, color: "#f8f2df", size: "sm", wrap: true, weight: "bold" },
              { type: "text", text: "→ " + destination, color: "#D7AE54", size: "sm", wrap: true, weight: "bold" }
            ]
          },
          // 車型推薦
          vehicleBlock,
          { type: "separator", color: "#D7AE54", margin: "md" },
          // 詳細資訊
          ...detailRows,
          { type: "separator", color: "#D7AE54", margin: "md" },
          // 費用
          {
            type: "box", layout: "vertical", paddingAll: "12px",
            backgroundColor: "#171411", cornerRadius: "8px",
            contents: [
              { type: "text", text: "💰 預估費用", color: "#8F6424", size: "xs" },
              { type: "text", text: priceText, color: "#D7AE54", size: "xl", weight: "bold", margin: "xs" },
              depositAmount ? {
                type: "text",
                text: "建議訂金：NT$ " + depositAmount.toLocaleString(),
                color: "#c7baa1", size: "xxs", margin: "sm"
              } : { type: "filler" }
            ].filter(c => c.type !== "filler")
          },
          // 提示
          {
            type: "text",
            text: "✦ 本報價依距離自動計算。最終費用由禮賓專員依車型、時段、加值服務確認。",
            color: "#8F6424", size: "xxs", wrap: true, margin: "md"
          }
        ]
      },
      footer: {
        type: "box", layout: "vertical", backgroundColor: "#050505", paddingAll: "16px", spacing: "sm",
        contents: [
          {
            type: "button", style: "primary", color: "#D7AE54", height: "sm",
            action: { type: "uri", label: "✨ 立即預約", uri: bookingUrl(context) }
          },
          {
            type: "box", layout: "horizontal", spacing: "sm",
            contents: [
              {
                type: "button", style: "secondary", color: "#171411", height: "sm", flex: 1,
                action: { type: "message", label: "換車型", text: "車型" }
              },
              {
                type: "button", style: "secondary", color: "#171411", height: "sm", flex: 1,
                action: { type: "message", label: "聯繫客服", text: "客服" }
              }
            ]
          }
        ]
      }
    },
    quickReply: quickReply(context)
  };
}

function aiQuoteFallbackMessage(context, intent, estimate) {
  const reason = estimate && estimate.message ? `（${estimate.message}）` : "";
  return {
    type: "text",
    text: [
      `🤖 AI 自動報價`,
      `━━━━━━━━━━━━`,
      `已偵測您查詢：${intent.origin} → ${intent.destination}`,
      "",
      `目前無法即時計算路程${reason}，建議您：`,
      "",
      "1. 開啟預約表單，使用「取得路線估價」可得即時 Google Routes 結果",
      "2. 或直接告訴專員需求細節，我們將為您快速回覆",
      "",
      "預約表單：" + bookingUrl(context)
    ].join("\n"),
    quickReply: quickReply(context)
  };
}

function quoteGuideMessage(context) {
  return {
      type: "text",
      text: [
        "御澤禮賓將依您的車型需求、行程路線、用車時間與加值服務，先行提供初步費用估算。",
      "禮賓等級可選：尊榮標準服務、VIP 商務服務、皇家禮賓服務。亦可加選怡雲礦泉水、氣泡水、咖啡/茶飲、一次性拖鞋、車內薄毯、靜音乘車、花束禮品代購與企業 Logo 舉牌等服務。",
      "寰宇商務中心禮賓套餐可依商務車、保姆車等不同車型估算車資；商務中心席次與禮賓服務實際費用將由專員另行確認。",
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

function flexInfoRow(label, value) {
  return {
    type: "box",
    layout: "horizontal",
    spacing: "sm",
    contents: [
      {
        type: "text",
        text: label,
        size: "xs",
        color: "#8A6728",
        flex: 3,
        wrap: true
      },
      {
        type: "text",
        text: display(value),
        size: "sm",
        color: "#222222",
        weight: "bold",
        flex: 5,
        wrap: true
      }
    ]
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
      quickMessage("服務車型", "服務車型"),
      quickMessage("禮賓估價", "報價"),
      quickMessage("服務保障", "服務保障"),
      quickMessage("訂單查詢", "訂單查詢"),
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

async function lineProfileName(channelAccessToken, userId) {
  try {
    const response = await fetch("https://api.line.me/v2/bot/profile/" + encodeURIComponent(userId), {
      headers: {
        Authorization: "Bearer " + channelAccessToken
      }
    });

    if (!response.ok) {
      console.log("LINE profile lookup failed", response.status);
      return "";
    }

    const profile = await response.json();
    return String(profile.displayName || "").trim();
  } catch (error) {
    console.log("LINE profile lookup error", error && error.message ? error.message : String(error));
    return "";
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

function assetUrl(context, path) {
  const base = context.env.PUBLIC_BASE_URL || "https://royal-flow-liff.pages.dev";
  return base.replace(/\/$/, "") + path;
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

function money(input) {
  const amount = Number(input || 0);
  if (!amount) {
    return "待確認";
  }
  return "NT$ " + amount.toLocaleString("zh-TW");
}

function orderStatusText(input) {
  const status = String(input || "").toLowerCase();
  if (status === "confirmed") return "已確認";
  if (status === "cancelled" || status === "canceled") return "已取消";
  if (status === "completed") return "已完成";
  if (status === "pending") return "禮賓專員確認中";
  return display(input);
}

function paymentStatusText(input) {
  const status = String(input || "").toLowerCase();
  if (status === "paid") return "已付款";
  if (status === "failed") return "付款失敗";
  if (status === "refunded") return "已退款";
  if (status === "pending") return "待付款 / 待核對";
  return display(input);
}

function bankTransferInfo(context) {
  const bankName = context.env.BANK_NAME || "銀行帳號尚未設定";
  const bankCode = context.env.BANK_CODE || "請洽禮賓專員";
  const accountName = context.env.BANK_ACCOUNT_NAME || context.env.BANK_HOLDER || "請洽禮賓專員";
  const accountNumber = context.env.BANK_ACCOUNT_NUMBER || context.env.BANK_ACCOUNT || "請洽禮賓專員";
  const note = context.env.BANK_TRANSFER_NOTE ||
    "匯款後請於 LINE 回傳訂單編號、匯款末五碼與匯款金額。若銀行資料尚未設定，請先聯繫禮賓專員確認。";

  return {
    bankName,
    bankCode,
    accountName,
    accountNumber,
    note
  };
}

function bankQrImageUrl(context) {
  return context.env.BANK_QR_IMAGE_URL || assetUrl(context, "/assets/payment/ctbc-bank-qr.jpg");
}

function paymentPageUrl(context, orderId) {
  const base = context.env.PAYMENT_PAGE_URL || assetUrl(context, "/payment.html");
  if (!orderId) {
    return base;
  }
  return base + (base.indexOf("?") >= 0 ? "&" : "?") + "orderId=" + encodeURIComponent(orderId);
}

function bankOnlineUrl(context) {
  return context.env.BANK_ONLINE_URL || "https://www.ctbcbank.com/";
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
