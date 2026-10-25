"""Refresh the public page and save a standalone, offline frontend copy."""
from pathlib import Path
from urllib.parse import urljoin, urlsplit
from urllib.request import build_opener, HTTPCookieProcessor, Request
from http.cookiejar import CookieJar
import hashlib
import html
import json
import re
from customize_page import customize

ROOT = Path(__file__).resolve().parent
BASE = 'https://guns.lol/illia.mn'
opener = build_opener(HTTPCookieProcessor(CookieJar()))
assets = {}

def fetch(url):
    with opener.open(Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=90) as response:
        return response.read()

def save_asset(url, base=BASE):
    if url.startswith(('data:', '#')):
        return url
    url = urljoin(base, html.unescape(url))
    if url.startswith('data:') or url.startswith('#'):
        return url
    if url in assets:
        return assets[url]
    suffix = Path(urlsplit(url).path).suffix or '.bin'
    name = hashlib.sha256(url.encode()).hexdigest()[:16] + suffix
    relative = 'assets/' + name
    assets[url] = relative
    data = fetch(url)
    if suffix == '.css':
        text = data.decode('utf-8')
        def replace(match):
            value = match.group(1).strip().strip('"\'')
            if value.startswith(('data:', '#')):
                return match.group(0)
            local = save_asset(value, url)
            return 'url("' + Path(local).name + '")'
        text = re.sub(r'url\(([^)]+)\)', replace, text)
        data = text.encode('utf-8')
    (ROOT / relative).write_bytes(data)
    print(f'Saved {relative}: {len(data):,} bytes', flush=True)
    return relative

def main():
    (ROOT / 'assets').mkdir(exist_ok=True)
    source = fetch(BASE).decode('utf-8')
    (ROOT / 'original-page.html').write_text(source, encoding='utf-8')
    page = re.sub(r'<script\b[\s\S]*?</script>', '', source, flags=re.I)
    page = re.sub(r'<link\b[^>]*>', lambda m: '' if re.search(r'rel="(?:preload|manifest|canonical)"', m.group(0)) else m.group(0), page)
    page = re.sub(r'<meta\b[^>]*(?:property="og:|name="twitter:)[^>]*>', '', page)
    def link(match):
        return 'href="' + save_asset(match.group(1)) + '"'
    # Only resource links in the head, leaving navigation links untouched.
    head, body = page.split('</head>', 1)
    head = re.sub(r'href="([^\"]+)"', link, head)
    page = head + '</head>' + body
    def css_url(match):
        value = match.group(1).strip().strip('"\'')
        return 'url(' + save_asset(value) + ')'
    page = re.sub(r'url\(([^)]+)\)', css_url, page)
    background = next(url for url in assets if url.endswith('.mp4'))
    video = '<video id="local-background" loop playsinline preload="auto" aria-hidden="true"><source src="' + assets[background] + '" type="video/mp4"></video>'
    page = page.replace('<body>', '<body>' + video)
    page = page.replace('</head>', '<link rel="stylesheet" href="local.css"/></head>')
    page = page.replace('</body>', '<script src="local.js"></script></body>')
    (ROOT / 'index.html').write_text(customize(page), encoding='utf-8')
    (ROOT / 'asset-manifest.json').write_text(json.dumps(assets, indent=2), encoding='utf-8')
    print(f'Finished: {len(assets)} local resources.')

if __name__ == '__main__':
    main()
