export async function onRequest(context) {
  try {
    const gasUrl = context.env.GAS_WEB_APP_URL;
    const payload = await context.request.json();

    const response = await fetch(gasUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action: "getRouteEstimate",
        payload: payload
      })
    });

    const text = await response.text();

    return new Response(text, {
      status: 200,
      headers: {
        "Content-Type": "application/json;charset=utf-8",
        "Access-Control-Allow-Origin": "*"
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      status: "error",
      message: error && error.message ? error.message : String(error)
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json;charset=utf-8",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
