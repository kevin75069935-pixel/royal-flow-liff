/**
 * 把行程提醒 + 評價邀請功能加到 Apps Script Code.gs
 * 用法：node tools/patch-apps-script.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(__dirname, "..", "apps-script", "Code.gs");

let content = fs.readFileSync(FILE, "utf8");

// 備份
const backupPath = FILE + ".bak-before-reminder";
fs.writeFileSync(backupPath, content, "utf8");
console.log("✅ 已備份到 " + backupPath);

// ─── 1. 在 doPost 加入新 actions ─────────────────────────────
const newActionsBlock = `
    if (action === "sendTripReminders") {
      return jsonOutput(sendTripReminders(payload));
    }

    if (action === "sendReviewInvitations") {
      return jsonOutput(sendReviewInvitations(payload));
    }

    if (action === "installScheduledTriggers") {
      return jsonOutput(installScheduledTriggers());
    }
`;

if (content.includes('action === "installScheduledTriggers"')) {
  console.log("⚠️  actions 已存在，跳過 doPost 修改");
} else {
  const marker = 'if (action === "setupPricingSheets") {';
  const idx = content.indexOf(marker);
  if (idx > 0) {
    // 找到下一個 }
    const closeIdx = content.indexOf("}", idx);
    if (closeIdx > 0) {
      content = content.slice(0, closeIdx + 1) + "\n" + newActionsBlock + content.slice(closeIdx + 1);
      console.log("✅ doPost 加入 3 個新 actions");
    }
  } else {
    console.log("❌ 找不到 setupPricingSheets marker");
  }
}

// ─── 2. 在檔案末尾加入提醒 + 評價模組 ────────────────────────
const reminderModule = `

// ═══════════════════════════════════════════════════════════
// 行程提醒 + 評價回收（time-trigger 排程）
// ═══════════════════════════════════════════════════════════

const REMINDER_24H_FIELD = "提醒_24h_sent";
const REMINDER_3H_FIELD = "提醒_3h_sent";
const REVIEW_INVITE_FIELD = "評價邀請_sent";
const REMINDER_HEADERS = [REMINDER_24H_FIELD, REMINDER_3H_FIELD, REVIEW_INVITE_FIELD];

/**
 * 一次性安裝：建立每 30 分鐘的排程
 * 第一次部署時手動執行 installScheduledTriggers()，或從 webhook 呼叫
 */
function installScheduledTriggers() {
  const existing = ScriptApp.getProjectTriggers();
  existing.forEach(function(t) {
    if (t.getHandlerFunction() === "runScheduledReminders") {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger("runScheduledReminders")
    .timeBased()
    .everyMinutes(30)
    .create();

  return { status: "success", message: "已安裝每 30 分鐘執行的提醒排程" };
}

/**
 * 排程主入口：依序執行提醒與評價邀請
 */
function runScheduledReminders() {
  try {
    const r1 = sendTripReminders({});
    const r2 = sendReviewInvitations({});
    Logger.log("Reminder run: " + JSON.stringify({ trip: r1, review: r2 }));
  } catch (err) {
    Logger.log("runScheduledReminders failed: " + (err && err.message ? err.message : err));
  }
}

/**
 * 行程提醒：24 小時前 + 3 小時前各發一次
 */
function sendTripReminders(payload) {
  const sheet = getOrdersSheet();
  if (!sheet) return { status: "error", message: "找不到訂單表" };

  ensureReminderHeaders_(sheet);

  const orders = sheetToObjects(sheet);
  const now = new Date();
  const token = getLineToken_();
  let sent24h = 0, sent3h = 0, skipped = 0;

  for (const order of orders) {
    if (!order.line_user_id || order.line_user_id === "LINE_NOT_READY") continue;
    if (isOrderCancelled_(order)) { skipped++; continue; }

    const tripTime = parseTripDateTime_(order);
    if (!tripTime) continue;

    const hoursUntil = (tripTime.getTime() - now.getTime()) / 3600000;

    if (hoursUntil >= 23 && hoursUntil <= 25 && !order[REMINDER_24H_FIELD] && !order["reminder_24h_sent"]) {
      if (token) {
        try {
          pushLineMessage_(token, order.line_user_id, build24hReminder_(order));
          markOrderField_(sheet, order.order_id, REMINDER_24H_FIELD, new Date().toISOString());
          sent24h++;
        } catch (e) {
          Logger.log("24h reminder failed for " + order.order_id + ": " + e.message);
        }
      }
    }

    if (hoursUntil >= 2 && hoursUntil <= 4 && !order[REMINDER_3H_FIELD] && !order["reminder_3h_sent"]) {
      if (token) {
        try {
          pushLineMessage_(token, order.line_user_id, build3hReminder_(order));
          markOrderField_(sheet, order.order_id, REMINDER_3H_FIELD, new Date().toISOString());
          sent3h++;
        } catch (e) {
          Logger.log("3h reminder failed for " + order.order_id + ": " + e.message);
        }
      }
    }
  }

  return { status: "success", sent24h: sent24h, sent3h: sent3h, skipped: skipped };
}

/**
 * 評價邀請：完成後 6-72 小時內發
 */
function sendReviewInvitations(payload) {
  const sheet = getOrdersSheet();
  if (!sheet) return { status: "error", message: "找不到訂單表" };

  ensureReminderHeaders_(sheet);

  const orders = sheetToObjects(sheet);
  const now = new Date();
  const token = getLineToken_();
  let sent = 0;

  for (const order of orders) {
    if (!order.line_user_id || order.line_user_id === "LINE_NOT_READY") continue;
    if (order[REVIEW_INVITE_FIELD] || order["review_invite_sent"]) continue;

    const status = String(order.order_status || "").toLowerCase();
    if (status !== "completed" && status !== "已完成") continue;

    const tripTime = parseTripDateTime_(order);
    if (!tripTime) continue;

    const hoursSince = (now.getTime() - tripTime.getTime()) / 3600000;

    if (hoursSince >= 6 && hoursSince <= 72) {
      if (token) {
        try {
          pushLineMessage_(token, order.line_user_id, buildReviewInvitation_(order));
          markOrderField_(sheet, order.order_id, REVIEW_INVITE_FIELD, new Date().toISOString());
          sent++;
        } catch (e) {
          Logger.log("review invitation failed for " + order.order_id + ": " + e.message);
        }
      }
    }
  }

  return { status: "success", sent: sent };
}

// ─── 訊息範本 ────────────────────────────────────────────────
function build24hReminder_(order) {
  return [{
    type: "text",
    text: [
      "🚘 御澤禮賓｜行程提醒",
      "━━━━━━━━━━━━",
      "您明日的禮賓用車即將到來，提前為您確認資訊：",
      "",
      "訂單：" + safeStr_(order.order_id),
      "日期：" + safeStr_(order.date) + " " + safeStr_(order.time),
      "上車：" + safeStr_(order.pickup || order.airport_reception_address || order.reception_address),
      "下車：" + safeStr_(order.dropoff || order.dropoff_airport || order.reserved_airport),
      "",
      "如需調整時間、地點或乘客人數，請於 LINE 直接告訴禮賓專員 🙏",
      "司機資訊將於用車前 3 小時提供。"
    ].join("\\n")
  }];
}

function build3hReminder_(order) {
  return [{
    type: "text",
    text: [
      "🚘 御澤禮賓｜3 小時提醒",
      "━━━━━━━━━━━━",
      "您的禮賓用車將於 3 小時後展開：",
      "",
      "訂單：" + safeStr_(order.order_id),
      "時間：" + safeStr_(order.date) + " " + safeStr_(order.time),
      "上車：" + safeStr_(order.pickup || order.airport_reception_address || order.reception_address),
      "",
      "司機資訊：" + safeStr_(order.driver_note || "禮賓專員稍後提供"),
      "",
      "如有任何最後調整，請立即告訴專員。祝您行程愉快 ✨"
    ].join("\\n")
  }];
}

function buildReviewInvitation_(order) {
  const reviewUrl = getReviewUrl_();
  return [{
    type: "text",
    text: [
      "🚘 御澤禮賓｜感謝您的搭乘",
      "━━━━━━━━━━━━",
      "您訂單 " + safeStr_(order.order_id) + " 已完成。",
      "感謝您選擇御澤禮賓商務 🙏",
      "",
      "若您對本次服務感到滿意，懇請為我們留下 Google 評價：",
      reviewUrl,
      "",
      "您的肯定是我們持續精進的動力 ✨",
      "歡迎再次蒞臨。"
    ].join("\\n")
  }];
}

// ─── 工具函式 ────────────────────────────────────────────────
function getLineToken_() {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty("LINE_CHANNEL_ACCESS_TOKEN") || "";
}

function getReviewUrl_() {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty("REVIEW_URL") || "https://g.page/r/royal-flow-concierge/review";
}

function ensureReminderHeaders_(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) return;
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const missing = [];
  for (const h of REMINDER_HEADERS) {
    if (!headers.includes(h)) missing.push(h);
  }
  if (missing.length > 0) {
    sheet.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
  }
}

function isOrderCancelled_(order) {
  const status = String(order.order_status || "").toLowerCase();
  return status === "cancelled" || status === "已取消";
}

function parseTripDateTime_(order) {
  const dateRaw = String(order.date || "").trim();
  const timeRaw = String(order.time || "").trim();
  if (!dateRaw) return null;

  let datePart = dateRaw.split(" ")[0].replace(/-/g, "/");
  if (!datePart.match(/^\\d{4}\\/\\d{1,2}\\/\\d{1,2}/)) {
    try {
      const d = new Date(dateRaw);
      if (isNaN(d.getTime())) return null;
      datePart = Utilities.formatDate(d, "Asia/Taipei", "yyyy/MM/dd");
    } catch (e) { return null; }
  }

  let timePart = "09:00";
  const tm = timeRaw.match(/(\\d{1,2}):(\\d{2})/);
  if (tm) timePart = tm[1].padStart(2, "0") + ":" + tm[2];

  const dt = new Date(datePart.replace(/\\//g, "-") + "T" + timePart + ":00+08:00");
  return isNaN(dt.getTime()) ? null : dt;
}

function pushLineMessage_(token, to, messages) {
  const response = UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", {
    method: "post",
    contentType: "application/json",
    headers: { "Authorization": "Bearer " + token },
    payload: JSON.stringify({ to: to, messages: messages }),
    muteHttpExceptions: true
  });
  if (response.getResponseCode() >= 300) {
    throw new Error("LINE push failed: " + response.getContentText().substring(0, 200));
  }
}

function markOrderField_(sheet, orderId, fieldKey, value) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  let idCol = -1, targetCol = -1;
  for (let i = 0; i < headers.length; i++) {
    if (canonicalHeaderKey(headers[i]) === "order_id") idCol = i + 1;
    if (headers[i] === fieldKey) targetCol = i + 1;
  }
  if (idCol < 1 || targetCol < 1) return;

  const ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === String(orderId).trim()) {
      sheet.getRange(i + 2, targetCol).setValue(value);
      return;
    }
  }
}

function safeStr_(input) {
  if (input === null || input === undefined) return "-";
  const s = String(input).trim();
  return s ? s : "-";
}
`;

if (content.includes("function runScheduledReminders")) {
  console.log("⚠️  提醒模組已存在，跳過追加");
} else {
  content = content + reminderModule + "\n";
  console.log("✅ 提醒 + 評價模組已加到末尾");
}

fs.writeFileSync(FILE, content, "utf8");
console.log("✅ Code.gs 已更新，總長度: " + content.length + " 字元");
