// Lia 97 AI chat API (Cloudflare Worker).
import { normaliseUrl } from "./safety.js";
import { analyzeHtml, score, recommend, complexity } from "./analyze.js";
import { buildQuote } from "./pricing.js";
import { chatReply, fallbackReview, serviceLabel } from "./ai.js";

const MAX_HTML = 1_500_000;
const MAX_TEXT = 600;      // characters per customer message
const MAX_SITES = 3;       // website checks per conversation
const KEEP_DAYS = 7;       // conversations (with their plan) are kept this long for the quote request

function cors(req, env) {
  const origin = req.headers.get("origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "https://lia97.com,https://www.lia97.com").split(",").map((s) => s.trim());
  return allowed.includes(origin) ? { "access-control-allow-origin": origin, vary: "origin" } : null;
}
const json = (data, status, headers) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", ...headers } });
const oneLine = (v, n) => String(v || "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, n);

async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return env.ALLOW_NO_TURNSTILE === "true";
  if (!token) return false;
  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET); form.append("response", token); if (ip) form.append("remoteip", ip);
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
  return !!(await r.json()).success;
}

/** Per-visitor and site-wide daily limits on new chats and quote requests, so nobody can run up the AI bill. */
async function withinLimits(env, ip, kind = "chat") {
  if (!env.LIMITS) return true;
  const day = new Date().toISOString().slice(0, 10);
  const keys = kind === "lead"
    ? [[`lead:${day}:${ip}`, Number(env.LEADS_PER_IP_DAILY || 3)], [`leads:${day}`, Number(env.LEADS_GLOBAL_DAILY || 100)]]
    : [[`ip:${day}:${ip}`, Number(env.PER_IP_DAILY || 5)], [`all:${day}`, Number(env.GLOBAL_DAILY || 300)]];
  const counts = await Promise.all(keys.map(([k]) => env.LIMITS.get(k)));
  if (keys.some(([, max], i) => Number(counts[i] || 0) >= max)) return false;
  await Promise.all(keys.map(([k], i) => env.LIMITS.put(k, String(Number(counts[i] || 0) + 1), { expirationTtl: 172800 })));
  return true;
}

/** Fetch the visitor's page: validates every redirect hop, 8 s timeout, 1.5 MB cap, HTML only. */
export async function fetchSite(url) {
  const started = Date.now();
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(current, { redirect: "manual", headers: { "user-agent": "Lia97ReviewBot/1.0 (+https://lia97.com)", accept: "text/html" }, signal: AbortSignal.timeout(8000) });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      const next = normaliseUrl(new URL(res.headers.get("location"), current).toString());
      if (!next.ok) throw new Error("bad_redirect");
      current = next.url; continue;
    }
    if (!res.ok) throw new Error(`status_${res.status}`);
    if (!/text\/html|application\/xhtml/i.test(res.headers.get("content-type") || "")) throw new Error("not_html");
    const reader = res.body.getReader(); const chunks = []; let size = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > MAX_HTML) { await reader.cancel(); break; } chunks.push(value); }
    const html = new TextDecoder().decode(chunks.reduce((a, b) => { const m = new Uint8Array(a.length + b.length); m.set(a); m.set(b, a.length); return m; }, new Uint8Array()));
    return { html, finalUrl: current, responseMs: Date.now() - started };
  }
  throw new Error("too_many_redirects");
}

// A website address in a message: needs a common ending (.ae, .com, ...), and is not part of an email address.
const URL_IN_TEXT = /(?<![@\w.-])((?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:ae|com|net|org|io|co|ai|app|dev|shop|store|online|site|tech|info|biz|me|uk|sa|qa|kw|om|bh|eg|jo|in|pk)(?::\d+)?(?:\/[^\s]*)?)(?![\w@.-]*@)(?![\w-])/i;
export function findUrl(text) {
  const m = String(text).match(URL_IN_TEXT);
  return m ? m[1].replace(/[),.!?؟،]+$/, "") : null;
}

async function checkSite(found) {
  const u = normaliseUrl(found);
  if (!u.ok) return null;
  let checks = null, scores = null, reachable = true;
  try { const page = await fetchSite(u.url); checks = analyzeHtml(page.html, page); scores = score(checks); }
  catch { reachable = false; }
  return { host: u.host, reachable, scores, limitedCheck: !!(checks && checks.jsShell),
    checks: checks && { ...checks, title: String(checks.title || "").slice(0, 120), description: String(checks.description || "").slice(0, 160) } };
}

/** The quote for the services the AI picked: prices only ever come from the owner's price sheet. */
export function quoteFor(c) {
  const hasWebsite = !!(c.site && c.site.reachable);
  return buildQuote(c.plan, complexity({ checks: c.site && c.site.checks, business: "other", hasWebsite }));
}

/** The plan as the visitor sees it: amounts only when the owner has turned SHOW_PRICES on. */
export function planView(c, lang, showPrices) {
  const q = quoteFor(c);
  const label = (i) => ({ ...i, label: serviceLabel(i.id, lang), why: (c.why && c.why[i.id]) || "" });
  const items = q.items.map(label), optional = q.optional.map(label);
  if (showPrices) return { ...q, items, optional };
  const strip = (i) => ({ id: i.id, label: i.label, why: i.why, weeks: i.weeks });
  return { items: items.map(strip), optional: optional.map(strip), weeks: q.weeks, pricesHidden: true };
}

const HANDOFF = {
  en: "Thanks for the details! Our team will reply to you personally. Message us on WhatsApp or leave your number for a call back.",
  ar: "شكرًا على التفاصيل! سيرد عليك فريقنا شخصيًا. راسلنا على واتساب أو اترك رقمك لنتصل بك.",
};

/** When the AI is unavailable: a rules-based plan if a website was checked, otherwise hand over to the team. */
function fallbackChat(c, lang) {
  if (c.site && c.site.reachable && c.site.checks) {
    const text = fallbackReview({ checks: c.site.checks, scores: c.site.scores }, lang);
    const plan = recommend({ checks: c.site.checks, scores: c.site.scores, business: "other", goal: "customers", hasWebsite: true }).map((id) => ({ id, why: "" }));
    return { reply: [text.summary, ...text.issues.map((i) => `• ${i.title}: ${i.detail}`)].join("\n"), plan, handoff: false, business: "", need: "" };
  }
  return { reply: HANDOFF[lang], plan: [], handoff: true, business: "", need: "" };
}

/** One customer message: load or start the conversation, check any website mentioned, and ask the AI. */
export async function chat(body, env, ip) {
  const lang = body.lang === "ar" ? "ar" : "en";
  const text = String(body.text || "").replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, " ").trim().slice(0, MAX_TEXT);
  if (!text) return { status: 400, data: { error: "empty_message" } };
  let c;
  if (body.chatId) {
    const stored = env.LIMITS && (await env.LIMITS.get(`chat:${oneLine(body.chatId, 64)}`));
    if (!stored) return { status: 404, data: { error: "chat_expired" } };
    c = JSON.parse(stored);
  } else {
    if (!(await verifyTurnstile(env, body.token, ip))) return { status: 403, data: { error: "bot_check_failed" } };
    if (!(await withinLimits(env, ip))) return { status: 429, data: { error: "daily_limit" } };
    c = { id: crypto.randomUUID(), lang, messages: [], turns: 0, sites: 0, site: null, plan: [], why: {}, business: "", need: "" };
  }
  if (c.turns >= Number(env.CHAT_MAX_TURNS || 20)) return { status: 429, data: { error: "chat_limit" } };
  c.lang = lang; c.turns++;
  c.messages.push({ role: "user", content: text });

  let check = null;
  const found = findUrl(text);
  if (found && c.sites < MAX_SITES) {
    const result = await checkSite(found);
    if (result) { c.sites++; c.site = result; check = { site: result.host, reachable: result.reachable, scores: result.scores, limitedCheck: result.limitedCheck }; }
  }

  let out;
  try {
    if (!env.MINIMAX_API_KEY) throw new Error("ai_not_configured");
    out = await chatReply(env, { lang, history: c.messages, site: c.site });
  } catch { out = fallbackChat(c, lang); }
  if (out.plan.length) { c.plan = out.plan.map((p) => p.id); c.why = Object.fromEntries(out.plan.map((p) => [p.id, p.why])); }
  if (out.business) c.business = out.business;
  if (out.need) c.need = out.need;
  c.messages.push({ role: "assistant", content: JSON.stringify({ reply: out.reply, plan: out.plan.map((p) => p.id) }) });
  c.messages = c.messages.slice(-30);
  if (env.LIMITS) await env.LIMITS.put(`chat:${c.id}`, JSON.stringify(c), { expirationTtl: KEEP_DAYS * 86400 });

  const data = { chatId: c.id, reply: out.reply, handoff: !!out.handoff, business: c.business, site: c.site ? c.site.host : null };
  if (check) data.check = check;
  if (out.plan.length) data.plan = planView(c, lang, env.SHOW_PRICES === "true");
  return { status: 200, data };
}

/** The visitor asks for their quote or a call back: everything is emailed to the owner, never to the visitor. */
export async function sendLead(env, body) {
  const name = oneLine(body.name, 80), contact = oneLine(body.contact, 120), id = oneLine(body.chatId, 64);
  if (!name || !contact) return { status: 400, data: { error: "missing_contact" } };
  if (!id || !env.LIMITS) return { status: 400, data: { error: "missing_chat" } };
  const stored = await env.LIMITS.get(`chat:${id}`);
  if (!stored) return { status: 404, data: { error: "chat_expired" } };
  if (!env.RESEND_API_KEY) return { status: 503, data: { error: "email_not_configured" } };
  const c = JSON.parse(stored), q = c.plan.length ? quoteFor(c) : null, aed = (n) => Number(n).toLocaleString("en-US");
  const line = (i) => `- ${serviceLabel(i.id, "en")}: ${aed(i.from)}–${aed(i.to)} AED${i.weeks ? ` (${i.weeks[0]}–${i.weeks[1]} weeks)` : ""}${c.why[i.id] ? `\n    Why: ${c.why[i.id]}` : ""}`;
  const said = (m) => { if (m.role === "user") return m.content; try { return JSON.parse(m.content).reply; } catch { return m.content; } };
  const text = [
    q ? "QUOTE TO APPROVE. It has NOT been sent to the customer. Reply to them after you approve it." : "CALL-BACK REQUEST. There is no plan yet: read the conversation below.", "",
    `Name: ${name}`, `Contact: ${contact}`, `Language: ${c.lang}`, `Website: ${c.site ? c.site.host : "none given"}`,
    `Business (AI summary): ${c.business || "-"}`, `Need (AI summary): ${c.need || "-"}`,
    `Website score: ${c.site && c.site.scores ? c.site.scores.overall + "/100" : "-"}`,
    ...(q ? ["", "The AI chose these services from your price list. Check they fit before you approve.", "",
      "Plan (AED, excl. 5% VAT):", ...q.items.map(line), `Total: ${aed(q.total.from)}–${aed(q.total.to)} AED excl. 5% VAT`,
      ...(q.optional.length ? ["", "Optional extras (not in the total):", ...q.optional.map(line)] : []),
      "", `Hosting & maintenance: ${aed(q.monthly)} AED/month excl. 5% VAT (${q.monthlyPlan})`, `Delivery: ${q.weeks ? q.weeks[0] + "–" + q.weeks[1] + " weeks" : "-"}`] : []),
    "", "Conversation:", ...c.messages.map((m) => `${m.role === "user" ? "Customer" : "Bot"}: ${String(said(m)).slice(0, 600)}`),
  ].join("\n");
  const replyTo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) ? { reply_to: contact } : {};
  const about = c.site ? c.site.host : oneLine(c.business, 60) || "chat";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env.LEAD_FROM || "Lia 97 Reviews <reviews@lia97.com>", to: [env.LEAD_TO || "info@lia97.com"], subject: `${q ? "Quote to approve" : "Call-back request"}: ${name} (${about})`, text, ...replyTo }),
  });
  if (!res.ok) return { status: 502, data: { error: "email_failed" } };
  await env.LIMITS.put(`lead:${id}`, JSON.stringify({ name, contact, at: new Date().toISOString() }), { expirationTtl: 2592000 });
  return { status: 200, data: { ok: true } };
}

export default {
  async fetch(req, env) {
    const headers = cors(req, env);
    if (!headers) return json({ error: "origin_not_allowed" }, 403, {});
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...headers, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type", "access-control-max-age": "86400" } });
    const path = new URL(req.url).pathname;
    if (req.method !== "POST" || !["/api/chat", "/api/lead"].includes(path)) return json({ error: "not_found" }, 404, headers);
    if (Number(req.headers.get("content-length") || 0) > 8000) return json({ error: "too_large" }, 413, headers);
    let body; try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400, headers); }
    const ip = req.headers.get("cf-connecting-ip") || "unknown";
    if (path === "/api/lead") {
      if (!(await withinLimits(env, ip, "lead"))) return json({ error: "daily_limit" }, 429, headers);
      const r = await sendLead(env, body); return json(r.data, r.status, headers);
    }
    const r = await chat(body, env, ip);
    return json(r.data, r.status, headers);
  },
};
