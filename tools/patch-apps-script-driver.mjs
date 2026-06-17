/**
 * 把司機任務回報系統加到 Apps Script
 * 用法：node tools/patch-apps-script-driver.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(__dirname, "..", "apps-script", "Code.gs");

let content = fs.readFileSync(FILE, "utf8");

// 備份
const backupPath = FILE + ".bak-before-driver-task";
fs.writeFileSync(backupPath, content, "utf8");
console.log("✅ 已備份到 " + backupPath);

// 1. 在 doPost 加入 logDriverTaskStage action
if (content.includes('action === "logDriverTaskStage"')) {
  console.log("⚠️  logDriverTaskStage action 已存在");
} else {
  const marker = 'if (action === "installScheduledTriggers")';
  const idx = content.indexOf(marker);
  if (idx > 0) {
    const closeIdx = content.indexOf("}", idx);
    if (closeIdx > 0) {
      const newAction = `

    if (action === "logDriverTaskStage") {
      return jsonOutput(logDriverTaskStage(payload));
    }`;
      content = content.slice(0, closeIdx + 1) + newAction + content.slice(closeIdx + 1);
      console.log("✅ doPost 加入 logDriverTaskStage action");
    }
  } else {
    console.log("❌ 找不到 installScheduledTriggers marker");
  }
}

// 2. 在檔案末尾加入司機任務回報模組
const driverModule = `

// ═══════════════════════════════════════════════════════════
// 司機任務回報系統（含定位記錄）
// ═══════════════════════════════════════════════════════════

const DRIVER_TASK_LOG_SHEET = "司機任務回報_driver_task_log";

const TASK_LOG_HEADERS = [
  "回報時間_reported_at",
  "訂單編號_order_id",
  "司機ID_driver_line_id",
  "司機姓名_driver_name",
  "客戶姓名_customer_name",
  "任務階段_stage_key",
  "階段名稱_stage_label",
  "緯度_latitude",
  "經度_longitude",
  "地址_address",
  "Google地圖_map_url"
];

// 對應訂單欄位（用來記錄各階段最後一次回報時間）
const STAGE_TIME_FIELDS = {
  pre_check:       "行前檢查時間_pre_check_at",
  depart:          "禮賓出發時間_depart_at",
  arrive_pickup:   "到達上車時間_arrive_pickup_at",
  guest_onboard:   "貴賓上車時間_guest_onboard_at",
  guest_offboard:  "貴賓下車時間_guest_offboard_at",
  complete:        "服務完成時間_complete_at"
};

/**
 * 記錄司機任務階段
 * payload: { lineUserId, orderId, stageKey, stageLabel, latitude, longitude, address, reportedAt }
 */
function logDriverTaskStage(payload) {
  try {
    if (!payload || !payload.stageKey || !payload.lineUserId) {
      return { status: "error", message: "缺少必要欄位" };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let logSheet = ss.getSheetByName(DRIVER_TASK_LOG_SHEET);
    if (!logSheet) {
      logSheet = ss.insertSheet(DRIVER_TASK_LOG_SHEET);
      logSheet.getRange(1, 1, 1, TASK_LOG_HEADERS.length).setValues([TASK_LOG_HEADERS]);
      logSheet.setFrozenRows(1);
      logSheet.getRange(1, 1, 1, TASK_LOG_HEADERS.length)
        .setBackground("#111026").setFontColor("#D7AE54").setFontWeight("bold");
    } else {
      ensureHeaders(logSheet, TASK_LOG_HEADERS);
    }

    // 查訂單拿客戶 / 司機名稱
    let customerName = "";
    let driverName = "";
    let matchedOrderId = payload.orderId || "";

    if (matchedOrderId) {
      const ordersSheet = getOrdersSheet();
      if (ordersSheet) {
        const order = findOrderById_(ordersSheet, matchedOrderId);
        if (order) {
          customerName = order.name || "";
          driverName = order.driver_note || "";
        }
      }
    } else {
      // 沒帶訂單編號 → 找該司機最近被指派但未完成的訂單
      const ordersSheet = getOrdersSheet();
      if (ordersSheet) {
        const recentOrder = findRecentOrderForDriver_(ordersSheet, payload.lineUserId);
        if (recentOrder) {
          matchedOrderId = recentOrder.order_id;
          customerName = recentOrder.name || "";
          driverName = recentOrder.driver_note || "";
        }
      }
    }

    const reportedAt = payload.reportedAt || new Date().toISOString();
    const lat = Number(payload.latitude) || 0;
    const lng = Number(payload.longitude) || 0;
    const mapUrl = "https://maps.google.com/?q=" + lat + "," + lng;

    // 寫入日誌
    logSheet.appendRow([
      reportedAt,
      matchedOrderId,
      payload.lineUserId,
      driverName,
      customerName,
      payload.stageKey,
      payload.stageLabel || "",
      lat,
      lng,
      payload.address || "",
      mapUrl
    ]);

    // 同時更新訂單對應的階段時間欄位
    if (matchedOrderId) {
      const ordersSheet = getOrdersSheet();
      const timeField = STAGE_TIME_FIELDS[payload.stageKey];
      if (ordersSheet && timeField) {
        ensureStageColumns_(ordersSheet);
        markStageTime_(ordersSheet, matchedOrderId, timeField, reportedAt);

        // 若是「服務完成」階段，同時更新 order_status
        if (payload.stageKey === "complete") {
          markOrderStatus_(ordersSheet, matchedOrderId, "completed");
        }
      }
    }

    return {
      status: "success",
      matchedOrderId,
      customerName,
      driverName,
      mapUrl
    };

  } catch (err) {
    Logger.log("logDriverTaskStage failed: " + (err && err.message ? err.message : err));
    return { status: "error", message: err && err.message ? err.message : String(err) };
  }
}

// ─── 工具函式 ────────────────────────────────────────────────
function findOrderById_(sheet, orderId) {
  const all = sheetToObjects(sheet);
  for (const row of all) {
    if (String(row.order_id || "").trim() === String(orderId).trim()) return row;
  }
  return null;
}

function findRecentOrderForDriver_(sheet, lineUserId) {
  // 找最近一筆指派給該司機（driver_line_id 欄位或 line_user_id）的訂單
  // 訂單狀態不是 cancelled / completed
  const all = sheetToObjects(sheet);
  let bestMatch = null;
  let bestTime = 0;

  for (const row of all) {
    const status = String(row.order_status || "").toLowerCase();
    if (status === "cancelled" || status === "已取消" || status === "completed" || status === "已完成") continue;

    // 透過 driver_note 包含 lineUserId 簡單比對（或專屬司機表）
    // 暫時用「最近有更新且未完成」當作匹配（後續可擴充）
    const createdAt = new Date(row.created_at || 0).getTime();
    if (createdAt > bestTime) {
      bestTime = createdAt;
      bestMatch = row;
    }
  }
  return bestMatch;
}

function ensureStageColumns_(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) return;
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const missing = [];
  for (const key in STAGE_TIME_FIELDS) {
    const field = STAGE_TIME_FIELDS[key];
    if (!headers.includes(field)) missing.push(field);
  }
  if (missing.length > 0) {
    sheet.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
  }
}

function markStageTime_(sheet, orderId, fieldKey, value) {
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

function markOrderStatus_(sheet, orderId, status) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  let idCol = -1, statusCol = -1;
  for (let i = 0; i < headers.length; i++) {
    const key = canonicalHeaderKey(headers[i]);
    if (key === "order_id") idCol = i + 1;
    if (key === "order_status") statusCol = i + 1;
  }
  if (idCol < 1 || statusCol < 1) return;

  const ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === String(orderId).trim()) {
      sheet.getRange(i + 2, statusCol).setValue(status);
      return;
    }
  }
}
`;

if (content.includes("function logDriverTaskStage")) {
  console.log("⚠️  司機回報模組已存在");
} else {
  content = content + driverModule + "\n";
  console.log("✅ 司機任務回報模組已加到末尾");
}

fs.writeFileSync(FILE, content, "utf8");
console.log("✅ Code.gs 已更新，總長度: " + content.length + " 字元");
