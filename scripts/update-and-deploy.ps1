# Update the Sunshine Coast OFIS website repo from a ZIP and deploy it (Windows PowerShell).
#
#   powershell -ExecutionPolicy Bypass -File update-and-deploy.ps1
#
# Edit the two paths just below first.

# ============================ EDIT THESE TWO LINES ============================
$RepoDir = "C:\code\https-sunshinecoastofis.com.au"                                       # your clone of rowaynekapugama-GYA/https-sunshinecoastofis.com.au
$ZipPath = "$env:USERPROFILE\Downloads\sunshinecoastofis-gtm-install-2026-11-05.zip"          # the update ZIP
# ==============================================================================

$CommitMessage = 'Add Google Tag Manager (GTM-TZ7DJSC2) site-wide'
$BackupBranch = 'backup-before-gtm-' + (Get-Date -Format 'yyyyMMdd')

$ErrorActionPreference = 'Stop'
function Stop-Script($m) { Write-Host ""; Write-Host "STOPPED: $m" -ForegroundColor Red; exit 1 }
function Step($m) { Write-Host ""; Write-Host "==> $m" -ForegroundColor Cyan }
function Invoke-Git { & git @args; if ($LASTEXITCODE -ne 0) { Stop-Script "git $($args -join ' ') failed (see above)." } }

# Step 1. Check git is installed, the folder is a git repo, and the ZIP exists.
Step '1. Checking git, the repo folder and the ZIP'
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Stop-Script 'git is not installed. Install it from https://git-scm.com and run this again.' }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { Stop-Script 'npm (Node.js) is not installed. Install Node.js 20 or later and run this again.' }
if (-not (Test-Path (Join-Path $RepoDir '.git'))) { Stop-Script "$RepoDir is not a git repository. Check `$RepoDir at the top of this script." }
if (-not (Test-Path $ZipPath)) { Stop-Script "ZIP not found at $ZipPath. Check `$ZipPath at the top of this script." }
$ZipPath = (Resolve-Path $ZipPath).Path
Set-Location $RepoDir
if (git status --porcelain) { git status --short; Stop-Script 'the repo has uncommitted changes. Commit or stash them first, so nothing of yours is overwritten.' }

# Step 2. Switch to main and pull the latest from GitHub.
Step '2. Pulling the latest main from GitHub'
Invoke-Git checkout -q main
Invoke-Git pull --ff-only origin main
$Before = (git rev-parse HEAD).Trim()
Write-Host "main is at $($Before.Substring(0,7))"

# Step 3. Make a backup branch of main as it is now, before anything is overwritten.
Step '3. Creating the backup branch'
git show-ref --quiet "refs/heads/$BackupBranch"
if ($LASTEXITCODE -eq 0) { $BackupBranch = "$BackupBranch-" + (Get-Date -Format 'HHmmss') }
Invoke-Git branch $BackupBranch $Before
Write-Host "created $BackupBranch at $($Before.Substring(0,7))"

# Step 4. Unzip the new build over the repo. .git, .env*, .vercel and node_modules are never touched.
Step '4. Unzipping the update over the repo'
$Tmp = Join-Path ([IO.Path]::GetTempPath()) ('scofis-' + [guid]::NewGuid())
try {
  Expand-Archive -Path $ZipPath -DestinationPath $Tmp -Force
  $Src = $Tmp
  $top = @(Get-ChildItem -Force $Src)
  if ($top.Count -eq 1 -and $top[0].PSIsContainer) { $Src = $top[0].FullName }
  if (-not (Test-Path (Join-Path $Src 'package.json'))) { Stop-Script 'the ZIP does not contain the website (no package.json found).' }
  $skip = '^(\.git|\.vercel|node_modules)([\\/]|$)|^\.env'
  Get-ChildItem -Recurse -Force -File $Src | ForEach-Object {
    $rel = $_.FullName.Substring($Src.Length).TrimStart('\', '/')
    if ($rel -notmatch $skip) {
      $dest = Join-Path $RepoDir $rel
      New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
      Copy-Item -Force $_.FullName $dest
    }
  }
  # Files git tracks that are not in the update were removed in it; remove them here too.
  foreach ($f in (git ls-files)) {
    if ($f -match '^\.env' -or $f -match '^\.vercel/') { continue }
    if (-not (Test-Path (Join-Path $Src $f))) { Invoke-Git rm -q -- $f }
  }
} finally {
  Remove-Item -Recurse -Force $Tmp -ErrorAction SilentlyContinue
}
Write-Host 'done'

# Step 5. Install packages and build. Stop here, before anything is pushed, if either fails.
# The local build uses the files only (no database), so nothing changes on the live dashboard from your computer.
# It is only a check: Vercel does the real build with its own settings. A fresh copy of the repo has no .env.local,
# so a throwaway PAYLOAD_SECRET is supplied for this check when none is set.
Step '5. npm install and npm run build'
npm install
if ($LASTEXITCODE -ne 0) { Stop-Script 'npm install failed. Nothing was committed or pushed. Undo the copied files with: git checkout -- . ; git clean -fd' }
$savedDb = $env:DATABASE_URL
$savedSecret = $env:PAYLOAD_SECRET
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
if (-not $env:PAYLOAD_SECRET) { $env:PAYLOAD_SECRET = 'local-build-check-only' }
npm run build
$buildExit = $LASTEXITCODE
if ($savedDb) { $env:DATABASE_URL = $savedDb }
if ($savedSecret) { $env:PAYLOAD_SECRET = $savedSecret } else { Remove-Item Env:PAYLOAD_SECRET -ErrorAction SilentlyContinue }
if ($buildExit -ne 0) { Stop-Script 'the build failed. Nothing was committed or pushed. Undo the copied files with: git checkout -- . ; git clean -fd' }

# Step 6. Show what changed, then commit.
Step '6. Changes'
Invoke-Git add -A
git status --short
git diff --cached --stat | Select-Object -Last 25
Write-Host ''
$answer = Read-Host 'Commit and push these changes to main? (y/n)'
if ($answer -notmatch '^[yY]$') { Write-Host "Stopped. Nothing pushed. Undo with: git reset -q --hard $Before ; git clean -fd"; exit 1 }
Invoke-Git commit -q -m $CommitMessage
$After = (git rev-parse HEAD).Trim()

# Step 7. Push to main. Vercel deploys automatically because the project is connected to GitHub.
Step '7. Pushing to main'
git push origin main
if ($LASTEXITCODE -ne 0) { Stop-Script "the push failed (see above). The commit is saved locally; run 'git push origin main' when ready." }
Write-Host "pushed $($After.Substring(0,7)) to main. Vercel will build and deploy it in a few minutes."

# Step 8. Optional fallback: deploy with the Vercel CLI if it is installed.
if (Get-Command vercel -ErrorAction SilentlyContinue) {
  $v = Read-Host "Also run 'vercel --prod' now? Only needed if the automatic deploy does not start. (y/n)"
  if ($v -match '^[yY]$') { vercel --prod }
}

# Step 9. How to undo this update.
Write-Host ''
Write-Host 'To roll back (makes a new commit that undoes this update; Vercel redeploys):'
Write-Host "  cd `"$RepoDir`"; git checkout main; git pull; git revert --no-edit $After; git push origin main"
Write-Host "Or look at the old version on the backup branch: git checkout $BackupBranch"
