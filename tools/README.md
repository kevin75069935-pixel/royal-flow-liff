# Tools

此資料夾放置御澤禮賓商務預約系統的本機維護與部署輔助工具。

## 工具清單

| 檔案 | 用途 |
| --- | --- |
| `deploy-rich-menu.mjs` | 使用 LINE Messaging API 建立、上傳並套用 Rich Menu。需要環境變數 `LINE_CHANNEL_ACCESS_TOKEN` 與 `tools/rich-menu-image.png`。 |
| `patch-apps-script.mjs` | 將行程提醒與評價邀請模組補進 `apps-script/Code.gs`，並建立 `.bak-before-reminder` 備份。 |
| `patch-apps-script-driver.mjs` | 將司機任務回報模組補進 `apps-script/Code.gs`，並建立 `.bak-before-driver-task` 備份。 |
| `Remove-DuplicateFiles.ps1` | 掃描重複檔案並輸出報表；加上 `-Delete` 時會將建議刪除的重複檔移到資源回收桶。 |

## 使用注意

- 執行 `deploy-rich-menu.mjs` 前，請確認 LINE token 使用的是正確官方帳號。
- 執行 patch 類工具前，請先確認 `apps-script/Code.gs` 已 commit 或另有備份。
- `Remove-DuplicateFiles.ps1` 預設掃描 `D:\`，建議先指定較小範圍，例如專案資料夾，並先不加 `-Delete` 產生報表。

範例：

```powershell
.\tools\Remove-DuplicateFiles.ps1 -Root "D:\AI自動營運團隊\訂單管家\御澤禮賓商務預約系統" -ReportPath ".\duplicate-files-report.csv"
```

