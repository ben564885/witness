// Witness — AI-generated manager insight for a single person's report.
// Public, read-only in effect: takes the report data the browser already
// has (from /functions/confirm) and asks OpenRouter for a short, grounded
// summary. No DB access, no admin key — the model only ever sees the exact
// numbers and findings passed in, so it can't invent activity that isn't
// already a confirmed, cited attribution.
//
// POST /functions/insight
// { "display_name": "Ars Ray",
//   "visible": { "prs": 0, "tickets_closed": 2, "commits": 2 },
//   "invisible": { "confirmed_unblocks": 4, "reviews": 0, "triage": 0 },
//   "findings": [{ "claim": "...", "rule": "a" }, ...] }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

export default async function (req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) return json({ error: "OPENROUTER_API_KEY not configured" }, 500);

  const body = await req.json().catch(() => null);
  if (!body?.display_name || !body?.visible || !body?.invisible) {
    return json({ error: "display_name, visible, and invisible are required" }, 400);
  }

  const prompt = `Person: ${body.display_name}
Dashboard-visible activity: ${body.visible.tickets_closed} tickets closed, ${body.visible.commits} commits, ${body.visible.prs} PRs.
Confirmed but otherwise invisible work: ${body.invisible.confirmed_unblocks} confirmed unblocks of teammates, ${body.invisible.reviews} reviews.
Confirmed findings (each already verified against a second source):
${(body.findings ?? []).map((f: { claim: string }) => `- ${f.claim}`).join("\n") || "- none"}`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: Deno.env.get("OPENROUTER_CHAT_MODEL") ?? "openai/gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You write a short, factual note for a manager reviewing one engineer. Use ONLY the numbers and findings given — never invent activity, names, or tickets that aren't listed. The findings already name who was helped (e.g. \"Unblocked Philip Nisevich on WIT-19\") — lead with that relationship, not the raw counts. The point isn't that this person referenced a ticket; it's that they personally helped a specific teammate close it, and that's invisible to a dashboard that only counts the assignee. If there are findings, open with who they helped and how, then mention the dashboard numbers only as contrast. If confirmed_unblocks is 0, don't imply there's hidden work to find; just describe the visible activity plainly. 2-3 sentences, plain prose, no bullet points, no headers.",
        },
        { role: "user", content: prompt },
      ],
      max_completion_tokens: 200,
      temperature: 0.4,
    }),
  });

  if (!res.ok) return json({ error: `OpenRouter request failed: ${res.status} ${await res.text()}` }, 502);
  const data = await res.json();
  const insight = data.choices?.[0]?.message?.content?.trim();
  if (!insight) return json({ error: "no completion returned" }, 502);

  return json({ insight });
}
