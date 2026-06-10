# 御澤禮賓 LIFF 預約系統

這個資料夾是可部署到 Cloudflare Pages 的 LIFF 預約系統。

## 檔案結構

```text
index.html
functions/
  api/
    estimate.js
    line/
      webhook.js
    quote.js
    submit.js
apps-script/
  Code.gs
line-rich-menu.json
```

## 部署步驟

1. 將 `apps-script/Code.gs` 貼到 Google Apps Script，綁定你的訂單試算表。
2. 在 Apps Script 專案設定的 Script properties 新增 `GOOGLE_MAPS_API_KEY`。
3. 將 Apps Script 部署成 Web App，權限建議設為「任何人」可存取，取得 `/exec` 網址。
4. 將本資料夾上傳到 Cloudflare Pages。
5. 在 Cloudflare Pages Settings > Environment variables 新增：

```text
GAS_WEB_APP_URL=https://script.google.com/macros/s/你的部署ID/exec
LIFF_URL=https://liff.line.me/2010083928-gA1wvCJ0
LINE_CHANNEL_SECRET=LINE Developers Messaging API 的 Channel secret
LINE_CHANNEL_ACCESS_TOKEN=LINE Developers Messaging API 的 long-lived access token
SUPPORT_URL=https://liff.line.me/2010083928-gA1wvCJ0
```

若要讓送出預約後顯示付款連結，在 Apps Script 專案設定的 Script properties 另加：

```text
PAYMENT_URL_BASE=https://你的付款頁或金流連結入口
```

系統會自動附上 `orderId` 與 `amount` query string，例如：

```text
https://你的付款頁?orderId=RF20260610120000123&amount=1200
```

6. 到 LINE Developers 的 LIFF 設定，把 Endpoint URL 改成 Cloudflare Pages 網址，例如：

```text
https://royal-flow-liff.pages.dev
```

7. 手機測試請用 LINE App 開啟：

```text
https://liff.line.me/2010083928-gA1wvCJ0
```

## LINE 官方帳號設定

### Messaging API Webhook

在 LINE Developers > Messaging API 設定：

```text
Webhook URL=https://你的 Cloudflare Pages 網址/api/line/webhook
Use webhook=Enabled
Auto-reply messages=Disabled
Greeting messages=可保留或改成導向選單
```

Webhook 支援以下文字：

```text
預約 / 機場 / 商務：回覆 LIFF 預約表單
報價 / 估價：說明 AI 自動報價與 Google Routes 路程計算
查詢 / 訂單 / 行程：用 LINE User ID 查詢最近一筆預約，也可輸入 RF 開頭訂單編號
付款 / 訂金：查詢最近一筆訂單付款連結
客服 / 人工：切換到人工客服話術
```

### Rich Menu

`line-rich-menu.json` 是 2500 x 1686 的六宮格主選單設定：

```text
立即預約：開啟 LIFF 表單
AI 報價：觸發報價說明
查詢行程：查詢最近預約
付款：取得訂金連結
機場接送：導向預約
人工客服：轉人工話術
```

上架 Rich Menu 時需另外準備一張 2500 x 1686 PNG/JPG 選單圖，文字位置要對應六格區塊。若更換 LIFF ID，請同步修改 `line-rich-menu.json` 內的 `uri`。

## 預約與查詢流程

1. 用戶從 Rich Menu 點「立即預約」開啟 LIFF。
2. LIFF 自動取得 LINE User ID 與暱稱。
3. 用戶填寫服務、車型、日期時間、上下車地點、航班、人數與加購服務。
4. 點「取得 Google Routes 估價」後，Apps Script 呼叫 Google Routes API 計算距離與車程。
5. 點「預覽目前報價」或送出預約時，系統依車型、距離、車程與加購服務計算初步報價。
6. 訂單寫入 `orders` 試算表，欄位含 `line_user_id`、`payment_url`、`payment_status`、`order_status`、`driver_note`。
7. 用戶在 LINE 輸入「查詢行程」可查最近一筆訂單；輸入「查詢 RF20260610120000123」可查指定訂單。
8. 用戶輸入「付款」可取得最近一筆訂單的訂金付款連結。

## LINE 身分欄位

前端會送出以下欄位：

```text
lineUserId
lineDisplayName
line_user_id
line_display_name
```

Apps Script 會把 `line_user_id` 與 `line_display_name` 寫入 `orders` 試算表。

## Google Sheet 報價設定

自動報價不再寫死在程式裡。第一次執行「預覽報價 / 送出預約」時，Apps Script 會自動建立以下分頁；也可以用 Apps Script 手動執行 `setupPricingSheets()` 先建立。

```text
pricing_car_types
pricing_services
pricing_addons
pricing_cross_regions
07_商務包時報價
08_跨區費用設定
```

### pricing_car_types 車型單價

每一列是一個車型。前端車型名稱要能對應 `car_type`。

```text
car_type            車型名稱
base_fare           基本車資
per_km              每公里單價
per_min             每分鐘車程單價
overtime_per_hour   超時每小時費用
enabled             Y=啟用，N=停用
note                備註
```

範例：

```text
Lexus LM 40 / 35 | 2800 | 55 | 10 | 1200 | Y | 高端商務 MPV
```

### pricing_services 服務與全域規則

一般服務列用來設定服務最低費；`service_key` 為 `_rule` 的列是全域規則。

```text
service_key     服務代碼或 _rule
service_name    服務名稱或規則名稱
min_price       服務最低費或規則值
day_min_price   旅遊包車每日最低費
enabled         Y=啟用，N=停用
note            備註
```

可調整的 `_rule`：

```text
distance_rate_per_km   車型未設定 per_km 時的預設每公里費用
duration_rate_per_min  車型未設定 per_min 時的預設每分鐘費用
deposit_rate           訂金比例，例如 0.3
min_deposit            最低訂金
round_to               報價四捨五入單位，例如 100
tour_day_min_price     旅遊包車每日最低費預設值
overtime_unit_min      超時計費最小單位，單位為分鐘，例如 30
```

### pricing_addons 加值服務

用來設定舉牌服務、嬰幼兒安全座椅、英文司機、增加接送點等費用。

```text
addon_key      加值項目代碼
addon_name     顯示名稱
match_field    對應前端欄位，例如 signService、childSeat、stopCount
match_value    觸發值，例如 是；增加接送點可留空
pricing_type   flat / per_unit / per_extra_stop
unit_price     單價
included_qty   內含數量，例如 stopCount 內含 1 點
enabled        Y=啟用，N=停用
note           備註
```

範例：

```text
sign_service | 舉牌服務 | signService | 是 | flat | 200 | 0 | Y
child_seat   | 嬰幼兒安全座椅 | childSeat | 是 | flat | 300 | 0 | Y
extra_stop   | 增加接送點 | stopCount |   | per_extra_stop | 300 | 1 | Y
```

### pricing_cross_regions 跨區費用

系統會用上車/下車地址關鍵字比對，正向或反向都會套用。

```text
pickup_keyword   上車地址關鍵字
dropoff_keyword  下車地址關鍵字
surcharge        跨區加價
enabled          Y=啟用，N=停用
note             備註
```

範例：

```text
台北 | 桃園 | 500 | Y | 雙北往返桃園跨區
台北 | 台中 | 3500 | Y | 台北往返台中跨區
```

### 報價計算順序

```text
車型基本費
+ 路程費：distanceKm x per_km
+ 車程費：durationMin x per_min
+ 加值服務：pricing_addons
+ 超時費用：overtimeMin / overtimeHours x 車型 overtime_per_hour
+ 跨區費用：pricing_cross_regions
套用服務最低費 / 旅遊包車每日最低費
依 round_to 四捨五入
依 deposit_rate / min_deposit 計算訂金
```

每筆訂單會把報價明細寫入 `orders.quote_breakdown`，方便客服回查報價來源。

## 市區商務行程報價

`商務接送 / 商務包車` 會使用獨立報價規則，不套用機場接送的距離/時間加價。

計算方式：

```text
市區商務行程車資
= 車型基礎包時費
+ 超時費
+ 跨區費
+ 加購服務費
```

前端會顯示：

```text
商務行程型態：3 小時市區商務 / 8 小時市區商務 / 客製化商務行程
預計用車小時：3～12 小時，或 12 小時以上客服確認
是否跨縣市：否，雙北市區內 / 桃園市 / 基隆市 / 新竹市縣 / 苗栗 / 台中 / 宜蘭 / 花蓮 / 台南 / 高雄 / 其他
```

### 07_商務包時報價

欄位：

```text
car_type             車型
enabled              是 / 否
base_area            基準區域，預設雙北市區
three_hour_fare      3 小時基礎車資
eight_hour_fare      8 小時基礎車資
overtime_per_hour    每小時超時費
includes_taipei      雙北市區內含
note                 備註
```

預設車型資料已依本需求建立，例如：

```text
Toyota Alphard 40 / 35 | 是 | 雙北市區 | 3800 | 6800 | 800 | 是 | 商務接待常用
```

### 08_跨區費用設定

欄位：

```text
base_area          起始基準
destination_area   目的區域
surcharge          跨區費
enabled            是 / 否
note               備註
```

預設跨區費包含：

```text
雙北市區 -> 桃園市區：1000
雙北市區 -> 桃園機場：1200
雙北市區 -> 基隆市區：1000
雙北市區 -> 新竹市區：2500
雙北市區 -> 苗栗市區：3500
雙北市區 -> 台中市區：5000
雙北市區 -> 宜蘭市區：2500
雙北市區 -> 花蓮市區：6000
雙北市區 -> 台南市區：8000
雙北市區 -> 高雄市區：9500
```

## 試算表狀態欄位

客服可直接在試算表維護：

```text
payment_status=pending / paid / failed / refunded
order_status=pending / confirmed / dispatched / completed / cancelled
driver_note=司機姓名、車牌、聯絡方式或客服備註
```

用戶查詢行程時會讀取上述欄位並回覆到 LINE。

## 機場接送與多點接待

機場接送支援兩種型態：

```text
送機服務：接待地址 -> 可用 + 增加接待點 -> 預約機場 -> 接送航廈 -> 航班資訊 -> 起飛時間
接機服務：預約機場 -> 接送航廈 -> 接待地址 -> 可用 + 增加接待點 -> 航班資訊 -> 抵達時間
```

預約機場下拉選項：

```text
桃園國際機場
台北松山機場
台中機場
高雄小港機場
```

接送航廈下拉選項：

```text
第一航廈
第二航廈
國際線
國內線
```

多點接待規則：

```text
機場接送：用 + 顯示 airportPoint2～airportPoint5，最多增加 4 個機場接送接待點
商務接送：可填 receptionPoint2～receptionPoint5
商務包車：可填 receptionPoint2～receptionPoint5
港口接送：可填 receptionPoint2～receptionPoint5
展演活動：可填 receptionPoint2～receptionPoint5
結婚禮車：可填 receptionPoint2～receptionPoint5
外交禮賓：可填 receptionPoint2～receptionPoint5
```

港口接送、商務接送、商務包車、結婚禮車、展演活動會顯示共用的「接待地址」欄位，並用 `+` 逐步增加接待點 2～5。港口接送會依 `送港服務 / 接港服務` 自動把接待地址同步到上車或下車地點。

`collectData()` 會固定送出：

```text
airportServiceType
reservedAirport
airportTerminal
airportReceptionAddress
flightTime
departureTime
arrivalTime
receptionAddress
receptionPoint2
receptionPoint3
receptionPoint4
receptionPoint5
airportPoint2
airportPoint3
airportPoint4
airportPoint5
```

Apps Script 會把上述資料寫入 `orders` 最後方的新欄位，避免破壞既有訂單欄位順序。

## 港口接送選項

港口接送支援：

```text
送港服務：一般接待地址 -> 預約港口
接港服務：預約港口 -> 一般接待地址
```

豪華郵輪 / 國際港口：

```text
基隆港｜Keelung Port
台北港｜Taipei Port
蘇澳港｜Suao Port
台中港｜Taichung Port
高雄港｜Kaohsiung Port
花蓮港｜Hualien Port
```

離島快速船 / 客運港口：

```text
布袋港｜嘉義布袋商港
東港｜屏東東港碼頭
富岡漁港｜台東富岡漁港
南方澳港｜宜蘭南方澳漁港
馬公港｜澎湖馬公港
金門水頭碼頭｜金門水頭港
小琉球白沙尾漁港｜小琉球碼頭
```

`collectData()` 會送出：

```text
portServiceType
reservedPort
```

Apps Script 會寫入 `orders.port_service_type` 與 `orders.reserved_port`。
