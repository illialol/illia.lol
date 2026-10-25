"""Apply local customizations to the downloaded profile without changing its styles."""
from pathlib import Path
import re

CARD = '''<section id="discord-presence" class="discord-presence" aria-label="Discord presence" data-status="unknown">
  <div class="discord-avatar-wrap" hidden><img id="discord-avatar" width="74" height="74" alt="Discord avatar"/><span class="discord-status-dot" aria-hidden="true"></span></div>
  <div class="discord-presence-copy">
    <div class="discord-presence-heading"><strong id="discord-name">Discord</strong><span id="discord-guild-tag" hidden><img id="discord-guild-badge" width="16" height="16" alt="" hidden/><span id="discord-guild-name"></span></span><span id="discord-status" class="sr-only">Connecting…</span></div>
    <div id="discord-activities"></div>
    <p id="discord-message" role="status">Waiting for live status</p>
  </div>
</section>'''

def div_bounds(page, classname):
    match = re.search(r'<div\b[^>]*class="[^\"]*\b' + re.escape(classname) + r'\b[^\"]*"[^>]*>', page)
    if not match:
        return None
    depth = 1
    for tag in re.finditer(r'<div\b[^>]*>|</div\s*>', page[match.end():]):
        depth += -1 if tag.group().startswith('</') else 1
        if depth == 0:
            return match.start(), match.end() + tag.end()
    raise ValueError('Unclosed profile div: ' + classname)

def replace_div(page, classname, replacement):
    bounds = div_bounds(page, classname)
    return page[:bounds[0]] + replacement + page[bounds[1]:] if bounds else page

def customize(page):
    page = replace_div(page, 'GUNS__c4-52afb1ed-980a1997-1f6253bb', '')
    page = replace_div(page, 'cf-turnstile', '')
    page = replace_div(page, 'GUNS__a1-9c55e2ff-0953f188-17d83a59', CARD)
    page = re.sub(r'<section\b[^>]*id="discord-presence"[\s\S]*?</section>', lambda _: CARD, page)
    page = re.sub(r'(<h1\b[^>]*>)illia\.mn(</h1>)', r'\g<1>illia.lol\2', page)
    page = page.replace('@illia.mn | guns.lol', '@illia.lol | guns.lol')
    return page

if __name__ == '__main__':
    target = Path(__file__).with_name('index.html')
    target.write_text(customize(target.read_text(encoding='utf-8')), encoding='utf-8')
