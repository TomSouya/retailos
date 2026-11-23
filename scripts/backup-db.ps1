param(
  [string]$MysqlBin = 'D:\MySQL\Server\bin\mysqldump.exe',
  [string]$DbHost = '127.0.0.1',
  [int]$Port = 3306,
  [string]$User = 'retailos',
  [string]$Password = $env:DB_PASSWORD,
  [string]$Database = 'retailos',
  [string]$OutputDir = (Join-Path $PSScriptRoot '..\backups'),
  [int]$KeepDays = 14
)

$ErrorActionPreference = 'Stop'

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
