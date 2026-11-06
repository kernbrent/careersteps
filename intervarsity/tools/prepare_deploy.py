"""Build, validate, and stage only public website files for Cloudflare."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import shutil
from build_concepts import ROOT, CONCEPTS, PAGES, build

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs, self.options, self.ids = [], [], []
        self.h1 = self.selected = 0
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get('id'):
            self.ids.append(attrs['id'])
        if tag == 'h1':
            self.h1 += 1
        for key in ('src', 'href'):
            if attrs.get(key):
                self.refs.append(attrs[key])
        if tag == 'option':
            self.options.append(attrs['value'])
            self.selected += 'selected' in attrs

build()
expected = [ROOT / prefix / page for _, _, prefix in CONCEPTS for page in PAGES]
for path in expected:
    source = path.read_text(encoding='utf-8')
    parsed = Page()
    parsed.feed(source)
    assert parsed.h1 == 1, f'Expected one page heading: {path}'
    assert len(parsed.ids) == len(set(parsed.ids)), f'Duplicate IDs: {path}'
    assert len(parsed.options) == 5 and parsed.selected == 1, f'Invalid selector: {path}'
    assert source.count('Website designed and maintained by') == 1, f'Missing footer: {path}'
    assert 'noindex,nofollow' in source, f'Review indexing protection missing: {path}'
    for ref in parsed.refs + parsed.options:
        url = urlsplit(ref)
        if url.scheme or url.netloc:
            continue
        target = (path.parent / unquote(url.path)).resolve() if url.path else path
        assert target.is_relative_to(ROOT), f'Link outside site: {ref}'
        assert target.is_file(), f'Broken local reference: {path}: {ref}'
        if url.fragment and target.suffix == '.html':
            linked = Page()
            linked.feed(target.read_text(encoding='utf-8'))
            assert url.fragment in linked.ids, f'Broken anchor: {ref}'
    for option in parsed.options:
        assert Path(option).name == path.name, f'Selector changes page: {path}'

dist = ROOT / 'dist'
dist.mkdir(exist_ok=True)
for path in expected:
    target = dist / path.relative_to(ROOT)
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, target)
assets = [p for p in (ROOT / 'assets').iterdir() if p.suffix in {'.css', '.js', '.svg', '.jpg', '.png'}]
(dist / 'assets').mkdir(exist_ok=True)
for path in assets:
    shutil.copy2(path, dist / 'assets' / path.name)
(dist / 'robots.txt').write_text('User-agent: *\nDisallow: /\n', encoding='utf-8')
(dist / '_headers').write_text('/*\n  X-Robots-Tag: noindex, nofollow\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n', encoding='utf-8')
allowed = {p.relative_to(ROOT) for p in expected + assets} | {Path('robots.txt'), Path('_headers')}
actual = {p.relative_to(dist) for p in dist.rglob('*') if p.is_file()}
assert actual == allowed, f'Unexpected staging contents: {actual ^ allowed}'
print(f'Validated {len(expected)} pages and staged {len(actual)} public files. Research and tools excluded.')
