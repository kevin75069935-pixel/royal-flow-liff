export async function onRequestGet(context) {
  const token = context.env.LINE_CHANNEL_ACCESS_TOKEN || "";
  const result = {
    status: "ok",
    env: {
      LIFF_URL: Boolean(context.env.LIFF_URL),
      GAS_WEB_APP_URL: Boolean(context.env.GAS_WEB_APP_URL),
      LINE_CHANNEL_SECRET: Boolean(context.env.LINE_CHANNEL_SECRET),
      LINE_CHANNEL_ACCESS_TOKEN: Boolean(token),
      ADMIN_LINE_USER_ID: Boolean(context.env.ADMIN_LINE_USER_ID || context.env.ADMIN_LINE_USER_IDS),
      ORDER_KV: Boolean(context.env.ORDER_KV)
    },
    lineBotInfo: {
      ok: false,
      status: null,
      message: ""
    },
    webhookEndpoint: {
      ok: false,
      status: null,
      endpoint: "",
      active: null,
      message: ""
    },
    webhookTest: {
      ok: false,
      status: null,
      message: "",
      response: null
    }
  };

  if (!token) {
    result.lineBotInfo.message = "LINE_CHANNEL_ACCESS_TOKEN is missing.";
    return jsonResponse(result, 200);
  }

  try {
    const response = await fetch("https://api.line.me/v2/bot/info", {
      headers: {
        Authorization: "Bearer " + token
      }
    });
    result.lineBotInfo.status = response.status;

    const text = await response.text();
    if (response.ok) {
      const data = text ? JSON.parse(text) : {};
      result.lineBotInfo.ok = true;
      result.lineBotInfo.message = "LINE access token is valid.";
      result.lineBotInfo.basicId = data.basicId || "";
      result.lineBotInfo.displayName = data.displayName || "";
    } else {
      result.lineBotInfo.message = text.substring(0, 240);
    }
  } catch (error) {
    result.lineBotInfo.message = error && error.message ? error.message : String(error);
  }

  try {
    const response = await fetch("https://api.line.me/v2/bot/channel/webhook/endpoint", {
      headers: {
        Authorization: "Bearer " + token
      }
    });
    result.webhookEndpoint.status = response.status;

    const text = await response.text();
    if (response.ok) {
      const data = text ? JSON.parse(text) : {};
      result.webhookEndpoint.ok = true;
      result.webhookEndpoint.endpoint = data.endpoint || "";
      result.webhookEndpoint.active = data.active;
      result.webhookEndpoint.message = "LINE webhook endpoint loaded.";
    } else {
      result.webhookEndpoint.message = text.substring(0, 240);
    }
  } catch (error) {
    result.webhookEndpoint.message = error && error.message ? error.message : String(error);
  }

  if (result.webhookEndpoint.endpoint) {
    try {
      const response = await fetch("https://api.line.me/v2/bot/channel/webhook/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify({
          endpoint: result.webhookEndpoint.endpoint
        })
      });
      result.webhookTest.status = response.status;

      const text = await response.text();
      if (response.ok) {
        result.webhookTest.ok = true;
        result.webhookTest.response = text ? JSON.parse(text) : {};
        result.webhookTest.message = "LINE webhook test completed.";
      } else {
        result.webhookTest.message = text.substring(0, 240);
      }
    } catch (error) {
      result.webhookTest.message = error && error.message ? error.message : String(error);
    }
  }

  return jsonResponse(result, 200);
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json;charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
