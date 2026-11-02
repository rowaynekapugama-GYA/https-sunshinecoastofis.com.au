#!/usr/bin/env bash
# Apply a GYA update ZIP to the SCOFIS repo and push it to main (Vercel then deploys).
#
#   bash scripts/deploy-update.sh <repo-path> <zip-path> [--prod]
#
#   <repo-path>  your clone of rowaynekapugama-GYA/https-sunshinecoastofis.com.au
#   <zip-path>   for example scofis-v3.2.0-seo-compliance.zip
#   --prod       also run `vercel --prod` after the push (needs the Vercel CLI, linked to the project)
#
# What it does, stopping at the first problem:
#   1. checks the repo has no uncommitted changes, switches to main and pulls
#   2. makes a backup branch of main as it was (backup/pre-update-<date-time>)
#   3. unzips the update over the repo, keeping .git, .env* and .vercel; files the update
#      no longer has are removed only if git tracks them
#   4. npm install, then npm run build (built from the files, without touching the database:
#      the dashboard content migration runs once, in the Vercel build)
#   5. shows git status and the diffstat and asks you to confirm
#   6. commits, pushes to main, and prints the rollback command
set -euo pipefail

MESSAGE="SEO & compliance fixes: H1 location keywords, Hervey Bay/Gympie pages, blog images, AHPRA wording, privacy/disclaimer"

die() { echo "ERROR: $*" >&2; exit 1; }
step() { echo; echo "==> $*"; }

[ $# -ge 2 ] || die "usage: bash $0 <repo-path> <zip-path> [--prod]"
REPO="$1"; ZIP="$2"; PROD="${3:-}"
[ -d "$REPO/.git" ] || die "$REPO is not a git repository"
[ -f "$ZIP" ] || die "ZIP not found: $ZIP"
ZIP="$(cd "$(dirname "$ZIP")" && pwd)/$(basename "$ZIP")"
for c in git unzip npm rsync; do command -v "$c" >/dev/null || die "$c is not installed"; done
cd "$REPO"

step "1. Checking the repo is clean"
[ -z "$(git status --porcelain)" ] || { git status --short; die "uncommitted changes in $REPO; commit or stash them first"; }
git checkout -q main
git pull --ff-only origin main
BEFORE="$(git rev-parse HEAD)"
echo "main is at ${BEFORE:0:7}"

step "2. Backup branch"
BACKUP="backup/pre-update-$(date +%Y%m%d-%H%M%S)"
git branch "$BACKUP" "$BEFORE"
echo "created $BACKUP (local) at ${BEFORE:0:7}"

step "3. Unzipping the update"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
unzip -q "$ZIP" -d "$TMP/u"
SRC="$TMP/u"
# A ZIP with a single top folder: use that folder.
if [ "$(find "$SRC" -mindepth 1 -maxdepth 1 | wc -l)" -eq 1 ] && [ -d "$(find "$SRC" -mindepth 1 -maxdepth 1)" ]; then SRC="$(find "$SRC" -mindepth 1 -maxdepth 1)"; fi
[ -f "$SRC/package.json" ] || die "the ZIP does not contain the site (no package.json)"
rsync -a --exclude='.git' --exclude='.env*' --exclude='.vercel' --exclude='node_modules' --exclude='.next' "$SRC"/ ./
# Tracked files that are not in the update were removed in it.
REMOVED=0
while IFS= read -r f; do
  case "$f" in .env*|.vercel/*) continue ;; esac
  if [ ! -e "$SRC/$f" ]; then git rm -q -- "$f"; REMOVED=$((REMOVED + 1)); fi
done < <(git ls-files)
echo "copied; $REMOVED tracked files removed"

step "4. npm install and build"
npm install || die "npm install failed. Nothing committed. Undo with: git checkout -- . && git clean -fd"
env -u DATABASE_URL npm run build || die "build failed. Nothing committed. Undo with: git checkout -- . && git clean -fd"

step "5. Review"
git add -A
git status --short
echo
git diff --cached --stat | tail -40
echo
read -r -p "Commit and push these changes to main? Type yes to continue: " OK
[ "$OK" = "yes" ] || { echo "Stopped. Nothing pushed. Undo with: git reset -q --hard $BEFORE && git clean -fd"; exit 1; }

step "6. Commit and push"
git commit -q -m "$MESSAGE"
AFTER="$(git rev-parse HEAD)"
git push origin main
echo "pushed ${AFTER:0:7} to main; Vercel builds it automatically."

if [ "$PROD" = "--prod" ]; then
  step "vercel --prod"
  command -v vercel >/dev/null || die "Vercel CLI not installed (npm i -g vercel); the push above already triggers a deployment"
  vercel --prod
fi

echo
echo "Rollback (makes a new commit that undoes this update, then Vercel redeploys):"
echo "  cd \"$REPO\" && git checkout main && git pull && git revert --no-edit ${AFTER} && git push origin main"
echo "Backup of main before the update: branch $BACKUP (${BEFORE:0:7})"
echo "Note: rollback restores the files. Wording already updated in the dashboard by this update stays until edited back there."
