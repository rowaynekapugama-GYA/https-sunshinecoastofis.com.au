#!/usr/bin/env bash
# Lighthouse on the five pages the brief names, mobile and desktop.
#   bash _tools/tests/lighthouse.sh http://localhost:3000
# Run the build with EXTRA_LIVE_HOSTS=localhost so the local copy is treated like the live
# site (no "noindex" header), otherwise the SEO score reads low for that reason alone.
BASE=${1:-http://localhost:3000}
OUT=audit/lighthouse
mkdir -p $OUT
for p in "/:home" "/services/dental-implants/:service" "/locations/:locations" "/blog/:blog" "/contact-us/:contact"; do
  u=${p%%:*}; n=${p##*:}
  for f in mobile desktop; do
    extra=""; [ $f = desktop ] && extra="--preset=desktop"
    timeout 180 lighthouse "$BASE$u" $extra --chrome-flags="--headless=new --no-sandbox --no-proxy-server" \
      --output=json --output=html --output-path=$OUT/$n-$f --quiet >/dev/null 2>&1
  done
done
python3 - <<'PY'
import json, glob, os
rows = []
for f in sorted(glob.glob('audit/lighthouse/*.report.json')):
    d = json.load(open(f)); c = d['categories']; a = d['audits']
    name = os.path.basename(f).replace('.report.json', '')
    rows.append({'run': name, **{k: round((c[k]['score'] or 0) * 100) for k in ('performance', 'accessibility', 'best-practices', 'seo')},
                 'FCP': a['first-contentful-paint']['displayValue'], 'LCP': a['largest-contentful-paint']['displayValue'],
                 'TBT': a['total-blocking-time']['displayValue'], 'CLS': a['cumulative-layout-shift']['displayValue'],
                 'SI': a['speed-index']['displayValue']})
json.dump(rows, open('audit/lighthouse/summary.json', 'w'), indent=1)
for r in rows: print(r)
PY
