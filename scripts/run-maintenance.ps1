param(
  [ValidateSet('backup', 'reconcile', 'archive')][string]$Task
)

$ErrorActionPreference = 'Continue'
$root = Split-Path $PSScriptRoot -Parent
$serverDir = Join-Path $root 'server'
$logDir = Join-Path $root 'backups'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir 'maintenance.log'

function Write-Log([string]$Text) {
  Add-Content -Path $log -Value $Text -Encoding UTF8
}

Write-Log "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] START $Task"

try {
  switch ($Task) {
    'backup' {
      $output = & (Join-Path $PSScriptRoot 'backup-db.ps1') -KeepDays 14 2>&1
      $code = $LASTEXITCODE
      $output | ForEach-Object { Write-Log $_.ToString() }
      if ($code -ne 0) { throw "backup 退出码 $code" }
    }
    'reconcile' {
      Push-Location $serverDir
      try {
        $output = & node 'node_modules\ts-node\dist\bin.js' 'scripts\reconcile.ts' 2>&1
        $code = $LASTEXITCODE
      } finally {
        Pop-Location
      }
      $output | ForEach-Object { Write-Log $_.ToString() }
      if ($code -ne 0) { throw "reconcile 退出码 $code" }
    }
    'archive' {
      Push-Location $serverDir
      try {
        $output = & node 'node_modules\ts-node\dist\bin.js' 'scripts\archive-audit.ts' '--days' '90' 2>&1
        $code = $LASTEXITCODE
      } finally {
        Pop-Location
      }
      $output | ForEach-Object { Write-Log $_.ToString() }
      if ($code -ne 0) { throw "archive 退出码 $code" }
    }
  }

  Write-Log "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] OK $Task"
} catch {
  Write-Log "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] FAIL $Task：$($_.Exception.Message)"
  exit 1
}
