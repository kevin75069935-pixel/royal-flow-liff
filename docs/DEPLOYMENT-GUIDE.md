# 🚘 御澤禮賓系統 — 新功能部署指南

## 本次新增的 3 個功能

| 功能 | 位置 | 觸發方式 |
|------|------|---------|
| **司機派遣通知** | `functions/api/submit.js` | 客戶送出預約 → 自動推到司機 LINE 群組 |
| **AI 自動報價** | `functions/api/line/webhook.js` | 客戶在 LINE 輸入「桃園機場到台北」→ 自動算距離報價 |
| **行程提醒 + 評價邀請** | `apps-script/Code.gs` | 每 30 分鐘排程：用車前 24h/3h 提醒、完成後 6-72h 評價邀請 |

---

## 一、Cloudflare Pages 部署

### 步驟 1：推上 GitHub
```powershell
cd "D:\AI自動營運團隊\訂單管家\御澤禮賓商務預約系統"
git add .
git commit -m "feat: driver dispatch, AI auto quote, trip reminders + review invites"
git push
```

Cloudflare Pages 會自動部署（5 分鐘內生效）。

### 步驟 2：新增環境變數
進入 Cloudflare Pages → Settings → Environment variables，**新增以下變數**：

| 變數 | 值 | 用途 |
|------|---|------|
| `DRIVER_LINE_TARGETS` | 司機群組 ID（多個用逗號分隔） | 接收派車通知 |
| `ALLOWED_HOSTS` | `royal-flow-liff.pages.dev,你的自訂網域.com` | API 來源白名單 |
| `API_SHARED_SECRET` | 隨機 32 字長字串 | 內部 API 驗證 |

### 步驟 3：取得司機 LINE 群組 ID
1. 把你的 LINE Bot 加入司機群組
2. 在群組內隨便發一則訊息
3. 到 Cloudflare Pages Functions Logs（或 Apps Script Logger）找 `event.source.groupId`
4. 把這個 ID 設到 `DRIVER_LINE_TARGETS` 環境變數

---

## 二、Apps Script 部署

### 步驟 1：複製新版 Code.gs
1. 打開你的 Apps Script 專案
2. 把 `apps-script/Code.gs` 全部內容貼過去（覆蓋舊版）
3. 點儲存（Ctrl+S）

### 步驟 2：設定 Script Properties
專案設定 → Script properties，新增：

| Key | Value |
|-----|-------|
| `LINE_CHANNEL_ACCESS_TOKEN` | 你的 LINE Channel Access Token |
| `REVIEW_URL` | 你的 Google 評論連結（例：`https://g.page/r/xxx/review`） |
| `GOOGLE_MAPS_API_KEY` | 已有 |
| `PAYMENT_URL_BASE` | 已有 |

### 步驟 3：安裝排程
在 Apps Script 編輯器內：
1. 上方函式下拉選 `installScheduledTriggers`
2. 點 **▶ 執行**
3. 第一次需授權，按指示完成
4. 出現結果：`{"status":"success","message":"已安裝每 30 分鐘執行的提醒排程"}`

驗證：左側 **觸發條件** 應該會看到一個 `runScheduledReminders` 排程。

### 步驟 4：重新部署 Web App（**重要**）
**修改 Code.gs 後一定要重新部署，否則新 actions 不會生效**：

1. 右上角 **部署** → **管理部署作業**
2. 點現有部署作業旁的 ✏️ 編輯
3. 版本選 **新版本**
4. 點 **部署**

---

## 三、Google 評論連結設定

### 取得你的 Google Business Profile 評論連結：
1. 前往 [Google Business Profile](https://business.google.com/)
2. 選你的商家 → 取得更多評論
3. 複製分享連結（格式：`https://g.page/r/xxxxxxxx/review`）
4. 把這個連結填到 Apps Script 的 `REVIEW_URL` Script Property

---

## 四、測試流程

### 測試 1：司機派遣通知
1. 用 LINE 加自己的官方帳號好友
2. 開啟 LIFF 預約表單，送一筆測試訂單
3. 司機群組應該會收到「🚘 御澤禮賓｜派車通知」訊息

### 測試 2：AI 自動報價
在 LINE 對官方帳號傳：
```
桃園機場到台北多少
```
或
```
新北市信義區到松山機場
```

應該收到 Flex Message 報價卡（含距離、時間、預估費用）。

### 測試 3：行程提醒
1. 在 Apps Script 編輯器手動執行 `sendTripReminders`
2. 應該回傳：`{"status":"success","sent24h":N,"sent3h":N}`
3. 把測試訂單的 `用車日期` 設為明天，`用車時間` 設為現在 +24h 左右
4. 等下次排程跑（或手動觸發）→ 客戶應收到 24h 提醒

### 測試 4：評價邀請
1. 把測試訂單的 `訂單狀態_order_status` 改成 `completed`
2. 把 `用車日期 + 用車時間` 設為 24 小時前（在 6-72h 範圍內）
3. 手動執行 `sendReviewInvitations`
4. 客戶應收到評價邀請訊息（含 Google 評論連結）

---

## 五、Sheet 新增的欄位

`訂單資料_orders` 工作表第一次跑提醒時會自動加 3 個欄位：

| 欄位 | 用途 |
|------|------|
| `提醒_24h_sent` | 24h 提醒發送時間（防重複發） |
| `提醒_3h_sent` | 3h 提醒發送時間 |
| `評價邀請_sent` | 評價邀請發送時間 |

**這些欄位由系統自動維護，請勿手動修改**（除非要重發提醒）。

---

## 六、常見問題

**Q1：司機收不到派車通知？**
- 檢查 `DRIVER_LINE_TARGETS` 是否設定正確
- 確認司機群組有把 LINE Bot 加為成員
- 看 Cloudflare Functions Logs 有無錯誤

**Q2：AI 自動報價沒反應？**
- 訊息必須包含「到」「至」「→」等分隔符
- 例如 `桃園到台北` ✅ / `多少錢` ❌
- 字數需在 5~200 之間

**Q3：行程提醒沒發？**
- 確認排程已安裝（Apps Script → 觸發條件）
- 確認訂單有 `LINE使用者ID_line_user_id`
- 用車時間必須是 ISO 或 `yyyy/MM/dd HH:mm` 格式

**Q4：評價邀請沒發？**
- 訂單狀態必須是 `completed` 或 `已完成`
- 時間範圍是行程結束後 6-72 小時
- `REVIEW_URL` Script Property 要設定正確

---

## 七、回滾方式

如果新功能有問題，可恢復舊版：

```powershell
# Code.gs 還原
cd "D:\AI自動營運團隊\訂單管家\御澤禮賓商務預約系統\apps-script"
Copy-Item "Code.gs.bak-before-reminder" "Code.gs" -Force
```

Cloudflare 端則用 `git revert HEAD` 還原。
