param(
  [string]$MysqlBin = '',
  [string]$DbHost = '',
  [int]$Port = 0,
  [string]$User = '',
  [string]$Password = '',
  [string]$Database = '',
  [string]$OutputDir = (Join-Path $PSScriptRoot '..\backups'),
  [int]$KeepDays = 14
)

$ErrorActionPreference = 'Stop'

function Read-DotEnv([string]$Path) {
  $map = @{}
  if (-not (Test-Path $Path)) { return $map }
  Get-Content $Path | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
      $map[$matches[1]] = $matches[2].Trim()
    }
  }
  return $map
}

$dotenv = Read-DotEnv (Join-Path $PSScriptRoot '..\server\.env')
if (-not $DbHost) { $DbHost = if ($env:DB_HOST) { $env:DB_HOST } elseif ($dotenv['DB_HOST']) { $dotenv['DB_HOST'] } else { '127.0.0.1' } }
if (-not $Port) { $Port = if ($env:DB_PORT) { [int]$env:DB_PORT } elseif ($dotenv['DB_PORT']) { [int]$dotenv['DB_PORT'] } else { 3306 } }
if (-not $User) { $User = if ($env:DB_USER) { $env:DB_USER } elseif ($dotenv['DB_USER']) { $dotenv['DB_USER'] } else { 'retailos' } }
if (-not $Password) { $Password = if ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { $dotenv['DB_PASSWORD'] } }
if (-not $Database) { $Database = if ($env:DB_NAME) { $env:DB_NAME } elseif ($dotenv['DB_NAME']) { $dotenv['DB_NAME'] } else { 'retailos' } }

if (-not $MysqlBin) {
  $candidates = @(
    (Get-Command mysqldump.exe -ErrorAction SilentlyContinue).Source,
    (Get-Command mysqldump -ErrorAction SilentlyContinue).Source,
    'D:\MySQL\Server\bin\mysqldump.exe',
    'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe'
  )
  $MysqlBin = $candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
  if (-not $MysqlBin) {
    throw '找不到 mysqldump，请通过 -MysqlBin 指定路径'
  }
}

if (-not (Test-Path $MysqlBin)) {
  throw "找不到 mysqldump：$MysqlBin，请通过 -MysqlBin 指定路径"
}
if (-not $Password) {
  throw '未提供数据库密码，请设置环境变量 DB_PASSWORD 或传入 -Password'
}
if (-not (Test-Path $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$file = Join-Path $OutputDir "$Database-$stamp.sql"
$env:MYSQL_PWD = $Password

try {
  & $MysqlBin `
    "--host=$DbHost" `
    "--port=$Port" `
    "--user=$User" `
    --single-transaction `
    --quick `
    --no-tablespaces `
    --routines `
    --events `
    --databases $Database `
    "--result-file=$file"

  if ($LASTEXITCODE -ne 0) {
    throw "mysqldump 退出码 $LASTEXITCODE"
  }
} finally {
  Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
}

$expired = Get-ChildItem $OutputDir -Filter "$Database-*.sql" |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) }
foreach ($item in $expired) {
  Remove-Item $item.FullName -Force
}

$sizeMb = [math]::Round((Get-Item $file).Length / 1MB, 2)
Write-Output "BACKUP OK: $file ($sizeMb MB), removed $($expired.Count) expired file(s)"
