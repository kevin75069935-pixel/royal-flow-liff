const SHEET_NAME = "訂單資料_orders";
const PRICING_CAR_TYPES_SHEET = "車型單價_pricing_car_types";
const PRICING_SERVICES_SHEET = "服務規則_pricing_services";
const PRICING_ADDONS_SHEET = "加值服務_pricing_addons";
const PRICING_CROSS_REGIONS_SHEET = "路線跨區費_pricing_cross_regions";
const BUSINESS_HOURLY_PRICING_SHEET = "商務包時報價_business_hourly";
const BUSINESS_CROSS_REGION_SHEET = "商務跨區費用_business_cross_regions";

const HEADER_LABELS = {
  order_id: "訂單編號_order_id",
  created_at: "建立時間_created_at",
  name: "姓名_name",
  phone: "電話_phone",
  company_name: "公司名稱_company_name",
  tax_id: "統一編號_tax_id",
  reception_target: "接待對象_reception_target",
  reception_level: "接待層級_reception_level",
  quote_document_need: "報價文件_quote_document_need",
  invoice_need: "單據需求_invoice_need",
  monthly_billing: "企業月結_monthly_billing",
  payment_method_preference: "付款偏好_payment_method_preference",
  special_requests: "特殊乘車需求_special_requests",
  line_user_id: "LINE使用者ID_line_user_id",
  line_display_name: "LINE暱稱_line_display_name",
  service: "服務項目_service",
  date: "用車日期_date",
  time: "用車時間_time",
  business_trip_type: "商務行程型態_business_trip_type",
  business_hours: "商務用車小時_business_hours",
  business_cross_region: "商務跨區_business_cross_region",
  universal_lounge_type: "寰宇商務中心服務_universal_lounge_type",
  universal_lounge_passengers: "寰宇商務中心人數_universal_lounge_passengers",
  universal_lounge_note: "寰宇商務中心備註_universal_lounge_note",
  pickup: "上車地點_pickup",
  dropoff: "下車地點_dropoff",
  pickup_airport: "上車機場_pickup_airport",
  dropoff_airport: "下車機場_dropoff_airport",
  terminal: "航廈_terminal",
  flight: "航班資訊_flight",
  car_type: "車型_car_type",
  passengers: "乘客人數_passengers",
  luggage: "行李件數_luggage",
  child_seat: "兒童座椅_child_seat",
  sign_service: "舉牌服務_sign_service",
  english_driver: "英文司機_english_driver",
  service_tier: "禮賓服務等級_service_tier",
  premium_addons: "尊榮加值服務_premium_addons",
  stop_count: "停靠點數_stop_count",
  multi_stop_note: "多點說明_multi_stop_note",
  tour_mode: "旅遊型態_tour_mode",
  tour_area: "旅遊區域_tour_area",
  package_route: "套裝路線_package_route",
  trip_days: "旅遊天數_trip_days",
  driver_hotel_type: "司機住宿_driver_hotel_type",
  distance_km: "預估公里_distance_km",
  duration_min: "預估分鐘_duration_min",
  final_price: "總報價_final_price",
  deposit_amount: "訂金_deposit_amount",
  balance_amount: "尾款_balance_amount",
  note: "備註_note",
  payment_status: "付款狀態_payment_status",
  payment_url: "付款連結_payment_url",
  order_status: "訂單狀態_order_status",
  driver_note: "司機客服備註_driver_note",
  quote_breakdown: "報價明細_quote_breakdown",
  airport_service_type: "機場服務類型_airport_service_type",
  reserved_airport: "預約機場_reserved_airport",
  airport_terminal: "接送航廈_airport_terminal",
  airport_reception_address: "機場接待地址_airport_reception_address",
  flight_time: "航班時間_flight_time",
  departure_time: "起飛時間_departure_time",
  arrival_time: "抵達時間_arrival_time",
  reception_address: "接待地址_reception_address",
  reception_point_2: "接待點2_reception_point_2",
  reception_point_3: "接待點3_reception_point_3",
  reception_point_4: "接待點4_reception_point_4",
  reception_point_5: "接待點5_reception_point_5",
  airport_point_2: "機場接待點2_airport_point_2",
  airport_point_3: "機場接待點3_airport_point_3",
  airport_point_4: "機場接待點4_airport_point_4",
  airport_point_5: "機場接待點5_airport_point_5",
  port_service_type: "港口服務類型_port_service_type",
  reserved_port: "預約港口_reserved_port",
  service_key: "服務代碼_service_key",
  service_name: "服務名稱_service_name",
  min_price: "最低費用_min_price",
  day_min_price: "每日最低費_day_min_price",
  enabled: "啟用_enabled",
  car_type: "車型_car_type",
  base_fare: "基本車資_base_fare",
  per_km: "每公里費_per_km",
  per_min: "每分鐘費_per_min",
  overtime_per_hour: "每小時超時費_overtime_per_hour",
  addon_key: "加值代碼_addon_key",
  addon_name: "加值名稱_addon_name",
  match_field: "對應欄位_match_field",
  match_value: "觸發值_match_value",
  pricing_type: "計費方式_pricing_type",
  unit_price: "單價_unit_price",
  included_qty: "內含數量_included_qty",
  pickup_keyword: "上車關鍵字_pickup_keyword",
  dropoff_keyword: "下車關鍵字_dropoff_keyword",
  surcharge: "加價_surcharge",
  base_area: "基準區域_base_area",
  destination_area: "目的區域_destination_area",
  three_hour_fare: "3小時基礎車資_three_hour_fare",
  eight_hour_fare: "8小時基礎車資_eight_hour_fare",
  includes_taipei: "雙北市區內含_includes_taipei",
  note: "備註_note"
};

const LEGACY_SHEET_NAMES = {
  "訂單資料_orders": "orders",
  "車型單價_pricing_car_types": "pricing_car_types",
  "服務規則_pricing_services": "pricing_services",
  "加值服務_pricing_addons": "pricing_addons",
  "路線跨區費_pricing_cross_regions": "pricing_cross_regions",
  "商務包時報價_business_hourly": "07_商務包時報價",
  "商務跨區費用_business_cross_regions": "08_跨區費用設定"
};

function doGet() {
  return jsonOutput({
    status: "ok",
    service: "royal-flow-booking"
  });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : "{}");
    const action = body.action || "submitBooking";
    const payload = body.payload || body;

    if (action === "getRouteEstimate") {
      return jsonOutput(getRouteEstimate(payload));
    }

    if (action === "previewQuote") {
      return jsonOutput(previewQuote(payload));
    }

    if (action === "submitBooking") {
      return jsonOutput(submitBooking(payload));
    }

    if (action === "getLatestOrder") {
      return jsonOutput(getLatestOrder(payload));
    }

    if (action === "getOrder") {
      return jsonOutput(getOrder(payload));
    }

    if (action === "setupPricingSheets") {
      return jsonOutput(setupPricingSheets());
    }

    return jsonOutput({
      status: "error",
      message: "未知 action：" + action
    });
  } catch (error) {
    return jsonOutput({
      status: "error",
      message: error && error.message ? error.message : String(error)
    });
  }
}

function getRouteEstimate(data) {
  const apiKey = PropertiesService.getScriptProperties().getProperty("GOOGLE_MAPS_API_KEY");
  if (!apiKey) {
    return {
      status: "error",
      message: "Apps Script 尚未設定 GOOGLE_MAPS_API_KEY，無法呼叫 Google Routes API。"
    };
  }

  if (!data.pickup || !data.dropoff) {
    return {
      status: "error",
      message: "缺少上車地點或下車地點。"
    };
  }

  const response = UrlFetchApp.fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "post",
    contentType: "application/json",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "routes.distanceMeters,routes.duration"
    },
    payload: JSON.stringify({
      origin: {
        address: data.pickup
      },
      destination: {
        address: data.dropoff
      },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE"
    }),
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  const text = response.getContentText();
  const result = JSON.parse(text || "{}");

  if (code < 200 || code >= 300 || !result.routes || !result.routes.length) {
    return {
      status: "error",
      message: "Google Routes 估算失敗：" + text.substring(0, 200)
    };
  }

  const route = result.routes[0];
  const distanceKm = Math.round((Number(route.distanceMeters || 0) / 1000) * 10) / 10;
  const durationMin = Math.round(parseDurationSeconds(route.duration) / 60);

  return {
    status: "success",
    distanceKm,
    durationMin
  };
}

function previewQuote(data) {
  const quote = calculateQuote(data);
  return {
    status: "success",
    quote
  };
}

function submitBooking(data) {
  const quote = calculateQuote(data);
  const orderId = data.orderId || makeOrderId();
  const paymentUrl = buildPaymentUrl(orderId, quote.depositAmount);
  const sheet = getOrdersSheet();
  const now = new Date();

  appendObjectRow(sheet, {
    order_id: orderId,
    created_at: now,
    name: value(data.name),
    phone: value(data.phone),
    company_name: value(data.companyName),
    tax_id: value(data.taxId),
    reception_target: value(data.receptionTarget),
    reception_level: value(data.receptionLevel),
    quote_document_need: value(data.quoteDocumentNeed),
    invoice_need: value(data.invoiceNeed),
    monthly_billing: value(data.monthlyBilling),
    payment_method_preference: value(data.paymentMethodPreference),
    special_requests: value(data.specialRequests),
    line_user_id: value(data.line_user_id || data.lineUserId),
    line_display_name: value(data.line_display_name || data.lineDisplayName),
    service: value(data.service),
    date: value(data.date),
    time: value(data.time),
    business_trip_type: value(data.businessTripType),
    business_hours: value(data.businessHours),
    business_cross_region: value(data.businessCrossRegion),
    universal_lounge_type: value(data.universalLoungeType),
    universal_lounge_passengers: value(data.universalLoungePassengers),
    universal_lounge_note: value(data.universalLoungeNote),
    pickup: value(data.pickup),
    dropoff: value(data.dropoff),
    pickup_airport: value(data.pickupAirport),
    dropoff_airport: value(data.dropoffAirport),
    terminal: value(data.terminal),
    flight: value(data.flight),
    car_type: value(data.carType),
    passengers: value(data.passengers),
    luggage: value(data.luggage),
    child_seat: value(data.childSeat),
    sign_service: value(data.signService),
    english_driver: value(data.englishDriver),
    service_tier: value(data.serviceTier),
    premium_addons: value(data.premiumAddons),
    stop_count: value(data.stopCount),
    multi_stop_note: value(data.multiStopNote),
    tour_mode: value(data.tourMode),
    tour_area: value(data.tourArea),
    package_route: value(data.packageRoute),
    trip_days: value(data.tripDays),
    driver_hotel_type: value(data.driverHotelType),
    distance_km: quote.distanceKm,
    duration_min: quote.durationMin,
    final_price: quote.finalPrice,
    deposit_amount: quote.depositAmount,
    balance_amount: quote.balanceAmount,
    note: value(data.note),
    payment_status: "pending",
    payment_url: paymentUrl,
    order_status: "pending",
    driver_note: "",
    quote_breakdown: JSON.stringify(quote.breakdown || []),
    airport_service_type: value(data.airportServiceType),
    reserved_airport: value(data.reservedAirport),
    airport_terminal: value(data.airportTerminal),
    airport_reception_address: value(data.airportReceptionAddress),
    flight_time: value(data.flightTime),
    departure_time: value(data.departureTime),
    arrival_time: value(data.arrivalTime),
    reception_address: value(data.receptionAddress),
    reception_point_2: value(data.receptionPoint2),
    reception_point_3: value(data.receptionPoint3),
    reception_point_4: value(data.receptionPoint4),
    reception_point_5: value(data.receptionPoint5),
    airport_point_2: value(data.airportPoint2),
    airport_point_3: value(data.airportPoint3),
    airport_point_4: value(data.airportPoint4),
    airport_point_5: value(data.airportPoint5),
    port_service_type: value(data.portServiceType),
    reserved_port: value(data.reservedPort)
  });

  return {
    status: "success",
    orderId,
    finalPrice: quote.finalPrice,
    depositAmount: quote.depositAmount,
    balanceAmount: quote.balanceAmount,
    paymentUrl
  };
}

function getLatestOrder(data) {
  const lineUserId = value(data.lineUserId || data.line_user_id);
  if (!lineUserId) {
    return {
      status: "error",
      message: "缺少 LINE User ID。"
    };
  }

  const sheet = getOrdersSheet();
  const orders = sheetToObjects(sheet);
  for (let i = orders.length - 1; i >= 0; i--) {
    if (orders[i].line_user_id === lineUserId) {
      return {
        status: "success",
        order: orders[i]
      };
    }
  }

  return {
    status: "not_found",
    message: "目前查不到您的預約紀錄。"
  };
}

function getOrder(data) {
  const orderId = value(data.orderId || data.order_id).toUpperCase();
  if (!orderId) {
    return {
      status: "error",
      message: "缺少訂單編號。"
    };
  }

  const sheet = getOrdersSheet();
  const orders = sheetToObjects(sheet);
  for (let i = orders.length - 1; i >= 0; i--) {
    if (String(orders[i].order_id || "").toUpperCase() === orderId) {
      return {
        status: "success",
        order: orders[i]
      };
    }
  }

  return {
    status: "not_found",
    message: "查無此訂單編號。"
  };
}

function calculateQuote(data) {
  const pricing = getPricingConfig();
  const carType = data.carType || "標準商務車";
  if (isBusinessService(data.service)) {
    return calculateBusinessQuote(data, pricing, carType);
  }

  const distanceKm = Number(data.distanceKm || 0);
  const durationMin = Number(data.durationMin || 0);
  const tripDays = Math.max(1, Number(data.tripDays || 1));
  const carPrice = findCarPrice(pricing.carTypes, carType);
  const servicePrice = findServicePrice(pricing.services, data.service);
  const base = numberOr(carPrice.base_fare, 1800);
  const distanceRate = numberOr(carPrice.per_km, numberOr(pricing.rules.distance_rate_per_km, 45));
  const durationRate = numberOr(carPrice.per_min, numberOr(pricing.rules.duration_rate_per_min, 8));
  const breakdown = [];

  let finalPrice = addBreakdown(breakdown, "車型基本費", base, carType);
  if (distanceKm > 0) {
    finalPrice += addBreakdown(breakdown, "路程費", Math.round(distanceKm * distanceRate), distanceKm + " 公里 x " + distanceRate);
  }
  if (durationMin > 0) {
    finalPrice += addBreakdown(breakdown, "車程費", Math.round(durationMin * durationRate), durationMin + " 分鐘 x " + durationRate);
  }

  if (data.service === "旅遊包車") {
    const dayMinPrice = numberOr(servicePrice.day_min_price, numberOr(pricing.rules.tour_day_min_price, 5500));
    const tourMinPrice = dayMinPrice * tripDays;
    if (finalPrice < tourMinPrice) {
      addBreakdown(breakdown, "旅遊包車最低費", tourMinPrice - finalPrice, tripDays + " 日 x " + dayMinPrice);
      finalPrice = tourMinPrice;
    }
  }

  finalPrice += calculateAddonTotal(pricing.addons, data, breakdown);
  finalPrice += calculateOvertimeTotal(pricing, data, carPrice, breakdown);
  finalPrice += calculateCrossRegionTotal(pricing.crossRegions, data, breakdown);

  if (numberOr(servicePrice.min_price, 0) > finalPrice) {
    addBreakdown(breakdown, "服務最低費", servicePrice.min_price - finalPrice, data.service);
    finalPrice = Number(servicePrice.min_price);
  }

  finalPrice = roundAmount(finalPrice, pricing);
  const depositRate = numberOr(pricing.rules.deposit_rate, 0.3);
  const minDeposit = numberOr(pricing.rules.min_deposit, 1000);
  const depositAmount = roundAmount(Math.max(minDeposit, finalPrice * depositRate), pricing);
  const balanceAmount = Math.max(0, finalPrice - depositAmount);

  return {
    carType,
    distanceKm: distanceKm || "",
    durationMin: durationMin || "",
    surchargeNotes: buildSurchargeNotes(breakdown),
    finalPrice,
    depositAmount,
    balanceAmount,
    breakdown
  };
}

function calculateBusinessQuote(data, pricing, carType) {
  const businessPrice = findBusinessHourlyPrice(pricing.businessHourly, carType);
  const hours = parseBusinessHours(data.businessHours);
  const tripType = value(data.businessTripType || "客製化商務行程");
  const breakdown = [];

  let baseHours = 8;
  let baseFare = numberOr(businessPrice.eight_hour_fare, 0);

  if (tripType.indexOf("3") >= 0 || hours <= 3) {
    baseHours = 3;
    baseFare = numberOr(businessPrice.three_hour_fare, baseFare);
  }

  if (tripType.indexOf("8") >= 0 || (tripType.indexOf("客製化") >= 0 && hours > 3)) {
    baseHours = 8;
    baseFare = numberOr(businessPrice.eight_hour_fare, baseFare);
  }

  let finalPrice = addBreakdown(breakdown, baseHours + " 小時市區商務基礎車資", baseFare, businessPrice.base_area || "雙北市區");

  if (hours > baseHours) {
    const overtimeHours = hours - baseHours;
    const overtimeRate = numberOr(businessPrice.overtime_per_hour, 0);
    finalPrice += addBreakdown(breakdown, "商務行程超時費", overtimeHours * overtimeRate, overtimeHours + " 小時 x " + overtimeRate);
  }

  finalPrice += calculateBusinessCrossRegionTotal(pricing.businessCrossRegions, data, breakdown);
  finalPrice += calculateAddonTotal(pricing.addons, data, breakdown);

  finalPrice = roundAmount(finalPrice, pricing);
  const depositRate = numberOr(pricing.rules.deposit_rate, 0.3);
  const minDeposit = numberOr(pricing.rules.min_deposit, 1000);
  const depositAmount = roundAmount(Math.max(minDeposit, finalPrice * depositRate), pricing);
  const balanceAmount = Math.max(0, finalPrice - depositAmount);

  return {
    carType,
    distanceKm: "",
    durationMin: "",
    surchargeNotes: buildSurchargeNotes(breakdown),
    finalPrice,
    depositAmount,
    balanceAmount,
    breakdown
  };
}

function getOrdersSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet(spreadsheet, SHEET_NAME);

  const headers = [
      "order_id",
      "created_at",
      "name",
      "phone",
      "company_name",
      "tax_id",
      "reception_target",
      "reception_level",
      "quote_document_need",
      "invoice_need",
      "monthly_billing",
      "payment_method_preference",
      "special_requests",
      "line_user_id",
      "line_display_name",
      "service",
      "date",
      "time",
      "business_trip_type",
      "business_hours",
      "business_cross_region",
      "pickup",
      "dropoff",
      "pickup_airport",
      "dropoff_airport",
      "terminal",
      "flight",
      "car_type",
      "passengers",
      "luggage",
      "child_seat",
      "sign_service",
      "english_driver",
      "stop_count",
      "multi_stop_note",
      "tour_mode",
      "tour_area",
      "package_route",
      "trip_days",
      "driver_hotel_type",
      "distance_km",
      "duration_min",
      "final_price",
      "deposit_amount",
      "balance_amount",
      "note",
      "payment_status",
      "payment_url",
      "order_status",
      "driver_note",
      "quote_breakdown",
      "airport_service_type",
      "reserved_airport",
      "airport_terminal",
      "airport_reception_address",
      "flight_time",
      "departure_time",
      "arrival_time",
      "reception_address",
      "reception_point_2",
      "reception_point_3",
      "reception_point_4",
      "reception_point_5",
      "airport_point_2",
      "airport_point_3",
      "airport_point_4",
      "airport_point_5",
      "port_service_type",
      "reserved_port",
      "universal_lounge_type",
      "universal_lounge_passengers",
      "universal_lounge_note",
      "service_tier",
      "premium_addons"
    ];

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(displayHeaders(headers));
  } else {
    ensureHeaders(sheet, headers);
  }

  return sheet;
}

function ensureHeaders(sheet, headers) {
  const width = Math.max(sheet.getLastColumn(), headers.length);
  const current = sheet.getRange(1, 1, 1, width).getValues()[0].map(function(header) {
    return String(header || "");
  });
  const currentKeys = current.map(function(header) {
    return canonicalHeaderKey(header);
  });
  normalizeHeaderRow(sheet, current, currentKeys);
  const missing = headers.filter(function(header) {
    return currentKeys.indexOf(header) < 0;
  });

  if (!missing.length) {
    return;
  }

  sheet.getRange(1, current.length + 1, 1, missing.length).setValues([displayHeaders(missing)]);
}

function normalizeHeaderRow(sheet, current, currentKeys) {
  if (!current.length) {
    return;
  }

  const normalized = current.map(function(header, index) {
    const key = currentKeys[index];
    return HEADER_LABELS[key] || header;
  });

  const changed = normalized.some(function(header, index) {
    return header !== current[index];
  });

  if (changed) {
    sheet.getRange(1, 1, 1, normalized.length).setValues([normalized]);
  }
}

function appendObjectRow(sheet, rowObject) {
  const width = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, width).getValues()[0].map(function(header) {
    return canonicalHeaderKey(header);
  });
  const row = headers.map(function(header) {
    return Object.prototype.hasOwnProperty.call(rowObject, header) ? rowObject[header] : "";
  });
  sheet.appendRow(row);
}

function sheetToObjects(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return [];
  }

  const headers = values[0].map(function(header) {
    return String(header || "");
  });

  return values.slice(1).map(function(row) {
    const item = {};
    headers.forEach(function(header, index) {
      const key = canonicalHeaderKey(header);
      const normalized = normalizeCellByKey(key, row[index]);
      item[header] = normalized;
      item[key] = normalized;
    });
    return item;
  });
}

function normalizeCellByKey(key, cell) {
  if (cell instanceof Date) {
    if (key === "date") {
      return Utilities.formatDate(cell, "Asia/Taipei", "yyyy-MM-dd");
    }

    if ([
      "time",
      "flight_time",
      "departure_time",
      "arrival_time"
    ].indexOf(key) >= 0) {
      return Utilities.formatDate(cell, "Asia/Taipei", "HH:mm");
    }

    return Utilities.formatDate(cell, "Asia/Taipei", "yyyy-MM-dd HH:mm:ss");
  }

  return cell === null || cell === undefined ? "" : String(cell);
}

function normalizeCell(cell) {
  if (cell instanceof Date) {
    return Utilities.formatDate(cell, "Asia/Taipei", "yyyy-MM-dd HH:mm:ss");
  }
  return cell === null || cell === undefined ? "" : String(cell);
}

function displayHeaders(headers) {
  return headers.map(function(header) {
    return HEADER_LABELS[header] || header;
  });
}

function canonicalHeaderKey(header) {
  const text = String(header || "");
  const keys = Object.keys(HEADER_LABELS);
  for (let i = 0; i < keys.length; i++) {
    if (HEADER_LABELS[keys[i]] === text) {
      return keys[i];
    }
  }
  return text;
}

function buildPaymentUrl(orderId, amount) {
  const baseUrl = PropertiesService.getScriptProperties().getProperty("PAYMENT_URL_BASE");
  if (!baseUrl) {
    return "";
  }

  const separator = baseUrl.indexOf("?") >= 0 ? "&" : "?";
  return baseUrl + separator +
    "orderId=" + encodeURIComponent(orderId) +
    "&amount=" + encodeURIComponent(amount);
}

function setupPricingSheets() {
  const pricing = getPricingConfig();
  getOrdersSheet();
  return {
    status: "success",
    message: "訂單分頁與報價設定分頁已建立或已確認存在。",
    sheets: [
      SHEET_NAME,
      PRICING_CAR_TYPES_SHEET,
      PRICING_SERVICES_SHEET,
      PRICING_ADDONS_SHEET,
      PRICING_CROSS_REGIONS_SHEET,
      BUSINESS_HOURLY_PRICING_SHEET,
      BUSINESS_CROSS_REGION_SHEET
    ],
    carTypeCount: pricing.carTypes.length,
    serviceCount: pricing.services.length,
    addonCount: pricing.addons.length,
    crossRegionCount: pricing.crossRegions.length,
    businessHourlyCount: pricing.businessHourly.length,
    businessCrossRegionCount: pricing.businessCrossRegions.length
  };
}

function getPricingConfig() {
  return {
    rules: getPricingRules(),
    carTypes: readConfigSheet(PRICING_CAR_TYPES_SHEET, defaultCarTypeRows()),
    services: readConfigSheet(PRICING_SERVICES_SHEET, defaultServiceRows()),
    addons: readConfigSheet(PRICING_ADDONS_SHEET, defaultAddonRows()),
    crossRegions: readConfigSheet(PRICING_CROSS_REGIONS_SHEET, defaultCrossRegionRows()),
    businessHourly: readConfigSheet(BUSINESS_HOURLY_PRICING_SHEET, defaultBusinessHourlyRows()),
    businessCrossRegions: readConfigSheet(BUSINESS_CROSS_REGION_SHEET, defaultBusinessCrossRegionRows())
  };
}

function getPricingRules() {
  const services = readConfigSheet(PRICING_SERVICES_SHEET, defaultServiceRows());
  const general = {};
  services.forEach(function(row) {
    if (row.service_key === "_rule" && row.service_name) {
      general[row.service_name] = row.min_price;
    }
  });
  return general;
}

function readConfigSheet(sheetName, defaultRows) {
  const sheet = ensureConfigSheet(sheetName, defaultRows);
  return sheetToObjects(sheet).filter(function(row) {
    return hasAnyValue(row) && isEnabled(row.enabled);
  });
}

function ensureConfigSheet(sheetName, defaultRows) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateSheet(spreadsheet, sheetName);

  if (sheet.getLastRow() === 0 && defaultRows.length) {
    const headers = Object.keys(defaultRows[0]);
    sheet.getRange(1, 1, 1, headers.length).setValues([displayHeaders(headers)]);
    sheet.getRange(2, 1, defaultRows.length, headers.length).setValues(defaultRows.map(function(row) {
      return headers.map(function(header) {
        return row[header];
      });
    }));
    sheet.setFrozenRows(1);
  } else if (defaultRows.length) {
    const headers = Object.keys(defaultRows[0]);
    ensureHeaders(sheet, headers);
    appendMissingDefaultRows(sheet, headers, defaultRows);
  }

  return sheet;
}

function appendMissingDefaultRows(sheet, headers, defaultRows) {
  const key = headers[0];
  const existing = sheetToObjects(sheet).map(function(row) {
    return String(row[key] || "");
  });
  const missing = defaultRows.filter(function(row) {
    return existing.indexOf(String(row[key] || "")) < 0;
  });

  if (!missing.length) {
    return;
  }

  sheet.getRange(sheet.getLastRow() + 1, 1, missing.length, headers.length).setValues(missing.map(function(row) {
    return headers.map(function(header) {
      return row[header];
    });
  }));
}

function getOrCreateSheet(spreadsheet, sheetName) {
  const existing = spreadsheet.getSheetByName(sheetName);
  if (existing) {
    return existing;
  }

  const legacyName = LEGACY_SHEET_NAMES[sheetName];
  const legacy = legacyName ? spreadsheet.getSheetByName(legacyName) : null;
  if (legacy) {
    legacy.setName(sheetName);
    return legacy;
  }

  return spreadsheet.insertSheet(sheetName);
}

function defaultCarTypeRows() {
  return [
    carTypeRow("標準商務車", 1800, 45, 8, 800, "Y", "預設報價車型"),
    carTypeRow("Lexus LM 40 / 35", 2800, 55, 10, 1200, "Y", "高端商務 MPV"),
    carTypeRow("Toyota Alphard 40 / 35", 2600, 50, 9, 1000, "Y", "高端商務 MPV"),
    carTypeRow("Toyota Granvia 6/7人座", 2400, 48, 8, 900, "Y", "多人商務"),
    carTypeRow("Benz V-Class V300d / V250d", 2800, 55, 10, 1200, "Y", "高端商務 MPV"),
    carTypeRow("Benz Vito 9人座", 2400, 48, 8, 900, "Y", "九人座"),
    carTypeRow("Benz Sprinter 旗艦9人座", 3600, 65, 12, 1500, "Y", "大型旗艦車"),
    carTypeRow("VW Crafter 旗艦9人座", 3400, 62, 12, 1500, "Y", "大型旗艦車"),
    carTypeRow("Lexus ES300h / ES200h", 1800, 42, 7, 800, "Y", "商務轎車"),
    carTypeRow("一般9人座", 2200, 45, 8, 800, "Y", "一般九人座"),
    carTypeRow("待客服確認", 1800, 45, 8, 800, "Y", "未指定車型")
  ];
}

function defaultServiceRows() {
  return [
    serviceRow("_rule", "distance_rate_per_km", 45, 0, "Y", "未在車型表設定 per_km 時使用"),
    serviceRow("_rule", "duration_rate_per_min", 8, 0, "Y", "未在車型表設定 per_min 時使用"),
    serviceRow("_rule", "deposit_rate", 0.3, 0, "Y", "訂金比例"),
    serviceRow("_rule", "min_deposit", 1000, 0, "Y", "最低訂金"),
    serviceRow("_rule", "round_to", 100, 0, "Y", "報價四捨五入單位"),
    serviceRow("_rule", "tour_day_min_price", 5500, 0, "Y", "旅遊包車每日最低費"),
    serviceRow("_rule", "overtime_unit_min", 30, 0, "Y", "超時計費最小單位，單位為分鐘"),
    serviceRow("機場接送", "機場接送", 1800, 0, "Y", "服務最低費"),
    serviceRow("商務接送", "商務接送", 1800, 0, "Y", "服務最低費"),
    serviceRow("商務包車", "商務包車", 4500, 4500, "Y", "商務包車最低費"),
    serviceRow("旅遊包車", "旅遊包車", 5500, 5500, "Y", "day_min_price 為每日最低費"),
    serviceRow("私人訂製", "私人訂製", 2500, 0, "Y", "服務最低費"),
    serviceRow("港口接送", "港口接送", 2200, 0, "Y", "服務最低費"),
    serviceRow("展演活動", "展演活動", 2500, 0, "Y", "服務最低費"),
    serviceRow("結婚禮車", "結婚禮車", 3800, 0, "Y", "服務最低費"),
    serviceRow("外交禮賓", "外交禮賓", 3800, 0, "Y", "服務最低費"),
    serviceRow("寰宇商務中心禮賓套餐", "寰宇商務中心禮賓套餐", 2800, 0, "Y", "車輛依所選車型報價，商務中心實際費用另計")
  ];
}

function defaultAddonRows() {
  return [
    addonRow("sign_service", "舉牌服務", "signService", "是", "flat", 200, 0, "Y", "每趟固定加價"),
    addonRow("english_driver", "英文司機", "englishDriver", "是", "flat", 800, 0, "Y", "每趟固定加價"),
    addonRow("child_seat", "嬰幼兒安全座椅", "childSeat", "是", "flat", 300, 0, "Y", "每張/每趟固定加價"),
    addonRow("tier_vip_business", "VIP 商務服務", "serviceTier", "VIP 商務服務", "flat", 500, 0, "Y", "含氣泡水/咖啡預選、一次性拖鞋、薄毯、靜音乘車、司機服儀規範"),
    addonRow("tier_royal_concierge", "皇家禮賓服務", "serviceTier", "皇家禮賓服務", "flat", 1500, 0, "Y", "含舉牌接機、英文司機、花束禮品代購、企業接待協助、24小時專人聯繫"),
    addonRow("evian_water", "怡雲礦泉水", "premiumAddons", "怡雲礦泉水", "flat", 100, 0, "Y", "每趟預備"),
    addonRow("sparkling_water", "氣泡水", "premiumAddons", "氣泡水", "flat", 120, 0, "Y", "每趟預備"),
    addonRow("coffee_tea", "咖啡 / 茶飲預備", "premiumAddons", "咖啡 / 茶飲預備", "flat", 180, 0, "Y", "依乘客需求預備"),
    addonRow("disposable_slippers", "一次性拖鞋", "premiumAddons", "一次性拖鞋", "flat", 150, 0, "Y", "釋放雙腳，長程乘車適用"),
    addonRow("in_car_blanket", "車內薄毯", "premiumAddons", "車內薄毯", "flat", 150, 0, "Y", "長程與夜間乘車適用"),
    addonRow("premium_child_seat", "兒童安全座椅", "premiumAddons", "兒童安全座椅", "flat", 300, 0, "Y", "每張/每趟固定加價"),
    addonRow("meet_sign", "舉牌接機", "premiumAddons", "舉牌接機", "flat", 300, 0, "Y", "機場/港口/活動接待"),
    addonRow("premium_english_driver", "英文司機", "premiumAddons", "英文司機", "flat", 800, 0, "Y", "外賓接待適用"),
    addonRow("quiet_ride", "靜音乘車", "premiumAddons", "靜音乘車", "flat", 0, 0, "Y", "司機不主動攀談，除必要行程確認"),
    addonRow("gift_flowers", "花束 / 禮品代購", "premiumAddons", "花束 / 禮品代購", "flat", 0, 0, "Y", "代購實支實付，服務費另議"),
    addonRow("corporate_logo_sign", "企業 Logo 舉牌", "premiumAddons", "企業 Logo 舉牌", "flat", 500, 0, "Y", "企業接待與活動迎賓"),
    addonRow("special_luggage_assist", "協助行李", "specialRequests", "協助行李", "flat", 0, 0, "Y", "標準禮賓協助，特殊大型行李另議"),
    addonRow("special_no_small_talk", "司機不主動攀談", "specialRequests", "司機不主動攀談", "flat", 0, 0, "Y", "靜音乘車需求"),
    addonRow("special_confidential_ride", "保密行程", "specialRequests", "保密行程", "flat", 0, 0, "Y", "企業主管、藝人名流與外賓接待適用"),
    addonRow("special_multi_car", "多車調度", "specialRequests", "多車調度", "flat", 0, 0, "Y", "車隊調度需由客服確認"),
    addonRow("universal_lounge_booking", "寰宇商務中心代訂禮賓服務", "service", "寰宇商務中心禮賓套餐", "flat", 500, 0, "Y", "代訂服務費；商務中心實際費用另計"),
    addonRow("universal_lounge_per_guest", "寰宇商務中心人數服務費", "universalLoungePassengers", "", "per_unit", 0, 0, "Y", "如需依人頭加價，可在此設定單價"),
    addonRow("extra_stop", "增加接送點", "stopCount", "", "per_extra_stop", 300, 1, "Y", "超過 included_qty 的點數逐點加價")
  ];
}

function defaultCrossRegionRows() {
  return [
    crossRegionRow("台北", "桃園", 500, "Y", "雙北往返桃園跨區"),
    crossRegionRow("新北", "桃園", 500, "Y", "新北往返桃園跨區"),
    crossRegionRow("台北", "新竹", 1200, "Y", "台北往返新竹跨區"),
    crossRegionRow("台北", "台中", 3500, "Y", "台北往返台中跨區"),
    crossRegionRow("桃園", "台中", 2800, "Y", "桃園往返台中跨區"),
    crossRegionRow("高雄", "墾丁", 2200, "Y", "高雄往返墾丁跨區")
  ];
}

function defaultBusinessHourlyRows() {
  return [
    businessHourlyRow("Lexus LM 40 / 35", "是", "雙北市區", 4500, 8500, 1000, "是", "高端貴賓、企業主管"),
    businessHourlyRow("Toyota Alphard 40 / 35", "是", "雙北市區", 3800, 6800, 800, "是", "商務接待常用"),
    businessHourlyRow("Toyota Granvia 6/7人座", "是", "雙北市區", 4200, 7500, 900, "是", "多人商務接待"),
    businessHourlyRow("Benz V-Class V300d / V250d", "是", "雙北市區", 4200, 7200, 1000, "是", "外賓商務接待"),
    businessHourlyRow("Benz Vito 9人座", "是", "雙北市區", 3500, 6000, 700, "是", "團體商務接送"),
    businessHourlyRow("Benz Sprinter 旗艦9人座", "是", "雙北市區", 6000, 9500, 1500, "是", "高端大型保母車"),
    businessHourlyRow("VW Crafter 旗艦9人座", "是", "雙北市區", 6000, 9500, 1500, "是", "高端大型保母車"),
    businessHourlyRow("Lexus ES300h / ES200h", "是", "雙北市區", 3000, 5000, 600, "是", "單人商務接送"),
    businessHourlyRow("一般9人座", "是", "雙北市區", 3000, 5500, 700, "是", "一般團體用車"),
    businessHourlyRow("待客服確認", "是", "雙北市區", 3000, 5500, 700, "是", "未指定車型")
  ];
}

function defaultBusinessCrossRegionRows() {
  return [
    businessCrossRegionRow("雙北市區", "桃園市區", 1000, "是", "不含機場接送專案"),
    businessCrossRegionRow("雙北市區", "桃園機場", 1200, "是", "若走機場接送可改用機場報價"),
    businessCrossRegionRow("雙北市區", "基隆市區", 1000, "是", "港區另議"),
    businessCrossRegionRow("雙北市區", "新竹市區", 2500, "是", "商務跨區"),
    businessCrossRegionRow("雙北市區", "苗栗市區", 3500, "是", "商務跨區"),
    businessCrossRegionRow("雙北市區", "台中市區", 5000, "是", "長程商務"),
    businessCrossRegionRow("雙北市區", "宜蘭市區", 2500, "是", "雪隧跨區"),
    businessCrossRegionRow("雙北市區", "花蓮市區", 6000, "是", "長程另議"),
    businessCrossRegionRow("雙北市區", "台南市區", 8000, "是", "長程另議"),
    businessCrossRegionRow("雙北市區", "高雄市區", 9500, "是", "長程另議")
  ];
}

function carTypeRow(car_type, base_fare, per_km, per_min, overtime_per_hour, enabled, note) {
  return { car_type, base_fare, per_km, per_min, overtime_per_hour, enabled, note };
}

function serviceRow(service_key, service_name, min_price, day_min_price, enabled, note) {
  return { service_key, service_name, min_price, day_min_price, enabled, note };
}

function addonRow(addon_key, addon_name, match_field, match_value, pricing_type, unit_price, included_qty, enabled, note) {
  return { addon_key, addon_name, match_field, match_value, pricing_type, unit_price, included_qty, enabled, note };
}

function crossRegionRow(pickup_keyword, dropoff_keyword, surcharge, enabled, note) {
  return { pickup_keyword, dropoff_keyword, surcharge, enabled, note };
}

function businessHourlyRow(car_type, enabled, base_area, three_hour_fare, eight_hour_fare, overtime_per_hour, includes_taipei, note) {
  return { car_type, enabled, base_area, three_hour_fare, eight_hour_fare, overtime_per_hour, includes_taipei, note };
}

function businessCrossRegionRow(base_area, destination_area, surcharge, enabled, note) {
  return { base_area, destination_area, surcharge, enabled, note };
}

function findCarPrice(carTypes, carType) {
  const selected = value(carType);
  for (let i = 0; i < carTypes.length; i++) {
    if (selected && (selected === carTypes[i].car_type || selected.indexOf(carTypes[i].car_type) >= 0 || String(carTypes[i].car_type || "").indexOf(selected) >= 0)) {
      return carTypes[i];
    }
  }
  for (let j = 0; j < carTypes.length; j++) {
    if (carTypes[j].car_type === "待客服確認" || carTypes[j].car_type === "標準商務車") {
      return carTypes[j];
    }
  }
  return {};
}

function findServicePrice(services, service) {
  const selected = value(service);
  for (let i = 0; i < services.length; i++) {
    if (services[i].service_key === selected || services[i].service_name === selected) {
      return services[i];
    }
  }
  return {};
}

function findBusinessHourlyPrice(rows, carType) {
  const selected = value(carType);
  for (let i = 0; i < rows.length; i++) {
    if (selected && (selected === rows[i].car_type || selected.indexOf(rows[i].car_type) >= 0 || String(rows[i].car_type || "").indexOf(selected) >= 0)) {
      return rows[i];
    }
  }
  for (let j = 0; j < rows.length; j++) {
    if (rows[j].car_type === "待客服確認" || rows[j].car_type === "一般9人座") {
      return rows[j];
    }
  }
  return {};
}

function calculateBusinessCrossRegionTotal(rows, data, breakdown) {
  const destination = value(data.businessCrossRegion);
  if (!destination || destination === "否，雙北市區內") {
    return 0;
  }

  if (destination === "其他，客服確認") {
    addBreakdown(breakdown, "跨縣市費用", 0, "其他地區需客服確認");
    return 0;
  }

  for (let i = 0; i < rows.length; i++) {
    if (rows[i].destination_area === destination) {
      return addBreakdown(breakdown, "跨縣市費用", Number(rows[i].surcharge || 0), rows[i].base_area + " -> " + rows[i].destination_area);
    }
  }

  return 0;
}

function parseBusinessHours(input) {
  if (String(input || "").indexOf("客服") >= 0) {
    return 12;
  }
  return Math.max(3, Number(input || 3));
}

function calculateAddonTotal(addons, data, breakdown) {
  let total = 0;
  addons.forEach(function(addon) {
    const amount = calculateAddonAmount(addon, data);
    if (amount > 0) {
      total += addBreakdown(breakdown, addon.addon_name || addon.addon_key, amount, addon.note || "");
    }
  });
  return total;
}

function calculateAddonAmount(addon, data) {
  const pricingType = addon.pricing_type || "flat";
  const unitPrice = Number(addon.unit_price || 0);
  const includedQty = Number(addon.included_qty || 0);
  const fieldValue = data[addon.match_field];

  if (pricingType === "per_extra_stop") {
    const stopCount = Number(fieldValue || data.stopCount || 1);
    return Math.max(0, stopCount - includedQty) * unitPrice;
  }

  if (pricingType === "per_unit") {
    const qty = Number(fieldValue || 0);
    return Math.max(0, qty - includedQty) * unitPrice;
  }

  if (addon.match_value) {
    const valueText = String(fieldValue || "");
    const matchText = String(addon.match_value);
    return valueText === matchText || valueText.indexOf(matchText) >= 0 ? unitPrice : 0;
  }

  return isYes(fieldValue) ? unitPrice : 0;
}

function calculateOvertimeTotal(pricing, data, carPrice, breakdown) {
  const overtimeMin = Number(data.overtimeMin || data.overtime_min || 0);
  const overtimeHours = Number(data.overtimeHours || data.overtime_hours || 0);
  const totalOvertimeMin = overtimeMin + overtimeHours * 60;
  if (totalOvertimeMin <= 0) {
    return 0;
  }

  const perHour = numberOr(carPrice.overtime_per_hour, 800);
  const unitMin = numberOr(pricing.rules.overtime_unit_min, 30);
  const units = Math.ceil(totalOvertimeMin / unitMin);
  const amount = Math.round((perHour / 60) * unitMin * units);
  return addBreakdown(breakdown, "超時費用", amount, totalOvertimeMin + " 分鐘");
}

function calculateCrossRegionTotal(crossRegions, data, breakdown) {
  const pickup = value(data.pickup);
  const dropoff = value(data.dropoff);
  let total = 0;

  crossRegions.forEach(function(rule) {
    const pickupKeyword = value(rule.pickup_keyword);
    const dropoffKeyword = value(rule.dropoff_keyword);
    if (!pickupKeyword || !dropoffKeyword) {
      return;
    }

    const forward = pickup.indexOf(pickupKeyword) >= 0 && dropoff.indexOf(dropoffKeyword) >= 0;
    const reverse = pickup.indexOf(dropoffKeyword) >= 0 && dropoff.indexOf(pickupKeyword) >= 0;
    if (forward || reverse) {
      total += addBreakdown(breakdown, "跨區費用", Number(rule.surcharge || 0), rule.note || pickupKeyword + " / " + dropoffKeyword);
    }
  });

  return total;
}

function addBreakdown(breakdown, name, amount, note) {
  const valueAmount = Number(amount || 0);
  if (valueAmount <= 0) {
    return 0;
  }
  breakdown.push({
    name,
    amount: valueAmount,
    note: note || ""
  });
  return valueAmount;
}

function buildSurchargeNotes(breakdown) {
  const notes = (breakdown || [])
    .filter(function(item) {
      return item.name !== "車型基本費" && item.name !== "路程費" && item.name !== "車程費";
    })
    .map(function(item) {
      return item.name + " NT$" + item.amount;
    });
  return notes.length ? notes.join("、") : "無";
}

function parseDurationSeconds(duration) {
  if (!duration) {
    return 0;
  }
  return Number(String(duration).replace("s", "")) || 0;
}

function makeOrderId() {
  return "RF" + Utilities.formatDate(new Date(), "Asia/Taipei", "yyyyMMddHHmmss") + Math.floor(Math.random() * 900 + 100);
}

function roundToHundred(amount) {
  return Math.round(Number(amount || 0) / 100) * 100;
}

function roundAmount(amount, pricing) {
  const roundTo = numberOr(pricing.rules.round_to, 100);
  return Math.round(Number(amount || 0) / roundTo) * roundTo;
}

function numberOr(input, fallback) {
  const number = Number(input);
  return isNaN(number) ? fallback : number;
}

function value(input) {
  return input === null || input === undefined ? "" : input;
}

function isYes(input) {
  return ["是", "需要", "yes", "true", "1"].indexOf(String(input || "").toLowerCase()) >= 0;
}

function isBusinessService(service) {
  return service === "商務接送" || service === "商務包車";
}

function isEnabled(input) {
  const text = String(input || "").toLowerCase();
  return text !== "n" && text !== "no" && text !== "false" && text !== "否" && text !== "停用" && text !== "0";
}

function hasAnyValue(row) {
  return Object.keys(row || {}).some(function(key) {
    return String(row[key] || "").trim() !== "";
  });
}

function jsonOutput(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
