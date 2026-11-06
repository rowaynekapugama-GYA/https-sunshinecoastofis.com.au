#!/usr/bin/env bash
# Sunshine Coast OFIS website: add Rowayne's Google Ads landing pages under /lp, with discreet
# footer links (v3.6.0), and deploy. The ZIP is the whole website, so it also carries the SmileOX
# CRM change (v3.5.0) if that hasn't been deployed yet.
#
#   bash update-and-deploy.sh
#
# Edit the two paths just below first.
set -euo pipefail

# ============================ EDIT THESE TWO LINES ============================
ZIP_PATH="$HOME/Downloads/sunshine-coast-ofis-landing-pages.zip"    # the update ZIP
REPO_PATH="$HOME/code/https-sunshinecoastofis.com.au"              # your clone of rowaynekapugama-GYA/https-sunshinecoastofis.com.au
# ==============================================================================

COMMIT_MESSAGE="feat: add Google Ads landing pages under /lp with discreet footer links"
BACKUP_BRANCH="backup/pre-landing-pages-$(date +%Y%m%d)"
LIVE_URL="https://sunshinecoastofis.com.au"
LP_URLS=("$LIVE_URL/lp/dental-implants" "$LIVE_URL/lp/wisdom-teeth")

stop() { echo; echo "STOPPED: $*" >&2; exit 1; }
step() { echo; echo "==> $*"; }
yes_no() { local a; read -r -p "$1 (y/n) " a; [ "$a" = "y" ] || [ "$a" = "Y" ]; }

# Step 1. Check the tools are installed, the ZIP exists, and the repo has no uncommitted changes.
step "1. Checking git, node, npm, the Vercel CLI, the ZIP and the repo"
command -v git >/dev/null 2>&1 || stop "git is not installed (https://git-scm.com)."
command -v node >/dev/null 2>&1 || stop "Node.js is not installed. Install Node.js 20 or later (https://nodejs.org)."
command -v npm >/dev/null 2>&1 || stop "npm is not installed (it comes with Node.js)."
command -v rsync >/dev/null 2>&1 || stop "rsync is not installed."
command -v unzip >/dev/null 2>&1 || stop "unzip is not installed."
command -v vercel >/dev/null 2>&1 || stop "the Vercel CLI is not installed. Install it with: npm i -g vercel   then run: vercel login"
[ -f "$ZIP_PATH" ] || stop "ZIP not found at $ZIP_PATH. Check ZIP_PATH at the top of this script."
[ -d "$REPO_PATH/.git" ] || stop "$REPO_PATH is not a git repository. Check REPO_PATH at the top of this script, or clone it first:
   git clone https://github.com/rowaynekapugama-GYA/https-sunshinecoastofis.com.au.git \"$REPO_PATH\""
ZIP_PATH="$(cd "$(dirname "$ZIP_PATH")" && pwd)/$(basename "$ZIP_PATH")"
cd "$REPO_PATH"
[ -z "$(git status --porcelain)" ] || { git status --short; stop "the repo has uncommitted changes. Commit or stash them first."; }
vercel whoami >/dev/null 2>&1 || stop "the Vercel CLI is not signed in. Run: vercel login"
echo "node $(node -v), npm $(npm -v), vercel $(vercel --version 2>/dev/null | tail -1), signed in as $(vercel whoami 2>/dev/null | tail -1)"

# Step 2. Get the latest main from GitHub.
step "2. Pulling the latest main"
git checkout -q main
git pull --ff-only origin main || stop "could not pull main (see above)."
BEFORE="$(git rev-parse HEAD)"
echo "main is at ${BEFORE:0:7}"

# Step 3. Backup branch of main as it is now, before anything changes.
step "3. Creating the backup branch"
if git show-ref --quiet "refs/heads/$BACKUP_BRANCH"; then BACKUP_BRANCH="$BACKUP_BRANCH-$(date +%H%M%S)"; fi
git branch "$BACKUP_BRANCH" "$BEFORE"
echo "created $BACKUP_BRANCH at ${BEFORE:0:7}"

# Step 4. Unzip to a temporary folder and copy it over the repo.
# --delete removes files the update no longer has. .git, node_modules, .vercel, .next and your
# .env files are never touched (only .env.example, which has no secrets, is updated), and the
# local-only folders from .gitignore (uploads, build output, test output) are left alone.
step "4. Unzipping the update into the repo"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
unzip -q "$ZIP_PATH" -d "$TMP/u"
SRC="$TMP/u"
if [ "$(find "$SRC" -mindepth 1 -maxdepth 1 | wc -l | tr -d ' ')" = "1" ] && [ -d "$(find "$SRC" -mindepth 1 -maxdepth 1)" ]; then SRC="$(find "$SRC" -mindepth 1 -maxdepth 1)"; fi
[ -f "$SRC/package.json" ] || stop "the ZIP does not contain the website (no package.json)."
rsync -a --delete \
  --exclude='/.git' --exclude='/node_modules' --exclude='/.vercel' --exclude='/.next' \
  --include='/.env.example' --exclude='.env*' \
  --exclude='/out' --exclude='/media' --exclude='/audit/tmp' --exclude='/test-results' \
  --exclude='*.log' --exclude='tsconfig.tsbuildinfo' --exclude='__pycache__' --exclude='*.pyc' --exclude='.DS_Store' \
  "$SRC"/ ./
git status --short | sed 's/^/   /'

# Step 5. Install packages and build. Stop here if anything fails: nothing has been pushed yet.
# The build is only a check (Vercel does the real build with its own settings), so it runs
# without the database and with a throwaway PAYLOAD_SECRET if you don't have a .env.local.
step "5. npm install and npm run build"
npm install || stop "npm install failed. Nothing was pushed. Undo with: git checkout -- . && git clean -fd"
if node -e 'process.exit(require("./package.json").scripts?.build ? 0 : 1)'; then
  env -u DATABASE_URL PAYLOAD_SECRET="${PAYLOAD_SECRET:-local-build-check-only}" npm run build || stop "the build failed. Nothing was pushed. Undo with: git checkout -- . && git clean -fd"
else
  echo "   no build script in package.json, build skipped"
fi

# Step 6. Environment variables, BEFORE pushing so the first deploy already has them.
# One set serves the site's forms and the landing pages. Only variables that aren't set yet are asked for.
step "6. Vercel environment variables (production and preview)"
if [ ! -f .vercel/project.json ]; then
  echo "This folder isn't linked to the Vercel project yet. Choose the existing project 'https-sunshinecoastofis-com-au'."
  vercel link || stop "vercel link failed."
fi
PROD_VARS="$(vercel env ls production 2>/dev/null || true)"
PREVIEW_VARS="$(vercel env ls preview 2>/dev/null || true)"
echo "Current production variables:"
printf '%s\n' "$PROD_VARS" | sed 's/^/   /'
has_var() { printf '%s\n' "$2" | awk '{print $1}' | grep -qx "$1"; }
is_set() { has_var "$1" "$PROD_VARS"; }
add_var() { # name value
  local name="$1" value="$2" target list
  for target in production preview; do
    if [ "$target" = production ]; then list="$PROD_VARS"; else list="$PREVIEW_VARS"; fi
    if has_var "$name" "$list"; then echo "   $name ($target): already set, skipped"; continue; fi
    if printf '%s' "$value" | vercel env add "$name" "$target" >/dev/null 2>&1; then echo "   $name ($target): added"
    else echo "   $name ($target): COULD NOT ADD. Add it in Vercel > Settings > Environment Variables."; fi
  done
}
echo
echo "The landing page forms send leads through the site's existing SMTP2GO account unless SMTP settings are set."
SMTP_ON=""
if is_set SMTP_HOST; then
  echo "   SMTP_HOST: already set"; SMTP_ON=1
else
  echo "Press Enter at SMTP_HOST to keep using SMTP2GO and skip the SMTP questions."
  read -r -p "SMTP_HOST (e.g. mail.smtp2go.com): " SMTP_HOST_IN
  if [ -n "$SMTP_HOST_IN" ]; then add_var SMTP_HOST "$SMTP_HOST_IN"; SMTP_ON=1
  else echo "   SMTP settings skipped: leads go through SMTP2GO (SMTP2GO_API_KEY)."; fi
fi
if [ -n "$SMTP_ON" ]; then
  if is_set SMTP_PORT; then echo "   SMTP_PORT: already set"; else read -r -p "SMTP_PORT [465]: " V; add_var SMTP_PORT "${V:-465}"; fi
  if is_set SMTP_USER; then echo "   SMTP_USER: already set"; else
    read -r -p "SMTP_USER: " V; [ -n "$V" ] || stop "SMTP_USER is needed when SMTP_HOST is set. Nothing was pushed."; add_var SMTP_USER "$V"; fi
  if is_set SMTP_PASS; then echo "   SMTP_PASS: already set"; else
    read -r -s -p "SMTP_PASS (hidden): " V; echo; [ -n "$V" ] || stop "SMTP_PASS is needed when SMTP_HOST is set. Nothing was pushed."; add_var SMTP_PASS "$V"; V=""; fi
  if is_set MAIL_FROM || is_set SMTP_FROM; then echo "   MAIL_FROM/SMTP_FROM: already set"; else
    read -r -p "MAIL_FROM [no-reply@sunshinecoastofis.com.au] (must be on a domain verified with the SMTP provider): " V
    add_var MAIL_FROM "${V:-no-reply@sunshinecoastofis.com.au}"; fi
fi
if is_set NOTIFY_TO; then echo "   NOTIFY_TO: already set"; else
  read -r -p "Optional NOTIFY_TO, an address for a plain-English copy of each landing page enquiry (Enter to skip): " V
  if [ -n "$V" ]; then add_var NOTIFY_TO "$V"; else echo "   NOTIFY_TO skipped"; fi
fi

# Step 7. Commit and push to main.
step "7. Commit and push"
git add -A
git status --short
git diff --cached --stat | tail -15
yes_no "Commit and push these changes to main?" || { echo "Stopped. Nothing pushed. Undo with: git reset -q --hard $BEFORE && git clean -fd"; exit 1; }
git commit -q -m "$COMMIT_MESSAGE"
AFTER="$(git rev-parse HEAD)"
git push origin main || stop "the push failed (see above). The commit is saved locally; run 'git push origin main' when ready."
echo "pushed ${AFTER:0:7} to main"

# Step 8. Deploy: Vercel's Git integration deploys the push; otherwise deploy with the CLI.
step "8. Deploy"
DEPLOY_URL=""
if yes_no "Is this repo connected to Vercel's Git integration?"; then
  echo "The push to main starts the production deployment (no CLI deploy, so it doesn't deploy twice)."
  echo "Follow it at: https://vercel.com/dashboard (project https-sunshinecoastofis-com-au > Deployments)"
else
  DEPLOY_URL="$(vercel --prod --yes 2>/dev/null | tail -1)" || stop "vercel --prod failed. The code is pushed; deploy from the Vercel dashboard."
fi

echo
echo "Done."
[ -n "$DEPLOY_URL" ] && echo "Deployment: $DEPLOY_URL"
echo "Live site:  $LIVE_URL (a few minutes after the deployment shows Ready)"
echo
echo "Landing pages (Google Ads final URLs):"
for u in "${LP_URLS[@]}"; do echo "  $u"; done
echo
echo "Rollback (makes a new commit that undoes this update; Vercel redeploys):"
echo "  cd \"$REPO_PATH\" && git checkout main && git pull && git revert --no-edit $AFTER && git push origin main"
echo "Old version kept on branch: $BACKUP_BRANCH"
