export async function onRequestPost(context) {
  return forwardToGas(context, "submitBooking");
}

async function forwardToGas(context, action) {
  try {
    const gasUrl = context.env.GAS_WEB_APP_URL;
    if (!gasUrl) {
      return jsonResponse({
        status: "error",
        message: "Cloudflare Pages 尚未設定 GAS_WEB_APP_URL 環境變數。"
      }, 500);
    }

    const payload = await context.request.json();
    const response = await fetch(gasUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action,
        payload
      })
    });

    const text = await response.text();
    return new Response(text, {
      status: response.ok ? 200 : response.status,
      headers: corsHeaders()
    });
  } catch (error) {
    return jsonResponse({
      status: "error",
      message: error && error.message ? error.message : String(error)
    }, 500);
  }
}

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders()
  });
}

function corsHeaders() {
  return {
    "Content-Type": "application/json;charset=utf-8",
    "Access-Control-Allow-Origin": "*"
  };
}
