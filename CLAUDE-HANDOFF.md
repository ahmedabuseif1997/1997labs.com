# 1997 Labs website — Claude handoff

This folder holds the current 1997 Labs website. It has not been published yet.

## Open the website

The finished static website is in `site/`. No framework, package installation or build step is needed.

```bash
python -m http.server -d site 8002   # then open http://localhost:8002
```

## Main files

- `site/index.html` — page structure, styling, motion, responsive behaviour, analytics scaffolding and copy.
- `site/assets/fonts/` — self-hosted Manrope and IBM Plex Sans Arabic (OFL-1.1, from Fontsource).
- Logo (owner's artwork, Oct 2026): slanted "97" mark + "1997 LABS" lettering. Inline in every page header (index uses one `<symbol id="lg1997">` for header and footer), black on light theme, white on dark. Files: `site/assets/1997-labs-logo-black.svg`, `site/assets/1997-labs-logo-white.svg` (transparent), `site/assets/1997-labs-logo.png` (1600×400 on white, JSON-LD `logo`). Never redraw or recolour the artwork.
- Tab icons from the logo's "97" mark: `site/assets/favicon.svg` (white mark on a dark #141615 circle), `site/favicon.ico` (16/32/48), `site/assets/apple-touch-icon.png` (180, full-bleed square).
- `site/assets/og-image.jpg` — 1200×630 share image (screenshot of the light-mode hero).
- `site/privacy.html`, `site/404.html`, `site/robots.txt`, `site/sitemap.xml`.
- `1997-LABS-BRAND-PROFILE.md` — positioning and brand foundation.
- `ANALYTICS-SETUP.md` — how to switch analytics on.

Older hero and logo files, `LOGO-GUIDE.md` (which describes the earlier 971 Labs logo kit) and `.openai/hosting.json` were not carried over. They remain in the original project zip.

## Current direction

- Brand: 1997 Labs, an **AI & Software Company** in Dubai. The descriptor sits next to the logo on every screen.
- Main hook: “More customers. Less work. More revenue.”
- Primary action: free business evaluation.
- Design: the owner's chosen "Design ★" (Oct 2026), a mix of the Signal, Bento, Navy Official and Platinum Minimal concepts. Light mode by default with a dark switch; English and Arabic (full right-to-left).
- Palette: light background `#ECECE8`, surfaces `#FFFFFF`, text `#141615`, accent blue `#3E5BD8`; dark background `#111314`, surfaces `#1A1D20`, text `#ECECE8`, accent `#8AA2FF`.
- Voice: short, plain, catchy, and understandable to a nontechnical business owner.
- Layout: the owner's "97 / 1997 LABS" logo in the menu bar; hero with live tiles led by a split-flap board (1997 LABS + the services, a new word every 2.5 s), "watch your business run itself" 3D scene, services that assemble in 3D, a 3D carousel of real projects, industries, four rising "how it works" pillars, and the free-evaluation form.

## Implementation notes

- All copy is written directly in the HTML. The earlier script that rewrote the text after the page loaded has been removed, so search engines, link previews and visitors without JavaScript see the real copy.
- The three unused sections (profile, how we work, process) and their styles were deleted.
- Example figures carry a visible “not client results” note.
- The consent banner only appears once a GA4 or Clarity ID is set in `analyticsConfig`.
- The free-evaluation form opens WhatsApp with the visitor's details typed in.

## Preserve while editing

- The giant thin `1997`, the split-flap board and the 3D scroll scenes.
- The calm blue accent with light and dark modes.
- The simplified, benefit-first language, plus the “AI & Software Company” descriptor.
- Desktop and mobile layouts.
- The "business runs itself" demonstration.
- The free-evaluation form.
- `info@1997labs.com` as the public contact email.
- Accessibility labels and reduced-motion support.

Do not deploy or publish changes unless the owner explicitly approves the preview.
