# 御澤禮賓 LIFF 預約系統

這個資料夾是可部署到 Cloudflare Pages 的 LIFF 預約系統。

## 檔案結構

```text
index.html
functions/
  api/
    estimate.js
    quote.js
    submit.js
apps-script/
  Code.gs
```

## 部署步驟

1. 將 `apps-script/Code.gs` 貼到 Google Apps Script，綁定你的訂單試算表。
2. 在 Apps Script 專案設定的 Script properties 新增 `GOOGLE_MAPS_API_KEY`。
3. 將 Apps Script 部署成 Web App，權限建議設為「任何人」可存取，取得 `/exec` 網址。
4. 將本資料夾上傳到 Cloudflare Pages。
5. 在 Cloudflare Pages Settings > Environment variables 新增：

```text
GAS_WEB_APP_URL=https://script.google.com/macros/s/你的部署ID/exec
```

6. 到 LINE Developers 的 LIFF 設定，把 Endpoint URL 改成 Cloudflare Pages 網址，例如：

```text
https://royal-flow-liff.pages.dev
```

7. 手機測試請用 LINE App 開啟：

```text
https://liff.line.me/2010083928-gA1wvCJ0
```

## LINE 身分欄位

前端會送出以下欄位：

```text
lineUserId
lineDisplayName
line_user_id
line_display_name
```

Apps Script 會把 `line_user_id` 與 `line_display_name` 寫入 `orders` 試算表。
<img width="942" height="1001" alt="image" src="https://github.com/user-attachments/assets/048d05dc-02b1-486b-a71b-f70df05f0fc7" />

