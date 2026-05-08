/**
 * GitHub OAuth Token Exchange Worker
 *
 * Deploy to Cloudflare Workers (free tier: 100K requests/day).
 *
 * Setup:
 *   1. Install Wrangler: npm install -g wrangler
 *   2. wrangler login
 *   3. Set secrets:
 *        wrangler secret put GITHUB_CLIENT_ID
 *        wrangler secret put GITHUB_CLIENT_SECRET
 *        wrangler secret put ALLOWED_ORIGIN   (e.g. https://ccc-mtzeng.github.io)
 *   4. wrangler deploy
 */

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders(env.ALLOWED_ORIGIN),
      });
    }

    // Only accept POST to /auth/token
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/auth/token") {
      return new Response("Not found", { status: 404 });
    }

    try {
      const { code } = await request.json();
      if (!code) {
        return jsonResponse({ error: "Missing code" }, 400, env.ALLOWED_ORIGIN);
      }

      // Exchange the code for an access token
      const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });

      const tokenData = await tokenRes.json();

      if (tokenData.error) {
        return jsonResponse({ error: tokenData.error_description || tokenData.error }, 400, env.ALLOWED_ORIGIN);
      }

      return jsonResponse({ access_token: tokenData.access_token }, 200, env.ALLOWED_ORIGIN);
    } catch (err) {
      return jsonResponse({ error: "Internal error" }, 500, env.ALLOWED_ORIGIN);
    }
  },
};

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonResponse(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin),
    },
  });
}
