param(
  [Parameter(Mandatory = $true)][string]$File,
  [string]$MysqlBin = '',
  [string]$DbHost = '127.0.0.1',
  [int]$Port = 3306,
  [string]$User = 'retailos',
  [string]$Password = $env:DB_PASSWORD,
  [switch]$Yes
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $File)) {
  throw "找不到备份文件：$File"
}
if (-not $Password) {
  throw '未提供数据库密码，请设置环境变量 DB_PASSWORD 或传入 -Password'
}
if (-not $MysqlBin) {
  $command = Get-Command mysql -ErrorAction SilentlyContinue
  if ($command) {
    $MysqlBin = $command.Source
  } else {
    throw '找不到 mysql 客户端，请通过 -MysqlBin 指定路径'
  }
}
if (-not (Test-Path $MysqlBin)) {
  throw "找不到 mysql 客户端：$MysqlBin"
}

if (-not $Yes) {
  $answer = Read-Host "将覆盖 $DbHost`:$Port 上的数据库内容，输入 YES 继续"
  if ($answer -ne 'YES') {
    Write-Output '已取消'
    exit 1
  }
}

$env:MYSQL_PWD = $Password
try {
  Get-Content -Raw -Encoding UTF8 $File |
    & $MysqlBin `
      "--host=$DbHost" `
      "--port=$Port" `
      "--user=$User" `
      --default-character-set=utf8mb4

  if ($LASTEXITCODE -ne 0) {
    throw "mysql 退出码 $LASTEXITCODE"
  }
} finally {
  Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
}

Write-Output "RESTORE OK: $File"
