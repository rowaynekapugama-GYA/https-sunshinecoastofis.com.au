<#
Apply a GYA update ZIP to the SCOFIS repo and push it to main (Vercel then deploys).

  powershell -ExecutionPolicy Bypass -File scripts\deploy-update.ps1 -Repo C:\path\to\repo -Zip C:\path\to\scofis-v3.2.0-seo-compliance.zip [-Prod]

  -Repo  your clone of rowaynekapugama-GYA/https-sunshinecoastofis.com.au
  -Zip   the update ZIP
  -Prod  also run `vercel --prod` after the push (needs the Vercel CLI, linked to the project)

Steps, stopping at the first problem:
  1. checks the repo has no uncommitted changes, switches to main and pulls
  2. makes a backup branch of main as it was (backup/pre-update-<date-time>)
  3. unzips the update over the repo, keeping .git, .env* and .vercel; files the update
     no longer has are removed only if git tracks them
  4. npm install, then npm run build (built from the files, without touching the database:
     the dashboard content migration runs once, in the Vercel build)
  5. shows git status and the diffstat and asks you to confirm
  6. commits, pushes to main, and prints the rollback command
#>
param(
  [Parameter(Mandatory = $true)][string]$Repo,
  [Parameter(Mandatory = $true)][string]$Zip,
  [switch]$Prod
)
$ErrorActionPreference = 'Stop'
$Message = 'SEO & compliance fixes: H1 location keywords, Hervey Bay/Gympie pages, blog images, AHPRA wording, privacy/disclaimer'

function Die($m) { Write-Host "ERROR: $m" -ForegroundColor Red; exit 1 }
function Step($m) { Write-Host ""; Write-Host "==> $m" -ForegroundColor Cyan }
function Invoke-Git { & git @args; if ($LASTEXITCODE -ne 0) { Die "git $($args -join ' ') failed" } }

if (-not (Test-Path (Join-Path $Repo '.git'))) { Die "$Repo is not a git repository" }
if (-not (Test-Path $Zip)) { Die "ZIP not found: $Zip" }
$Zip = (Resolve-Path $Zip).Path
foreach ($c in 'git', 'npm') { if (-not (Get-Command $c -ErrorAction SilentlyContinue)) { Die "$c is not installed" } }
Set-Location $Repo

Step '1. Checking the repo is clean'
$dirty = git status --porcelain
if ($dirty) { git status --short; Die "uncommitted changes in $Repo; commit or stash them first" }
Invoke-Git checkout -q main
Invoke-Git pull --ff-only origin main
$Before = (git rev-parse HEAD).Trim()
Write-Host "main is at $($Before.Substring(0,7))"

Step '2. Backup branch'
$Backup = 'backup/pre-update-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
Invoke-Git branch $Backup $Before
Write-Host "created $Backup (local) at $($Before.Substring(0,7))"

Step '3. Unzipping the update'
$Tmp = Join-Path ([IO.Path]::GetTempPath()) ('scofis-' + [guid]::NewGuid())
try {
  Expand-Archive -Path $Zip -DestinationPath $Tmp -Force
  $Src = $Tmp
  $top = @(Get-ChildItem -Force $Src)
  if ($top.Count -eq 1 -and $top[0].PSIsContainer) { $Src = $top[0].FullName }
  if (-not (Test-Path (Join-Path $Src 'package.json'))) { Die 'the ZIP does not contain the site (no package.json)' }
  $skip = '^(\.git|node_modules|\.next|\.vercel)([\\/]|$)|^\.env'
  Get-ChildItem -Recurse -Force -File $Src | ForEach-Object {
    $rel = $_.FullName.Substring($Src.Length).TrimStart('\', '/')
    if ($rel -notmatch $skip) {
      $dest = Join-Path $Repo $rel
      New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
      Copy-Item -Force $_.FullName $dest
    }
  }
  # Tracked files that are not in the update were removed in it.
  $removed = 0
  foreach ($f in (git ls-files)) {
    if ($f -match '^\.env' -or $f -match '^\.vercel/') { continue }
    if (-not (Test-Path (Join-Path $Src $f))) { Invoke-Git rm -q -- $f; $removed++ }
  }
  Write-Host "copied; $removed tracked files removed"
} finally {
  Remove-Item -Recurse -Force $Tmp -ErrorAction SilentlyContinue
}

Step '4. npm install and build'
npm install
if ($LASTEXITCODE -ne 0) { Die 'npm install failed. Nothing committed. Undo with: git checkout -- . ; git clean -fd' }
$savedDb = $env:DATABASE_URL
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
npm run build
$buildExit = $LASTEXITCODE
if ($savedDb) { $env:DATABASE_URL = $savedDb }
if ($buildExit -ne 0) { Die 'build failed. Nothing committed. Undo with: git checkout -- . ; git clean -fd' }

Step '5. Review'
Invoke-Git add -A
git status --short
Write-Host ''
git diff --cached --stat | Select-Object -Last 40
Write-Host ''
$ok = Read-Host 'Commit and push these changes to main? Type yes to continue'
if ($ok -ne 'yes') { Write-Host "Stopped. Nothing pushed. Undo with: git reset -q --hard $Before ; git clean -fd"; exit 1 }

Step '6. Commit and push'
Invoke-Git commit -q -m $Message
$After = (git rev-parse HEAD).Trim()
Invoke-Git push origin main
Write-Host "pushed $($After.Substring(0,7)) to main; Vercel builds it automatically."

if ($Prod) {
  Step 'vercel --prod'
  if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) { Die 'Vercel CLI not installed (npm i -g vercel); the push above already triggers a deployment' }
  vercel --prod
}

Write-Host ''
Write-Host 'Rollback (makes a new commit that undoes this update, then Vercel redeploys):'
Write-Host "  cd `"$Repo`"; git checkout main; git pull; git revert --no-edit $After; git push origin main"
Write-Host "Backup of main before the update: branch $Backup ($($Before.Substring(0,7)))"
Write-Host 'Note: rollback restores the files. Wording already updated in the dashboard by this update stays until edited back there.'
