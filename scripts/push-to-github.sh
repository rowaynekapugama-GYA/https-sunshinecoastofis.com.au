#!/usr/bin/env bash
#
# Sunshine Coast OFIS: push a new version to GitHub safely, from Terminal.
#
#   bash push-to-github.sh stage <zip or folder>   Put the new version on the `cms` branch.
#                                                  Vercel builds a PREVIEW. The live site is untouched.
#   bash push-to-github.sh promote                 Make the live site (`main`) exactly the `cms` branch.
#   bash push-to-github.sh rollback                Put `main` back to what it was before the last promote.
#   bash push-to-github.sh status                  Show what is on `main` and `cms` right now.
#
# It always works in a fresh copy of the repo in ~/gya-deploy, never in your Downloads folder, and it
# shows you what will change and asks before it pushes anything. `main` is only ever fast-forwarded to
# a commit Vercel has already built as a preview, so a push can never leave the live site half-updated.
#
# First run asks for the repo address (GitHub > the repo > green Code button > HTTPS) and remembers it.
# Works with macOS's built-in bash and git. Sign in to GitHub once with `gh auth login` (or GitHub
# Desktop) so git can push.

set -euo pipefail

PROJECT="sunshine-coast-ofis"
STAGE_BRANCH="cms"
LIVE_BRANCH="main"
HOME_DIR="${HOME}/gya-deploy"
WORK="${HOME_DIR}/scofis-work"
CONF="${HOME_DIR}/scofis-repo-url.txt"
LAST_MAIN="${HOME_DIR}/scofis-main-before-promote.txt"

red() { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
bold() { printf '\033[1m%s\033[0m\n' "$*"; }
die() {
  red "Stopped: $*"
  exit 1
}
confirm() {
  # confirm "question" "word the user must type"
  local answer
  printf '%s ' "$1"
  read -r answer
  [ "$answer" = "$2" ] || die "nothing was pushed (you typed '${answer}', not '${2}')."
}

command -v git >/dev/null 2>&1 || die "git is not installed. Run: xcode-select --install"
mkdir -p "$HOME_DIR"

repo_url() {
  if [ -s "$CONF" ]; then
    cat "$CONF"
    return
  fi
  printf 'GitHub repo address (green Code button > HTTPS, ends in .git): ' >&2
  local url
  read -r url
  case "$url" in
    https://github.com/*|git@github.com:*) ;;
    *) die "that does not look like a GitHub repo address." ;;
  esac
  printf '%s\n' "$url" >"$CONF"
  printf '%s' "$url"
}

fresh_clone() {
  local url
  url="$(repo_url)"
  rm -rf "$WORK"
  bold "Downloading a fresh copy of the repo…"
  git clone --quiet "$url" "$WORK" || die "could not clone ${url}. Check the address in ${CONF} and that you are signed in to GitHub (gh auth login)."
  cd "$WORK"
  git fetch --quiet origin
  git rev-parse --verify --quiet "origin/${LIVE_BRANCH}" >/dev/null || die "the repo has no ${LIVE_BRANCH} branch."
}

# ------------------------------------------------------------------ stage
stage() {
  local src_in="${1:-}"
  [ -n "$src_in" ] || die "tell me where the new version is, e.g. bash push-to-github.sh stage ~/Downloads/scofis-CMS-v3.0.0-FULL-REPO.zip"
  [ -e "$src_in" ] || die "${src_in} does not exist."

  # 1. Unpack the zip (or use the folder) and find the folder that holds package.json.
  local src pkg
  TMP_UNPACK="$(mktemp -d "${HOME_DIR}/unpack.XXXXXX")"
  trap 'rm -rf "${TMP_UNPACK:-}"' EXIT
  local tmp="$TMP_UNPACK"
  if [ -d "$src_in" ]; then
    cp -R "$src_in"/. "$tmp"/
  else
    command -v unzip >/dev/null 2>&1 || die "unzip is not installed."
    unzip -q "$src_in" -d "$tmp"
  fi
  # The shallowest package.json is the repo root. awk reads all its input (no broken pipe under
  # pipefail) and behaves the same on macOS and Linux.
  pkg="$(find "$tmp" -name package.json -not -path '*/node_modules/*' | awk '{ print length(), $0 }' | sort -n | awk 'NR == 1 { sub(/^[0-9]+ /, ""); print }')"
  [ -n "$pkg" ] || die "no package.json found in ${src_in}."
  src="$(dirname "$pkg")"
  grep -q "\"name\": \"${PROJECT}\"" "$src/package.json" || die "that is not the Sunshine Coast OFIS repo (package.json name is not ${PROJECT})."
  [ -f "$src/payload.config.ts" ] || die "that version has no payload.config.ts; wrong zip?"

  # Never publish build output, installed packages or secrets.
  rm -rf "$src/node_modules" "$src/.next" "$src/out" "$src/media" "$src/.git" "$src/.vercel"
  find "$src" -name '.DS_Store' -delete
  if [ -n "$(find "$src" -maxdepth 1 -name '.env*' ! -name '.env.example')" ]; then
    die "the new version contains a .env file (secrets). Delete it and run again."
  fi

  # 2. Fresh copy of the repo, staging branch = live branch + this version (one commit).
  fresh_clone
  git switch --quiet -C "$STAGE_BRANCH" "origin/${LIVE_BRANCH}"

  # 3. Replace every file with the new version (deleted files are really deleted).
  find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
  cp -R "$src"/. .
  git add -A

  if git diff --cached --quiet; then
    green "The new version is identical to what is live. Nothing to push."
    exit 0
  fi

  # 4. Show what changes and ask.
  echo
  bold "Compared with the live site (${LIVE_BRANCH}):"
  git diff --cached --shortstat
  local deleted
  deleted="$(git diff --cached --name-only --diff-filter=D)"
  if [ -n "$deleted" ]; then
    echo
    bold "These files will be REMOVED (they moved or are no longer used):"
    echo "$deleted" | sed 's/^/   - /'
  fi
  echo
  echo "This goes to the '${STAGE_BRANCH}' branch only. Vercel builds it as a preview; the live site does not change."
  confirm "Type yes to push to ${STAGE_BRANCH}:" "yes"

  local version
  version="$(sed -n 's/.*"version": "\([^"]*\)".*/\1/p' "package.json" | head -1)"
  git -c user.name="$(git config user.name || echo GYA)" -c user.email="$(git config user.email || echo rowayne@gyaclients.com)" \
    commit --quiet -m "Website v${version}: client dashboard at /admin" \
    -m "Staged with push-to-github.sh from $(basename "$src_in")." \
    -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BJ2o48trYwWvkZKYV5FCzd"

  # The staging branch is always rebuilt from main, so replacing it is safe.
  git push --quiet --force origin "HEAD:refs/heads/${STAGE_BRANCH}" || die "push was rejected. Check you are signed in to GitHub (gh auth login)."
  echo
  green "Pushed to ${STAGE_BRANCH}. Commit $(git rev-parse --short HEAD)."
  echo "Next: Vercel > Deployments shows a Preview building from '${STAGE_BRANCH}'. Open it when it says Ready."
  echo "When the preview checks out, run:  bash $(basename "$0") promote"
}

# ------------------------------------------------------------------ promote
promote() {
  fresh_clone
  git rev-parse --verify --quiet "origin/${STAGE_BRANCH}" >/dev/null || die "there is no ${STAGE_BRANCH} branch yet. Run stage first."
  local live staged
  live="$(git rev-parse "origin/${LIVE_BRANCH}")"
  staged="$(git rev-parse "origin/${STAGE_BRANCH}")"
  [ "$live" != "$staged" ] || die "the live site is already this version."
  if ! git merge-base --is-ancestor "$live" "$staged"; then
    die "someone changed ${LIVE_BRANCH} after this version was staged (e.g. a web upload). Run stage again so the preview includes it, check it, then promote."
  fi
  echo
  bold "The live site will change from:"
  git log -1 --format='   %h  %s  (%cr)' "$live"
  bold "to:"
  git log -1 --format='   %h  %s  (%cr)' "$staged"
  echo
  echo "Before you continue, make sure in Vercel (Settings > Environment Variables, Production):"
  echo "  DATABASE_URL, BLOB_READ_WRITE_TOKEN, PAYLOAD_SECRET, NEXT_PUBLIC_SERVER_URL and PUBLISH_HOOK_URL exist."
  echo "If one is missing the build fails and Vercel simply keeps the current site live."
  confirm "Type LIVE to update the live website:" "LIVE"
  printf '%s\n' "$live" >"$LAST_MAIN"
  # Fast-forward only: no force, so this can never overwrite anything on main.
  git push --quiet origin "${staged}:refs/heads/${LIVE_BRANCH}" || die "push was rejected; nothing changed."
  echo
  green "Done. Vercel is building the live site now (about 3 minutes)."
  echo "If anything looks wrong: Vercel > Deployments > the previous Production deployment > Instant Rollback,"
  echo "or run:  bash $(basename "$0") rollback"
}

# ------------------------------------------------------------------ rollback
rollback() {
  [ -s "$LAST_MAIN" ] || die "no earlier version recorded on this computer. Use Vercel > Deployments > Instant Rollback instead."
  local prev live
  prev="$(cat "$LAST_MAIN")"
  fresh_clone
  live="$(git rev-parse "origin/${LIVE_BRANCH}")"
  git cat-file -e "${prev}^{commit}" 2>/dev/null || die "the recorded version ${prev} is not in the repo."
  [ "$prev" != "$live" ] || die "the live site is already on that version."
  bold "The live site will go back to:"
  git log -1 --format='   %h  %s  (%cr)' "$prev"
  confirm "Type ROLLBACK to put it back:" "ROLLBACK"
  # Only succeeds if main is still what we think it is.
  git push --quiet --force-with-lease="${LIVE_BRANCH}:${live}" origin "${prev}:refs/heads/${LIVE_BRANCH}" || die "push was rejected; nothing changed."
  green "Rolled back. Vercel is rebuilding the previous version."
  echo "The dashboard database is left as it is; the older site simply does not use it."
}

# ------------------------------------------------------------------ status
status() {
  fresh_clone
  bold "Live (${LIVE_BRANCH}):"
  git log -1 --format='   %h  %s  (%cr)' "origin/${LIVE_BRANCH}"
  if git rev-parse --verify --quiet "origin/${STAGE_BRANCH}" >/dev/null; then
    bold "Staged (${STAGE_BRANCH}):"
    git log -1 --format='   %h  %s  (%cr)' "origin/${STAGE_BRANCH}"
    if [ "$(git rev-parse "origin/${LIVE_BRANCH}")" = "$(git rev-parse "origin/${STAGE_BRANCH}")" ]; then
      green "   The live site is this version."
    elif git merge-base --is-ancestor "origin/${LIVE_BRANCH}" "origin/${STAGE_BRANCH}"; then
      echo "   Ready to promote."
    else
      red "   main has moved since staging; run stage again before promoting."
    fi
  else
    echo "No ${STAGE_BRANCH} branch yet."
  fi
}

case "${1:-}" in
  stage) stage "${2:-}" ;;
  promote) promote ;;
  rollback) rollback ;;
  status) status ;;
  *)
    sed -n '3,11p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
