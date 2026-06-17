/**
 * Rich Menu 自動部署工具
 * 用法：
 *   1. 把 Rich Menu 圖片放到 tools/rich-menu-image.png（2500 x 1686 px）
 *   2. 設定環境變數 LINE_CHANNEL_ACCESS_TOKEN
 *   3. 執行：node tools/deploy-rich-menu.mjs
 *
 * 流程：
 *   建立 Rich Menu → 上傳圖片 → 設為預設選單 → 套用給所有用戶
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const MENU_JSON = path.join(ROOT, "line-rich-menu.json");
const MENU_IMAGE = path.join(__dirname, "rich-menu-image.png");

if (!TOKEN) {
  console.error("❌ 請設定環境變數 LINE_CHANNEL_ACCESS_TOKEN");
  console.error("");
  console.error("PowerShell:");
  console.error('  $env:LINE_CHANNEL_ACCESS_TOKEN="你的token"');
  console.error("  node tools/deploy-rich-menu.mjs");
  process.exit(1);
}

if (!fs.existsSync(MENU_JSON)) {
  console.error(`❌ 找不到 ${MENU_JSON}`);
  process.exit(1);
}

if (!fs.existsSync(MENU_IMAGE)) {
  console.error(`❌ 找不到 Rich Menu 圖片：${MENU_IMAGE}`);
  console.error("");
  console.error("請準備一張 2500 x 1686 px 的 PNG，命名為 rich-menu-image.png 放到 tools/");
  process.exit(1);
}

const menuConfig = JSON.parse(fs.readFileSync(MENU_JSON, "utf8"));

async function main() {
  console.log("🚘 ROYAL FLOW Rich Menu 部署工具");
  console.log("");

  // 1. 列出舊的 Rich Menu，刪除
  console.log("📋 步驟 1：清除舊的 Rich Menu...");
  const listRes = await fetch("https://api.line.me/v2/bot/richmenu/list", {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const list = await listRes.json();

  if (list.richmenus && list.richmenus.length > 0) {
    for (const old of list.richmenus) {
      await fetch(`https://api.line.me/v2/bot/richmenu/${old.richMenuId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      console.log(`   🗑  已刪除 ${old.richMenuId}`);
    }
  } else {
    console.log("   ✅ 無舊選單");
  }

  // 2. 建立新 Rich Menu
  console.log("");
  console.log("📋 步驟 2：建立新 Rich Menu...");
  const createRes = await fetch("https://api.line.me/v2/bot/richmenu", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(menuConfig),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    console.error("   ❌ 建立失敗：", err);
    process.exit(1);
  }

  const created = await createRes.json();
  const richMenuId = created.richMenuId;
  console.log(`   ✅ 建立成功：${richMenuId}`);

  // 3. 上傳圖片
  console.log("");
  console.log("📋 步驟 3：上傳選單圖片...");
  const imageBuffer = fs.readFileSync(MENU_IMAGE);
  const uploadRes = await fetch(
    `https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "image/png",
      },
      body: imageBuffer,
    }
  );

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    console.error("   ❌ 圖片上傳失敗：", err);
    process.exit(1);
  }
  console.log(`   ✅ 圖片已上傳（${(imageBuffer.length / 1024).toFixed(1)} KB）`);

  // 4. 設為預設選單
  console.log("");
  console.log("📋 步驟 4：設為預設選單（套用給所有用戶）...");
  const defaultRes = await fetch(
    `https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}` },
    }
  );

  if (!defaultRes.ok) {
    const err = await defaultRes.text();
    console.error("   ❌ 設定預設選單失敗：", err);
    process.exit(1);
  }
  console.log("   ✅ 設為預設選單成功");

  console.log("");
  console.log("🎉 全部完成！");
  console.log(`   Rich Menu ID: ${richMenuId}`);
  console.log("");
  console.log("👉 打開你的 LINE App 加好友/重整對話，應該會看到新選單");
}

main().catch((err) => {
  console.error("💥 部署失敗：", err.message);
  process.exit(1);
});
