"""Checks for the 1997 Labs website in site/."""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

import pytest
from bs4 import BeautifulSoup

SITE = Path(__file__).resolve().parent.parent / "site"
DOMAIN = "https://1997labs.com/"
PAGES = ["index.html", "ar/index.html", "privacy.html", "404.html"]
EXTERNAL = ("http://", "https://", "//", "data:", "mailto:", "tel:", "#")
DESCRIPTOR = re.compile(r"ai\s*&\s*software company", re.IGNORECASE)


def load(name: str) -> BeautifulSoup:
    return BeautifulSoup((SITE / name).read_text(encoding="utf-8"), "html.parser")


@pytest.fixture(scope="module")
def home() -> BeautifulSoup:
    return load("index.html")


@pytest.mark.parametrize("page", PAGES)
def test_local_files_exist(page):
    soup = load(page)
    refs = [el.get("src") or el.get("href") for el in soup.select("[src], link[href], a[href]")]
    missing = []
    for ref in refs:
        if not ref or ref.startswith(EXTERNAL) or ref in ("/", "./"):
            continue
        path = SITE / ref.lstrip("/").split("#")[0]
        if not path.is_file():
            missing.append(ref)
    assert not missing, f"{page} references missing files: {missing}"


def test_in_page_links_have_targets(home):
    ids = {el["id"] for el in home.select("[id]")}
    broken = [a["href"] for a in home.select('a[href^="#"]') if a["href"][1:] not in ids]
    assert not broken, f"Links to missing sections: {broken}"


def test_ids_are_unique(home):
    duplicates = [i for i, n in Counter(el["id"] for el in home.select("[id]")).items() if n > 1]
    assert not duplicates, f"Duplicate ids: {duplicates}"


def test_images_have_alt_attribute(home):
    assert all(img.get("alt") is not None for img in home.find_all("img"))


def test_tech_company_is_stated_up_front(home):
    """Visitors and search engines should see 'AI & Software Company' immediately."""
    assert DESCRIPTOR.search(home.title.string)
    assert DESCRIPTOR.search(home.find("meta", attrs={"name": "description"})["content"])
    assert DESCRIPTOR.search(home.select_one(".hero .pill").get_text())
    assert "AI assistants on WhatsApp" in home.select_one(".hero .sub").get_text()


def test_english_copy_lives_in_the_html(home):
    """Search engines read English from / and Arabic from /ar/; the h1 carries the company descriptor and the slogan."""
    assert home.select_one(".hero h1").get_text(" ", strip=True) == "1997 Labs AI & Software Company · Dubai More customers. Less work. More revenue."
    assert "applyLang(PAGE_LANG);" in (SITE / "index.html").read_text(encoding="utf-8")


def test_old_red_accent_is_gone():
    html = (SITE / "index.html").read_text(encoding="utf-8")
    assert not re.search(r"(?i)ff3b30|d82d26|255,\s*59,\s*48", html)


def test_example_figures_are_labelled(home):
    assert "not client results" in home.select_one("#os .os-demo").get_text()


def test_consent_banner_waits_for_an_analytics_id(home):
    assert home.select_one("#consent #allow-analytics")
    assert "analyticsConfig.ga4||analyticsConfig.clarity" in (SITE / "index.html").read_text(encoding="utf-8")


def test_privacy_notice_is_linked(home):
    assert home.select_one('footer a[href="privacy.html"]')
    assert home.select_one('.form-note a[href="privacy.html"]')


def test_search_and_social_metadata_agree(home):
    assert home.find("link", rel="canonical")["href"] == DOMAIN
    assert home.find("meta", property="og:url")["content"] == DOMAIN
    og_image = home.find("meta", property="og:image")["content"]
    assert og_image.startswith(DOMAIN) and (SITE / og_image[len(DOMAIN):]).is_file()
    data = json.loads(home.find("script", type="application/ld+json").string)
    assert data["url"] == DOMAIN and data["email"] == "info@1997labs.com"
    assert f"Sitemap: {DOMAIN}sitemap.xml" in (SITE / "robots.txt").read_text()
    assert f"<loc>{DOMAIN}</loc>" in (SITE / "sitemap.xml").read_text()


def test_assets_stay_light():
    sizes = {p.name: p.stat().st_size for p in (SITE / "assets").iterdir()}
    heavy = {name: size for name, size in sizes.items() if size > 400_000}
    assert not heavy, f"Assets over 400 KB: {heavy}"
    total = sum(p.stat().st_size for p in SITE.rglob("*") if p.is_file())
    assert total < 1_500_000, f"Site is {total} bytes; keep it under 1.5 MB"


def test_fonts_are_self_hosted():
    html = (SITE / "index.html").read_text(encoding="utf-8")
    assert "fonts.googleapis.com" not in html and "fonts.gstatic.com" not in html
    fonts = re.findall(r"url\((assets/fonts/[^)]+)\)", html)
    assert fonts and all((SITE / f).is_file() for f in fonts)


def test_services_cover_what_we_sell(home):
    titles = [t.get_text(strip=True) for t in home.select("#assemble .atile h3")]
    assert titles == ["AI Assistant on WhatsApp", "Business Websites", "Online Stores", "Online Booking", "CRM Systems", "Mobile Apps", "Custom Platforms & Automation"]


def test_industries_cover_many_kinds_of_business(home):
    tiles = home.select('#industries .ind a[href="#contact"]')
    assert len(tiles) == 8 and tiles[-1].get_text(" ", strip=True).startswith("Your Business")


def test_whatsapp_number_is_configured(home):
    number = re.search(r'const WHATSAPP_NUMBER = "(971\d{9})"', (SITE / "index.html").read_text(encoding="utf-8")).group(1)
    links = home.select("a[data-wa]")
    assert len(links) >= 3 and all(a["href"].startswith(f"https://wa.me/{number}") for a in links)


def test_previous_projects_show_screenshots_without_links(home):
    cards = home.select("#work .pcard")
    assert len(cards) == 8
    for card in cards:
        img = card.select_one("img")
        assert img and img.get("alt") and img["src"].startswith("assets/work-")
        assert card.select_one(".meta b") and card.select_one(".sum").get_text(strip=True)
        assert not card.select("a"), "projects are shown without links"
    assert "replace" not in home.select_one("#work .work-note").get_text().lower()


def test_every_translatable_text_has_arabic():
    html = (SITE / "index.html").read_text(encoding="utf-8")
    start = html.index("const AR = {")
    arabic = html[start:html.index("\n};", start)]
    missing = sorted(k for k in set(re.findall(r'data-i18n="([^"]+)"', html)) if f'"{k}"' not in arabic)
    assert not missing, f"No Arabic text for: {missing}"


def test_ai_chat_is_the_real_assistant(home):
    """The design's demo chat is gone; the AI chat buttons open assets/review.js, and stay hidden until it is set up."""
    html = (SITE / "index.html").read_text(encoding="utf-8")
    assert home.find("script", src="assets/review.js") and home.find("link", href="assets/review.css")
    assert len(home.select("[data-open-chat]")) >= 3
    assert not home.select("#chat") and "Demo chat" not in html and "window.RV" in html


@pytest.mark.parametrize("page", PAGES)
def test_tab_icon(page):
    """Every page uses the "97" tab icon: SVG for modern browsers, .ico fallback, and an iPhone home-screen icon."""
    soup = load(page)
    hrefs = {(" ".join(l.get("rel")), l.get("href", "").lstrip("/")) for l in soup.select("link[rel]")}
    assert ("icon", "assets/favicon.svg") in hrefs
    assert ("icon", "favicon.ico") in hrefs
    assert ("apple-touch-icon", "assets/apple-touch-icon.png") in hrefs


@pytest.mark.parametrize("page", PAGES)
def test_new_logo(page):
    """Every page header shows the owner's logo (97 mark + 1997 LABS), and the old lime mark is gone everywhere."""
    html = (SITE / page).read_text(encoding="utf-8")
    soup = BeautifulSoup(html, "html.parser")
    mark = soup.select_one("a.logo svg.logo-mark, a.brand svg.logo-mark")
    assert mark is not None, f"{page}: header logo missing"
    assert mark.select("path") or mark.select("use[href='#lg1997']"), f"{page}: logo has no artwork"
    if mark.select("use"):
        assert len(soup.select("symbol#lg1997 path")) == 10
    assert "1997-labs-mark.svg" not in html and "logo-seal" not in html


def test_logo_files_and_structured_data(home):
    for f in ("1997-labs-logo-black.svg", "1997-labs-logo-white.svg", "1997-labs-logo.png"):
        assert (SITE / "assets" / f).is_file(), f
    data = json.loads(home.select_one('script[type="application/ld+json"]').string)
    assert data["logo"] == DOMAIN + "assets/1997-labs-logo.png"


def test_arabic_page_is_built_from_the_english_one():
    """site/ar/index.html must match `python tools/build_ar.py` output (re-run it after editing site/index.html)."""
    import importlib.util
    spec = importlib.util.spec_from_file_location("build_ar", SITE.parent / "tools" / "build_ar.py")
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    fresh = mod.build((SITE / "index.html").read_text(encoding="utf-8"))
    assert (SITE / "ar" / "index.html").read_text(encoding="utf-8") == fresh, "run: python tools/build_ar.py"


def test_both_languages_are_indexable():
    alternates = {"en": DOMAIN, "ar": DOMAIN + "ar/", "x-default": DOMAIN}
    for page, lang, url in (("index.html", "en", DOMAIN), ("ar/index.html", "ar", DOMAIN + "ar/")):
        soup = load(page)
        assert soup.html["lang"] == lang and soup.html["dir"] == ("rtl" if lang == "ar" else "ltr")
        assert soup.find("link", rel="canonical")["href"] == url
        assert soup.find("meta", property="og:url")["content"] == url
        assert {l["hreflang"]: l["href"] for l in soup.find_all("link", hreflang=True)} == alternates
        desc = soup.find("meta", attrs={"name": "description"})["content"]
        assert 50 <= len(desc) <= 160, f"{page}: description is {len(desc)} characters"
        assert re.search(r"[\u0600-\u06FF]", soup.select_one("h1").get_text()) if lang == "ar" else DESCRIPTOR.search(soup.select_one("h1").get_text())
    sitemap = (SITE / "sitemap.xml").read_text()
    for url in (DOMAIN, DOMAIN + "ar/", DOMAIN + "privacy.html"):
        assert f"<loc>{url}</loc>" in sitemap
    assert sitemap.count('hreflang="ar"') == 2


def test_how_it_works_cards(home):
    """How it works: four stacking colour cards, each with number, title, text and an illustration."""
    cards = home.select("#how .stk-card")
    assert len(cards) == 4
    for n, card in enumerate(cards, 1):
        assert card.select_one(".stk-n").get_text(strip=True) == f"0{n}"
        assert card.select_one(f'h3[data-i18n="h{n}.t"]').get_text(strip=True)
        assert card.select_one(f'p[data-i18n="h{n}.d"]').get_text(strip=True)
        assert card.select_one(".stk-art svg") is not None
    assert not home.select("#how .pil, #pworld"), "old pillar markup left"
