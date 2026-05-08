/**
 * Solution Tracker Worker
 *
 * Endpoints:
 *   POST /auth/token     — GitHub OAuth token exchange
 *   POST /parse-pdf      — Parse solution design text via GitHub Models API
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
 *        wrangler secret put GITHUB_MODELS_PAT
 *          (fine-grained PAT with "Models: Read" permission)
 *   4. wrangler deploy
 */

const GITHUB_MODELS_URL =
  "https://models.github.ai/inference/chat/completions";

const EXTRACTION_PROMPT = `You are a solution design parser for CrossCountry Consulting (CCC). You will receive the extracted text from a CCC solution design PDF. Extract structured data from it.

Return ONLY a valid JSON object — no markdown fences, no preamble, no explanation. Just the raw JSON.

Schema:
{
  "title": "short name of the solution (2-5 words, e.g. 'Invoice Request Upgrade')",
  "customer": "client company name",
  "author": "author name from the document",
  "developer": "developer name (same as author if not listed separately)",
  "version": "1.0",
  "status": "draft",
  "date_created": "YYYY-MM-DD (today or document date)",
  "go_live_date": "YYYY-MM-DD or null if not specified",
  "environment": "sandbox",
  "tags": ["category:subtag", ...],
  "tasks": [
    {
      "name": "task description",
      "category": "scoping|development|testing|training|deployment",
      "estimated_hours": 0,
      "actual_hours": 0,
      "status": "not_started"
    }
  ],
  "total_hours": 0,
  "notes": "1-2 sentence summary of what the solution does"
}

VALID TAGS (use category:subtag format, or just category if no subtag fits):
- manufacturing: work_orders, wip_routing, mrp, outsourced_mfg, demand_planning, field_service
- order_to_cash: ordering_process, shipping_integrations, ar_automations, rma, warranties, commissions, suitebilling, customer_contact_mgmt
- procure_to_pay: procurement_process, three_way_match, landed_cost, edi, ap_automations
- inventory_mgmt: cycle_counting, inventory_data_load, lot_bin_serial, inv_best_practices, supply_allocation, ala
- record_to_report: basic_accounting, intercompany, currency_reval, arm, fam, segmentation, coa_best_practices, costing
- lead_to_quote: lead_management, online_intake_forms
- crm: case_rules, campaign_mgmt, email_dkim
- quality_mgmt: incoming_inspection, ncr_dmr, in_process_inspection
- projects: general_projects, project_billing
- workflows: approval_workflows, sublist_mod_workflows, advanced_workflows
- users_and_roles: role_audit, dashboard_setup

EXTRACTION RULES:
1. Look for an "Estimate" or "Hours" table — extract each line item as a task.
2. Map tasks to categories: anything about requirements/scoping → "scoping", core build work → "development", QA/UAT → "testing", user training/docs → "training", go-live/migration/cutover → "deployment".
3. If the text has no explicit hours breakdown, create reasonable tasks based on the solution sections with estimated_hours of 0.
4. Set all actual_hours to 0 and all task statuses to "not_started".
5. total_hours must equal the sum of all tasks' estimated_hours.
6. Pick 1-4 tags that best match the NetSuite process areas described.
7. The "notes" field should summarize the technical approach in 1-2 sentences.
8. If go_live_date is not specified, set it to null.`;

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders(env.ALLOWED_ORIGIN),
      });
    }

    const url = new URL(request.url);

    // Route: OAuth token exchange
    if (request.method === "POST" && url.pathname === "/auth/token") {
      return handleAuthToken(request, env);
    }

    // Route: Parse PDF text via GitHub Models
    if (request.method === "POST" && url.pathname === "/parse-pdf") {
      return handleParsePDF(request, env);
    }

    return new Response("Not found", { status: 404 });
  },
};

// ─── Auth token exchange ─────────────────────────────────────────────

async function handleAuthToken(request, env) {
  try {
    const { code } = await request.json();
    if (!code) {
      return jsonResponse({ error: "Missing code" }, 400, env.ALLOWED_ORIGIN);
    }

    const tokenRes = await fetch(
      "https://github.com/login/oauth/access_token",
      {
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
      }
    );

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      return jsonResponse(
        { error: tokenData.error_description || tokenData.error },
        400,
        env.ALLOWED_ORIGIN
      );
    }

    return jsonResponse(
      { access_token: tokenData.access_token },
      200,
      env.ALLOWED_ORIGIN
    );
  } catch (err) {
    return jsonResponse({ error: "Internal error" }, 500, env.ALLOWED_ORIGIN);
  }
}

// ─── PDF text parsing via GitHub Models API ──────────────────────────

async function handleParsePDF(request, env) {
  if (!env.GITHUB_MODELS_PAT) {
    return jsonResponse(
      { error: "GITHUB_MODELS_PAT not configured" },
      500,
      env.ALLOWED_ORIGIN
    );
  }

  try {
    const { text, filename } = await request.json();
    if (!text || !text.trim()) {
      return jsonResponse(
        { error: "Missing or empty text" },
        400,
        env.ALLOWED_ORIGIN
      );
    }

    const modelsRes = await fetch(GITHUB_MODELS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.GITHUB_MODELS_PAT}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2026-03-10",
      },
      body: JSON.stringify({
        model: "openai/gpt-4.1",
        messages: [
          { role: "system", content: EXTRACTION_PROMPT },
          {
            role: "user",
            content: `Here is the extracted text from a CCC solution design PDF${filename ? ` (${filename})` : ""}. Parse it into the JSON schema described in your instructions. Return only the JSON object.\n\n---\n${text}\n---`,
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!modelsRes.ok) {
      const errBody = await modelsRes.text();
      console.error("GitHub Models API error:", modelsRes.status, errBody);
      return jsonResponse(
        { error: `GitHub Models API error: ${modelsRes.status}` },
        502,
        env.ALLOWED_ORIGIN
      );
    }

    const modelsData = await modelsRes.json();

    // Extract assistant message content
    const content = modelsData.choices?.[0]?.message?.content;
    if (!content) {
      return jsonResponse(
        { error: "No response from model" },
        502,
        env.ALLOWED_ORIGIN
      );
    }

    // Parse the JSON — strip any accidental markdown fences
    const cleaned = content
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();
    const solution = JSON.parse(cleaned);

    return jsonResponse({ solution }, 200, env.ALLOWED_ORIGIN);
  } catch (err) {
    console.error("Parse PDF error:", err);
    return jsonResponse(
      { error: err.message || "Failed to parse PDF" },
      500,
      env.ALLOWED_ORIGIN
    );
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonResponse(data, status, origin) {
  return Response.json(data, {
    status,
    headers: corsHeaders(origin),
  });
}
