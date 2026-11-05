#!/usr/bin/env bash
# Update the Sunshine Coast OFIS website repo from a ZIP and deploy it (macOS / Linux).
#
#   bash update-and-deploy.sh
#
# Edit the two paths just below first.

# ============================ EDIT THESE TWO LINES ============================
REPO_DIR="$HOME/code/https-sunshinecoastofis.com.au"                        # your clone of rowaynekapugama-GYA/https-sunshinecoastofis.com.au
ZIP_PATH="$HOME/Downloads/sunshinecoastofis-gtm-install-2026-11-05.zip"         # the update ZIP
# ==============================================================================

COMMIT_MESSAGE="Add Google Tag Manager (GTM-TZ7DJSC2) site-wide"
BACKUP_BRANCH="backup-before-gtm-$(date +%Y%m%d)"

set -euo pipefail
stop() { echo; echo "STOPPED: $*" >&2; exit 1; }
step() { echo; echo "==> $*"; }

# Step 1. Check git is installed, the folder is a git repo, and the ZIP exists.
step "1. Checking git, the repo folder and the ZIP"
command -v git >/dev/null 2>&1 || stop "git is not installed. Install it from https://git-scm.com and run this again."
command -v npm >/dev/null 2>&1 || stop "npm (Node.js) is not installed. Install Node.js 20 or later and run this again."
command -v unzip >/dev/null 2>&1 || stop "unzip is not installed."
[ -d "$REPO_DIR/.git" ] || stop "$REPO_DIR is not a git repository. Check REPO_DIR at the top of this script."
[ -f "$ZIP_PATH" ] || stop "ZIP not found at $ZIP_PATH. Check ZIP_PATH at the top of this script."
ZIP_PATH="$(cd "$(dirname "$ZIP_PATH")" && pwd)/$(basename "$ZIP_PATH")"
cd "$REPO_DIR"
[ -z "$(git status --porcelain)" ] || { git status --short; stop "the repo has uncommitted changes. Commit or stash them first, so nothing of yours is overwritten."; }

# Step 2. Switch to main and pull the latest from GitHub.
step "2. Pulling the latest main from GitHub"
git checkout -q main
git pull --ff-only origin main || stop "could not pull main (see the message above)."
BEFORE="$(git rev-parse HEAD)"
echo "main is at ${BEFORE:0:7}"

# Step 3. Make a backup branch of main as it is now, before anything is overwritten.
step "3. Creating the backup branch"
if git show-ref --quiet "refs/heads/$BACKUP_BRANCH"; then BACKUP_BRANCH="$BACKUP_BRANCH-$(date +%H%M%S)"; fi
git branch "$BACKUP_BRANCH" "$BEFORE"
echo "created $BACKUP_BRANCH at ${BEFORE:0:7}"

# Step 4. Unzip the new build over the repo. .git, .env*, .vercel and node_modules are never touched.
step "4. Unzipping the update over the repo"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
unzip -q "$ZIP_PATH" -d "$TMP/u"
SRC="$TMP/u"
# If the ZIP holds a single top folder, use that folder.
if [ "$(find "$SRC" -mindepth 1 -maxdepth 1 | wc -l | tr -d ' ')" = "1" ] && [ -d "$(find "$SRC" -mindepth 1 -maxdepth 1)" ]; then SRC="$(find "$SRC" -mindepth 1 -maxdepth 1)"; fi
[ -f "$SRC/package.json" ] || stop "the ZIP does not contain the website (no package.json found)."
( cd "$SRC" && find . -type f ) | while IFS= read -r f; do
  f="${f#./}"
  case "$f" in .git|.git/*|.env*|.vercel|.vercel/*|node_modules|node_modules/*) continue ;; esac
  mkdir -p "$(dirname "$f")"
  cp -p "$SRC/$f" "$f"
done
# Files git tracks that are not in the update were removed in it; remove them here too.
git ls-files | while IFS= read -r f; do
  case "$f" in .env*|.vercel/*) continue ;; esac
  [ -e "$SRC/$f" ] || git rm -q -- "$f"
done
echo "done"

# Step 5. Install packages and build. Stop here, before anything is pushed, if either fails.
# The local build uses the files only (no database), so nothing changes on the live dashboard from your computer.
# It is only a check: Vercel does the real build with its own settings. A fresh copy of the repo has no .env.local,
# so a throwaway PAYLOAD_SECRET is supplied for this check when none is set.
step "5. npm install and npm run build"
npm install || stop "npm install failed. Nothing was committed or pushed. Undo the copied files with: git checkout -- . && git clean -fd"
env -u DATABASE_URL PAYLOAD_SECRET="${PAYLOAD_SECRET:-local-build-check-only}" npm run build || stop "the build failed. Nothing was committed or pushed. Undo the copied files with: git checkout -- . && git clean -fd"

# Step 6. Show what changed, then commit.
step "6. Changes"
git add -A
git status --short
git diff --cached --stat | tail -25
echo
read -r -p "Commit and push these changes to main? (y/n) " ANSWER
[ "$ANSWER" = "y" ] || [ "$ANSWER" = "Y" ] || { echo "Stopped. Nothing pushed. Undo with: git reset -q --hard $BEFORE && git clean -fd"; exit 1; }
git commit -q -m "$COMMIT_MESSAGE"
AFTER="$(git rev-parse HEAD)"

# Step 7. Push to main. Vercel deploys automatically because the project is connected to GitHub.
step "7. Pushing to main"
git push origin main || stop "the push failed (see above). The commit is saved locally; run 'git push origin main' when ready."
echo "pushed ${AFTER:0:7} to main. Vercel will build and deploy it in a few minutes."

# Step 8. Optional fallback: deploy with the Vercel CLI if it is installed.
if command -v vercel >/dev/null 2>&1; then
  read -r -p "Also run 'vercel --prod' now? Only needed if the automatic deploy does not start. (y/n) " V
  if [ "$V" = "y" ] || [ "$V" = "Y" ]; then vercel --prod; fi
fi

# Step 9. How to undo this update.
echo
echo "To roll back (makes a new commit that undoes this update; Vercel redeploys):"
echo "  cd \"$REPO_DIR\" && git checkout main && git pull && git revert --no-edit $AFTER && git push origin main"
echo "Or look at the old version on the backup branch: git checkout $BACKUP_BRANCH"
