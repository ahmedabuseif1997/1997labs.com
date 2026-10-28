"""Build the Arabic home page (site/ar/index.html) from the English one (site/index.html).

Search engines only index what is in the HTML, so the Arabic version gets its own address (/ar/)
with the Arabic text already in place, instead of being swapped in by the language button.
Every element with data-i18n="key" gets the text of AR[key] from the page script; head tags,
lang/dir and asset paths are adjusted for /ar/. Re-run after every change to site/index.html:

    python tools/build_ar.py

A test (tests/test_site.py) fails if site/ar/index.html is out of date.
"""
from __future__ import annotations

import html
import json
import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "site" / "index.html"
OUT = ROOT / "site" / "ar" / "index.html"
DOMAIN = "https://1997labs.com/"

TITLE_AR = "1997 Labs — شركة ذكاء اصطناعي وبرمجيات في دبي"
DESC_AR = ("1997 Labs شركة ذكاء اصطناعي وبرمجيات في دبي. نبني مساعدين أذكياء على واتساب، "
           "ومواقع إلكترونية، ومتاجر، وأنظمة حجز، وأنظمة إدارة عملاء، وتطبيقات جوال.")
OG_ALT_AR = "1997 Labs: عملاء أكثر. مجهود أقل. أرباح أكثر."
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}


def arabic_dictionary(page: str) -> dict[str, str]:
    start = page.index("const AR = {") + len("const AR = ")
    end = page.index("\n};", start) + 2
    return json.loads(re.sub(r",\s*}", "}", page[start:end]))


class _Spans(HTMLParser):
    """Finds the inner text range of every element that carries data-i18n."""

    def __init__(self, page: str):
        super().__init__(convert_charrefs=False)
        self.page, self.stack, self.found = page, [], []
        self.line_starts = [0] + [m.end() for m in re.finditer("\n", page)]

    def _offset(self) -> int:
        line, col = self.getpos()
        return self.line_starts[line - 1] + col

    def handle_starttag(self, tag, attrs):
        if tag in VOID:
            return
        key = dict(attrs).get("data-i18n")
        inner = self._offset() + len(self.get_starttag_text())
        self.stack.append((tag, key, inner))

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        while self.stack:
            open_tag, key, inner = self.stack.pop()
            if open_tag == tag:
                if key:
                    self.found.append((inner, self._offset(), key))
                return


def build(page: str) -> str:
    ar = arabic_dictionary(page)
    finder = _Spans(page)
    finder.feed(page)
    finder.close()
    out = page
    for start, end, key in sorted(finder.found, reverse=True):
        if key in ar:
            out = out[:start] + html.escape(ar[key], quote=False) + out[end:]

    def rep(old: str, new: str) -> None:
        nonlocal out
        assert out.count(old) == 1, (out.count(old), old[:80])
        out = out.replace(old, new)

    rep('<html lang="en" dir="ltr"', '<html lang="ar" dir="rtl"')
    title = re.search(r"<title>.*?</title>", out).group(0)
    rep(title, f"<title>{html.escape(TITLE_AR)}</title>")
    for attr, value in (('name="description"', DESC_AR), ('property="og:title"', TITLE_AR), ('property="og:description"', DESC_AR),
                        ('name="twitter:title"', TITLE_AR), ('name="twitter:description"', DESC_AR), ('property="og:image:alt"', OG_ALT_AR)):
        tag = re.search(rf'<meta {attr} content="[^"]*">', out).group(0)
        rep(tag, f'<meta {attr} content="{html.escape(value)}">')
    rep(f'<link rel="canonical" href="{DOMAIN}">', f'<link rel="canonical" href="{DOMAIN}ar/">')
    rep(f'<meta property="og:url" content="{DOMAIN}">', f'<meta property="og:url" content="{DOMAIN}ar/">')
    rep('<meta property="og:locale" content="en_US">\n<meta property="og:locale:alternate" content="ar_AE">',
        '<meta property="og:locale" content="ar_AE">\n<meta property="og:locale:alternate" content="en_US">')
    # the page lives one folder down: point every local file at the site root
    out = re.sub(r'((?:src|href)=")(assets/|favicon\.ico|privacy\.html)', r"\1/\2", out)
    out = out.replace("url(assets/", "url(/assets/")
    return out


def main() -> None:
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(build(SRC.read_text(encoding="utf-8")), encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
