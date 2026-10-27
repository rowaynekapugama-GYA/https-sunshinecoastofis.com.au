#!/usr/bin/env python3
"""
Turn the approved single-page site (_tools/source/approved-index.html) into:

  content/templates/sections.json   one template per section: the approved HTML with
                                    {{fN}} placeholders where the practice can edit,
                                    plus the label and type of every editable field
  content/pages/<slug>.json         every page: route, SEO and its sections in order,
                                    with the current wording, links and photos
  content/pages/site-wide.json      the header, menu, footer and mobile call bar

Run once (or again after a developer changes the approved HTML):

    python3 _tools/extract_templates.py

The templates are the approved markup byte for byte. With no dashboard edits, a page
renders exactly the HTML that was signed off (checked by _tools/check_fidelity.py).
Never deployed.
"""
import html
import json
import os
import re
import sys
from html.parser import HTMLParser

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SRC = os.path.join(ROOT, '_tools', 'source', 'approved-index.html')

# ---------------------------------------------------------------- routes
# Approved hash routes -> the live WordPress URLs (trailing slash, as Google has them).
ROUTES = {
    '': '/',
    'home': '/',
    'our-practice': '/about/',
    'services': '/services/',
    'services/wisdom-teeth-removal': '/services/wisdom-teeth-removal/',
    'services/dental-implants': '/services/dental-implants/',
    'services/all-on-4-dental-implants': '/services/all-on-4-dental-implants/',
    'services/zygomatic-implants': '/services/zygomatic-implants/',
    'services/jaw-bone-grafting': '/services/jaw-bone-grafting/',
    'services/orthognathic-surgery': '/services/orthognathic-corrective-jaw-surgery/',
    'services/facial-trauma': '/services/facial-trauma/',
    'patient-information': '/patient-information/',
    'locations': '/locations/',
    'doctor-referral': '/online-doctor-referral/',
    'contact': '/contact-us/',
}
# data-page id -> page slug (content/pages/<slug>.json) and menu name
PAGES = {
    'home': ('home', 'Home'),
    'our-practice': ('about', 'Our practice'),
    'services': ('services', 'Services'),
    'services--wisdom-teeth-removal': ('wisdom-teeth-removal', 'Wisdom teeth removal'),
    'services--dental-implants': ('dental-implants', 'Dental implants'),
    'services--all-on-4-dental-implants': ('all-on-4-dental-implants', 'All-on-4 full arch implants'),
    'services--zygomatic-implants': ('zygomatic-implants', 'Zygomatic implants'),
    'services--jaw-bone-grafting': ('jaw-bone-grafting', 'Jaw bone grafting'),
    'services--orthognathic-surgery': ('orthognathic-corrective-jaw-surgery', 'Corrective jaw surgery'),
    'services--facial-trauma': ('facial-trauma', 'Facial trauma'),
    'patient-information': ('patient-information', 'Patient information'),
    'locations': ('locations', 'Locations'),
    'doctor-referral': ('online-doctor-referral', 'Refer a patient'),
    'contact': ('contact-us', 'Contact us'),
    # added at go-live (_tools/source/new-pages.html)
    'blog': ('blog', 'Blog'),
    'patient-information--patient-information-form': ('patient-information-form', 'Patient information form'),
    'feedback': ('feedback', 'Feedback'),
    'privacy-policy': ('privacy-policy', 'Privacy policy'),
    'disclaimer': ('disclaimer', 'Disclaimer'),
    'not-found': ('not-found', 'Page not found'),
}
NEW_ROUTES = {
    'blog': '/blog/',
    'patient-information--patient-information-form': '/patient-information/patient-information-form/',
    'feedback': '/feedback/',
    'privacy-policy': '/privacy-policy/',
    'disclaimer': '/disclaimer/',
    'not-found': '/404/',
}
NEW_SRC = os.path.join(ROOT, '_tools', 'source', 'new-pages.html')


def route_for_hash(h):
    """'#/services/x#anchor' -> '/services/x/#anchor'"""
    body = h[2:] if h.startswith('#/') else h[1:]
    path, _, anchor = body.partition('#')
    path = path.strip('/')
    if path not in ROUTES:
        raise SystemExit(f'Unknown route in approved HTML: {h}')
    return ROUTES[path] + (f'#{anchor}' if anchor else '')


def rewrite_source(s):
    """Hash links to real URLs, relative asset paths to root-absolute ones."""
    s = re.sub(r'href="(#/[^"]*)"', lambda m: f'href="{route_for_hash(m.group(1))}"', s)
    s = re.sub(r'(src|srcset|href)="(images|files)/', r'\1="/\2/', s)
    # Footer legal links pointed at the old WordPress site in a new tab; they are pages on this site now.
    s = s.replace('href="https://sunshinecoastofis.com.au/privacy-policy/" target="_blank" rel="noopener"', 'href="/privacy-policy/"')
    s = s.replace('href="https://sunshinecoastofis.com.au/disclaimer/" target="_blank" rel="noopener"', 'href="/disclaimer/"')
    s = s.replace('href="https://sunshinecoastofis.com.au/patient-information/patient-information-form/" target="_blank" rel="noopener"', 'href="/patient-information/patient-information-form/"')
    return s


# ---------------------------------------------------------------- parsing with source offsets
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}


class Node:
    __slots__ = ('tag', 'attrs', 'raw', 'start', 's_end', 'i_end', 'end', 'children', 'parent')

    def __init__(self, tag, attrs, raw, start, parent):
        self.tag, self.attrs, self.raw, self.start, self.parent = tag, dict(attrs), raw, start, parent
        self.s_end = start + len(raw)
        self.i_end = self.end = self.s_end
        self.children = []

    @property
    def classes(self):
        return (self.attrs.get('class') or '').split()


class Text:
    __slots__ = ('start', 'end', 'parent')

    def __init__(self, start, end, parent):
        self.start, self.end, self.parent = start, end, parent


class Tree(HTMLParser):
    def __init__(self, src):
        super().__init__(convert_charrefs=False)
        self.src = src
        self.lines = [0]
        for m in re.finditer('\n', src):
            self.lines.append(m.end())
        self.root = Node('#root', [], '', 0, None)
        self.stack = [self.root]

    def off(self):
        line, col = self.getpos()
        return self.lines[line - 1] + col

    def cur(self):
        return self.stack[-1]

    def handle_starttag(self, tag, attrs):
        n = Node(tag, attrs, self.get_starttag_text(), self.off(), self.cur())
        self.cur().children.append(n)
        if tag not in VOID:
            self.stack.append(n)

    def handle_startendtag(self, tag, attrs):
        n = Node(tag, attrs, self.get_starttag_text(), self.off(), self.cur())
        self.cur().children.append(n)

    def handle_endtag(self, tag):
        pos = self.off()
        end = self.src.index('>', pos) + 1
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                for n in self.stack[i + 1:]:
                    n.i_end = n.end = pos  # unclosed child (should not happen in the approved HTML)
                n = self.stack[i]
                n.i_end, n.end = pos, end
                del self.stack[i:]
                return
        print(f'warning: stray </{tag}> at {pos}', file=sys.stderr)

    def _text(self, length):
        pos = self.off()
        kids = self.cur().children
        if kids and isinstance(kids[-1], Text) and kids[-1].end == pos:
            kids[-1].end = pos + length
        else:
            kids.append(Text(pos, pos + length, self.cur()))

    def handle_data(self, data):
        self._text(len(data))

    def handle_entityref(self, name):
        self._text(len(name) + 2)

    def handle_charref(self, name):
        self._text(len(name) + 3)

    def handle_comment(self, data):
        pass


def attr_span(src, node, name):
    """(start, end) of an attribute's value inside the node's start tag, or None."""
    m = re.search(r'\s' + re.escape(name) + r'="([^"]*)"', node.raw)
    if not m:
        return None
    return node.start + m.start(1), node.start + m.end(1)


# ---------------------------------------------------------------- what counts as editable
# Inline tags the dashboard's text editor can show and write back exactly: **bold**, *italic*, [links](/x/) and line breaks.
INLINE = {'strong', 'b', 'em', 'i', 'br', 'a'}
SKIP = {'script', 'style', 'svg', 'template', 'form', 'iframe', 'select', 'textarea', 'noscript', 'button', 'video', 'picture', 'source', 'input'}


def text_of(src, n):
    if isinstance(n, Text):
        return src[n.start:n.end]
    return ''.join(text_of(src, c) for c in n.children)


def has_text(src, n):
    # Words or numbers, not just symbols such as the five rating stars.
    return bool(re.search(r'[A-Za-z0-9]', html.unescape(text_of(src, n))))


def inline_ok(n):
    """True if every element below n is a plain inline tag the editor can round-trip."""
    for c in n.children:
        if isinstance(c, Text):
            continue
        if c.tag not in INLINE:
            return False
        extra = set(c.attrs) - ({'href', 'target', 'rel'} if c.tag == 'a' else set())
        if extra:
            return False
        if c.tag == 'a' and not c.attrs.get('href'):
            return False
        if not inline_ok(c):
            return False
    return True


def is_leaf(src, n):
    return has_text(src, n) and inline_ok(n)


def has_inline_tags(n):
    return any(isinstance(c, Node) for c in n.children)


def editable_href(v):
    return bool(v) and not v.startswith(('tel:', 'mailto:')) and v != '#'


# ---------------------------------------------------------------- labels
TAG_LABEL = {
    'h1': 'Main heading', 'h2': 'Heading', 'h3': 'Sub-heading', 'h4': 'Small heading',
    'p': 'Paragraph', 'li': 'List item', 'summary': 'Question', 'small': 'Small text',
    'b': 'Bold text', 'strong': 'Bold text', 'label': 'Form label', 'dt': 'Term', 'dd': 'Description',
    'figcaption': 'Caption', 'blockquote': 'Quote', 'td': 'Table cell', 'th': 'Table heading',
}


def label_for(src, n, kind):
    cls = n.classes if isinstance(n, Node) else []
    if kind == 'image':
        return 'Photo'
    if kind == 'href':
        return 'Link address'
    if kind == 'link':
        return 'Button' if 'btn' in cls else 'Link'
    if isinstance(n, Text):
        p = n.parent
        return 'Button text' if p.tag == 'a' and 'btn' in p.classes else 'Text'
    if 'kicker' in cls:
        return 'Small label above the heading'
    if 'crumb' in cls:
        return 'Breadcrumb'
    if 'lead' in cls or 'sub' in cls or 'lede' in cls:
        return 'Introduction'
    if 'role' in cls:
        return 'Role'
    if 'more' in cls:
        return 'Link text'
    if 'area' in cls:
        return 'Area'
    if n.tag == 'p' and n.parent is not None and n.parent.tag == 'details':
        return 'Answer'
    if n.tag == 'span' and n.parent is not None and n.parent.tag in ('div',) and 'tags' in n.parent.classes:
        return 'Tag'
    return TAG_LABEL.get(n.tag, 'Text')


def iter_nodes(n):
    for c in n.children:
        if isinstance(c, Node):
            yield c
            yield from iter_nodes(c)


def section_label(src, sec):
    def first(tags):
        stack = [sec]
        while stack:
            n = stack.pop(0)
            if isinstance(n, Node):
                if n.tag in tags and has_text(src, n):
                    t = html.unescape(re.sub(r'<[^>]+>', '', src[n.s_end:n.i_end]))
                    return re.sub(r'\s+', ' ', t).strip()
                stack[0:0] = [c for c in n.children if isinstance(c, Node) and c.tag not in SKIP]
        return None

    cls = sec.classes
    if 'hero' in cls:
        return 'Top banner (video, heading and buttons)'
    if 'proof' in cls:
        return 'Key figures strip'
    if not first({'h1', 'h2', 'h3'}) and any(isinstance(c, Node) and 'strip' in c.classes for c in iter_nodes(sec)):
        return 'Photo strip'
    if 'pagehead' in cls:
        h = first({'h1'})
        return f'Page heading: {h}' if h else 'Page heading'
    h = first({'h2'}) or first({'h3'})
    return h or 'Section'


# ---------------------------------------------------------------- one section -> template + fields
TOKENS = [('(07) 5406 0586', '{{phone}}'), ('tel:0754060586', 'tel:{{phoneTel}}'), ('&copy; 2026', '&copy; {{year}}')]


def tokenise(s):
    for a, b in TOKENS:
        s = s.replace(a, b)
    return s


def build_template(src, root, generated):
    """generated(node) -> placeholder string if node's inner HTML is generated from data, else None."""
    fields = {}  # key -> definition (type, label)
    values = {}  # key -> current values
    repl = []  # (start, end, text)
    counts = {}

    def new_key():
        return f'f{len(fields) + 1}'

    def numbered(label):
        counts[label] = counts.get(label, 0) + 1
        return label if counts[label] == 1 else f'{label} {counts[label]}'

    def add(kind, node, **vals):
        k = new_key()
        fields[k] = {'type': kind, 'label': numbered(label_for(src, node, kind))}
        values[k] = vals
        return k

    def text_field(node, start, end, kind):
        raw = tokenise(src[start:end])
        if raw.strip() in ('{{phone}}',):
            return None  # the practice phone number: changed once in Site Settings, not per page
        lead = re.match(r'\s*', raw).group(0)
        trail = re.search(r'\s*$', raw).group(0)
        core = raw[len(lead):len(raw) - len(trail)] if trail else raw[len(lead):]
        k = add(kind, node, value=core)
        repl.append((start, end, f'{lead}{{{{{k}}}}}{trail}'))
        return k

    def walk(n):
        if n.tag in SKIP:
            return
        g = generated(n)
        if g == 'SKIP':
            return
        if g is not None:
            repl.append(g)
            return
        if n.tag == 'img':
            src_span, alt_span = attr_span(src, n, 'src'), attr_span(src, n, 'alt')
            if src_span:
                k = add('image', n, src=src[slice(*src_span)], alt=src[slice(*alt_span)] if alt_span else '')
                repl.append((src_span[0], src_span[1], f'{{{{{k}.src}}}}'))
                if alt_span:
                    repl.append((alt_span[0], alt_span[1], f'{{{{{k}.alt}}}}'))
            return
        href = n.attrs.get('href') if n.tag == 'a' else None
        if n.tag == 'a' and is_leaf(src, n):
            if editable_href(href):
                hs = attr_span(src, n, 'href')
                raw = tokenise(src[n.s_end:n.i_end])
                k = add('link', n, value=raw.strip(), href=src[slice(*hs)])
                lead = re.match(r'\s*', raw).group(0)
                trail = re.search(r'\s*$', raw).group(0)
                repl.append((n.s_end, n.i_end, f'{lead}{{{{{k}}}}}{trail}'))
                repl.append((hs[0], hs[1], f'{{{{{k}.href}}}}'))
            else:
                text_field(n, n.s_end, n.i_end, 'rich' if has_inline_tags(n) else 'text')
            return
        if n.tag == 'a' and editable_href(href):
            hs = attr_span(src, n, 'href')
            k = add('href', n, href=src[slice(*hs)])
            repl.append((hs[0], hs[1], f'{{{{{k}.href}}}}'))
        if n.tag != '#root' and n is not root and is_leaf(src, n):
            text_field(n, n.s_end, n.i_end, 'rich' if has_inline_tags(n) else 'text')
            return
        for c in n.children:
            if isinstance(c, Text):
                if re.search(r'[A-Za-z0-9]', html.unescape(src[c.start:c.end])):
                    text_field(c, c.start, c.end, 'text')
            else:
                walk(c)

    walk(root)
    out = []
    pos = root.start
    for a, b, t in sorted(repl):
        if a < pos:
            raise SystemExit(f'overlapping replacement at {a}')
        out.append(src[pos:a])
        out.append(t)
        pos = b
    out.append(src[pos:root.end])
    template = tokenise(''.join(out))
    return template, fields, values


# ---------------------------------------------------------------- generated regions
def make_generated(src):
    def generated(n):
        cls = n.classes
        if n.tag == 'div' and 'loc-list' in cls:
            return (n.s_end, n.i_end, '{{@locations}}')
        if n.attrs.get('data-generated') == 'posts':
            return (n.s_end, n.i_end, '{{@posts}}')
        if n.tag == 'div' and 'team' in cls:
            return (n.s_end, n.i_end, '{{@staff}}')
        if n.tag == 'article' and 'bio' in cls:
            # the surgeons' full bios: every consecutive article.bio becomes one generated block
            sib = [c for c in n.parent.children if isinstance(c, Node) and c.tag == 'article' and 'bio' in c.classes]
            if n is sib[0]:
                return (n.start, sib[-1].end, '{{@surgeons}}')
            return 'SKIP'  # already covered by the first one
        return None

    return generated


# ---------------------------------------------------------------- main
def main():
    raw = open(SRC, encoding='utf-8').read()
    src = rewrite_source(raw)
    # The approved HTML with real URLs: what scripts/test-render.ts compares the rendered pages against.
    with open(os.path.join(ROOT, '_tools', 'source', 'approved-rewritten.html'), 'w', encoding='utf-8') as fh:
        fh.write(src)
    tree = Tree(src)
    tree.feed(src)
    tree.close()
    html_node = next(c for c in tree.root.children if isinstance(c, Node) and c.tag == 'html')
    body = next(c for c in html_node.children if isinstance(c, Node) and c.tag == 'body')
    main_el = next(c for c in body.children if isinstance(c, Node) and c.tag == 'main')

    generated = make_generated(src)
    templates = {}
    pages = []

    # ---- site-wide parts
    shell_parts = []
    for c in body.children:
        if not isinstance(c, Node) or c.tag in ('script', 'main'):
            continue
        name = {'topbar': 'topbar', 'drawer': 'drawer', 'mcta': 'mcta'}.get((c.classes or [''])[0], c.tag)
        name = 'drawer' if c.attrs.get('id') == 'drawer' else name
        label = {'topbar': 'Top strip (above the menu)', 'header': 'Main menu', 'drawer': 'Mobile menu', 'footer': 'Footer', 'mcta': 'Mobile call bar'}[name]
        t, f, v = build_template(src, c, generated)
        tid = f'site/{name}'
        templates[tid] = {'label': label, 'fields': f, 'html': t, 'before_main': c.start < main_el.start}
        shell_parts.append({'id': name, 'template': tid, 'fields': v})
    pages.append({
        'slug': 'site-wide',
        'route': '',
        'pageId': '',
        'title': 'Header, menu and footer',
        'kind': 'site',
        'seo': {},
        'sections': shell_parts,
    })

    # ---- pages
    def page_loop(main_node, src_text, routes_for):
        g = make_generated(src_text)
        for c in main_node.children:
            if not (isinstance(c, Node) and c.tag == 'div' and 'data-page' in c.attrs):
                continue
            pid = c.attrs['data-page']
            slug, title = PAGES[pid]
            secs = []
            n = 0
            for sec in c.children:
                if not (isinstance(sec, Node) and sec.tag == 'section'):
                    continue
                n += 1
                t, f, v = build_template(src_text, sec, g)
                tid = f'{slug}/{n}'
                templates[tid] = {'label': section_label(src_text, sec), 'fields': f, 'html': t}
                secs.append({'id': f's{n}', 'template': tid, 'fields': v})
            pages.append({'slug': slug, 'route': routes_for(pid), 'pageId': pid, 'title': title, 'kind': 'page', 'seo': {}, 'sections': secs})

    page_loop(main_el, src, lambda pid: ROUTES['' if pid == 'home' else pid.replace('--', '/')])
    nsrc = rewrite_source(open(NEW_SRC, encoding='utf-8').read())
    ntree = Tree(nsrc)
    ntree.feed(nsrc)
    ntree.close()
    nmain = next(c for c in ntree.root.children if isinstance(c, Node) and c.tag == 'main')
    page_loop(nmain, nsrc, lambda pid: NEW_ROUTES[pid])

    # ---- write
    tdir = os.path.join(ROOT, 'content', 'templates')
    pdir = os.path.join(ROOT, 'content', 'pages')
    os.makedirs(tdir, exist_ok=True)
    os.makedirs(pdir, exist_ok=True)
    with open(os.path.join(tdir, 'sections.json'), 'w', encoding='utf-8') as fh:
        json.dump(templates, fh, indent=1, ensure_ascii=False)
        fh.write('\n')
    seo = {}
    seo_file = os.path.join(ROOT, 'seo-migration', 'page-seo.json')
    if os.path.exists(seo_file):
        seo = json.load(open(seo_file, encoding='utf-8'))
    for p in pages:
        p['seo'] = dict(seo.get(p['slug'], p['seo']))
        # Share image: the page's own banner photo (the WordPress share images do not move to the new site).
        img = next((v for v in (p['sections'][0]['fields'].values() if p['sections'] and p['kind'] == 'page' else []) if 'src' in v), None)
        if img and not p['seo'].get('ogImage'):
            p['seo']['ogImage'] = img['src']
        with open(os.path.join(pdir, f"{p['slug']}.json"), 'w', encoding='utf-8') as fh:
            json.dump(p, fh, indent=2, ensure_ascii=False)
            fh.write('\n')
    nf = sum(len(t['fields']) for t in templates.values())
    print(f'{len(pages)} pages, {len(templates)} section templates, {nf} editable fields')


if __name__ == '__main__':
    main()


# ---------------------------------------------------------------- data for the generated blocks
def inner(src, n):
    return src[n.s_end:n.i_end]


def kids(n, tag=None, cls=None):
    return [c for c in n.children if isinstance(c, Node) and (tag is None or c.tag == tag) and (cls is None or cls in c.classes)]


def find(n, pred):
    for c in iter_nodes(n):
        if pred(c):
            return c
    return None


def extract_data():
    """Locations (Site Settings) and the team (Team collection) from the approved HTML."""
    src = rewrite_source(open(SRC, encoding='utf-8').read())
    tree = Tree(src)
    tree.feed(src)
    tree.close()
    allnodes = list(iter_nodes(tree.root))
    # ---- locations: the home page list (identical on the Locations page)
    ll = next(n for n in allnodes if n.tag == 'div' and 'loc-list' in n.classes)
    locations = []
    for d in kids(ll, 'div', 'loc'):
        a = d.attrs
        area = find(d, lambda c: 'area' in c.classes)
        locations.append({
            'name': a.get('data-name'),
            'area': inner(src, area),
            'address': a.get('data-addr'),
            'note': a.get('data-note'),
            'mapLink': html.unescape(a.get('data-link')),
            'mapQuery': a.get('data-q'),
            'mapEmbed': a.get('data-embed') or '',
            'pin': a.get('data-pin'),
            'main': 'main' in d.classes,
        })
    # raw attribute values from the source (HTMLParser already unescaped them; keep the source text)
    for loc, d in zip(locations, kids(ll, 'div', 'loc')):
        for key, attr in (('name', 'data-name'), ('address', 'data-addr'), ('note', 'data-note'), ('mapQuery', 'data-q')):
            sp = attr_span(src, d, attr)
            loc[key] = src[slice(*sp)]
    # ---- staff
    team_div = next(n for n in allnodes if n.tag == 'div' and 'team' in n.classes)
    team = []
    order = 0
    for tm in kids(team_div, 'div', 'tm'):
        order += 1
        meta = find(tm, lambda c: 'meta' in c.classes)
        name = inner(src, kids(meta, 'b')[0])
        role = inner(src, kids(meta, 'span')[0])
        pic = find(tm, lambda c: c.tag == 'picture')
        row = {'kind': 'staff', 'key': re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-'), 'name': name, 'role': role, 'order': order, 'hidden': False}
        if pic:
            img = find(pic, lambda c: c.tag == 'img')
            srcset = find(pic, lambda c: c.tag == 'source').attrs['srcset']
            row.update({'photoPath': img.attrs['src'], 'photoWebp': srcset, 'width': int(img.attrs['width']), 'height': int(img.attrs['height'])})
            if 'top' in pic.classes:
                row['photoTop'] = True
        team.append(row)
    # ---- surgeons
    surgeons = []
    for art in [n for n in allnodes if n.tag == 'article' and 'bio' in n.classes]:
        head = find(art, lambda c: 'bio-head' in c.classes)
        img = find(head, lambda c: c.tag == 'img')
        txt = [c for c in kids(head, 'div') if 'bio-photo' not in c.classes][0]
        tags = find(txt, lambda c: 'tags' in c.classes)
        facts = find(txt, lambda c: 'facts' in c.classes)
        cols = find(art, lambda c: 'bio-cols' in c.classes)
        det = kids(art, 'details')[0]
        columns = []
        for col in kids(cols, 'div'):
            h3 = kids(col, 'h3')[0]
            ul = kids(col, 'ul')
            p = kids(col, 'p')
            columns.append({'heading': inner(src, h3), 'items': [inner(src, li) for li in kids(ul[0], 'li')] if ul else [], 'paragraph': inner(src, p[0]) if p else ''})
        name = inner(src, kids(txt, 'h2')[0])
        surgeons.append({
            'kind': 'surgeon',
            'key': art.attrs['id'],
            'name': name,
            'roleLine': inner(src, find(txt, lambda c: 'role' in c.classes)),
            'lede': inner(src, find(txt, lambda c: 'lede' in c.classes)),
            'tags': [inner(src, s) for s in kids(tags, 'span')],
            'facts': [{'title': inner(src, kids(f, 'b')[0]), 'text': inner(src, kids(f, 'span')[0])} for f in kids(facts, 'div')],
            'columns': columns,
            'storyLabel': inner(src, kids(det, 'summary')[0]),
            'story': [inner(src, p) for p in kids(kids(det, 'div')[0], 'p')],
            'photoPath': img.attrs['src'],
            'photoAlt': img.attrs['alt'],
            'hidden': False,
        })
    for i, s in enumerate(surgeons):
        s['order'] = i + 1
    out = {'surgeons': surgeons, 'staff': team}
    with open(os.path.join(ROOT, 'content', 'team.json'), 'w', encoding='utf-8') as fh:
        json.dump(out, fh, indent=2, ensure_ascii=False)
        fh.write('\n')
    return locations


if __name__ == '__main__' and '--data' in sys.argv:
    print(json.dumps(extract_data(), indent=1)[:1500])
