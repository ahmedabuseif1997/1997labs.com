# Lia 97 — company website

Website for **Lia 97**, an AI & software company in Dubai. Static HTML in `site/`, with no build step. Hosted on DigitalOcean App Platform as a static site (`.do/app.yaml`): every change merged to `main` goes live. `.github/workflows/tests.yml` runs the tests on every change.

## Preview locally

```bash
python -m http.server -d site 8002
python -m pytest                         # checks (pip install -r requirements-dev.txt)   # then open http://localhost:8002
```

## What changed from the delivered project (2 Oct 2026)

| Area | Change |
|---|---|
| Copy | The text that a script rewrote after page load is now written in the HTML; the rewrite script is gone. Visible text and the demo data were verified identical before and after. |
| Dead code | Removed the hidden profile, how-we-work and process sections, their 48 CSS selectors and a hidden "Profile" menu link. Page size 69 KB → 49 KB. |
| Images | Hero is a JPEG (314 KB) instead of a 1.9 MB PNG. Only the two images the page uses are included (the delivered `dist/` had 13 files, about 15 MB). |
| Colour | Replaced the remaining hard-coded red glows and chart gradient with the lime accent; merged three colour blocks into one. |
| Tech identity | "AI & Software Company" beside the logo and in the title, description and share cards; the hero sentence names AI agents, websites, apps and CRM; a visible row of five service icons; plain menu labels (Services, AI & Automation, Results). |
| Search & sharing | New title and description, 1200×630 share image, large-image Twitter card, richer schema.org data, sitemap dates, 404 page. |
| Privacy | Privacy notice page, linked from the footer and the form. The analytics consent banner appears only once an analytics ID is configured. |
| Charts | Example numbers kept, with a visible "Example data · for illustration, not client results" label. |

## Before going live

1. Approve the preview.
2. DigitalOcean: Create → App Platform → GitHub → this repository, branch `main`, source directory `site`, autodeploy on. Resource type Static Site, no build command, Starter (free) plan. The settings are in `.do/app.yaml` (Settings → App Spec).
3. In the app: Settings → Domains → add `lia97.com` (primary) and `www.lia97.com`. At Namecheap (lia97.com → Advanced DNS) replace the `A @` and `CNAME www` records with the records DigitalOcean shows. Leave the email (MX) and TXT records alone.
4. Have the privacy notice reviewed by someone qualified in UAE data protection (Federal Decree-Law 45/2021) before launch.
5. Later: add GA4 and Clarity IDs (`ANALYTICS-SETUP.md`), connect the form to a form service or CRM, and add the Arabic version.

## AI chat (chatbot)

A free chat in the corner of the site (`site/assets/review.js`), answered by MiniMax through the API in `worker/` (Cloudflare Worker), in English or Arabic. The AI asks short questions to understand the customer's business and need, checks any website address they send (the server opens the page and gives the AI only the check results), and recommends services from the owner's list in `worker/src/pricing.js`. Rules in `worker/src/ai.js` keep it on topic and stop it from following instructions typed by visitors.

Prices always come from the price sheet, never from the AI. The AI never sees them, and the server replaces any reply that mentions money. Visitors see the recommended plan (no prices) and leave a name and contact; the full priced quote and the conversation are emailed to info@lia97.com marked "QUOTE TO APPROVE". Set `SHOW_PRICES = "true"` in `worker/wrangler.toml` to show prices on the site instead. Lead emails (step 5) are therefore required. Without a MiniMax key the chat still checks websites with fixed wording and otherwise hands the visitor to WhatsApp or a call back. The chat stays hidden until `REVIEW_API` is set in `site/assets/review.js`.

Setup, once:

1. **Cloudflare**: create a free account. Create an API token with the "Edit Cloudflare Workers" template. In GitHub (Settings → Secrets and variables → Actions) add secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
2. **Daily limits store**: in Cloudflare, Storage → KV → create a namespace (for example `lia97-review-limits`). Add its id as the repository **variable** `KV_NAMESPACE_ID`.
3. **Bot check**: in Cloudflare, Turnstile → add a widget for `Lia97.com`. Put the **site key** in `TURNSTILE_SITE_KEY` in `site/assets/review.js`, and add the **secret key** as the secret `TURNSTILE_SECRET`.
4. **AI**: add your MiniMax API key as the secret `MINIMAX_API_KEY`. If your MiniMax account offers a spending limit, set one.
5. **Lead emails** (required while prices are hidden): create a Resend account, verify the domain `Lia97.com` (Resend shows DNS records to add at Namecheap), and add the secret `RESEND_API_KEY`. Without it, visitors can still message you on WhatsApp, but quote requests from the chat fail.
6. Run **Actions → Review chatbot → Run workflow**. Copy the `workers.dev` address from the deploy log into `REVIEW_API` in `site/assets/review.js`.

Limits (in `worker/wrangler.toml`): 5 new chats per visitor per day, 300 new chats per day in total, 20 messages per chat, 3 quote or call-back requests per visitor per day. Conversations are kept for 7 days. Each chat message saves one record in the Cloudflare KV store; Cloudflare's free plan limits KV writes per day (see Cloudflare's Workers KV pricing), so move to the Workers paid plan if the chat gets busy. Tests: `cd worker && npm test`.
