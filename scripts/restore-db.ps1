param(
  [Parameter(Mandatory = $true)][string]$File,
  [string]$MysqlBin = '',
  [string]$DbHost = '',
  [int]$Port = 0,
  [string]$User = '',
  [string]$Password = '',
  [switch]$Yes
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

if (-not (Test-Path $File)) {
  throw "找不到备份文件：$File"
}
if (-not $Password) {
  throw '未提供数据库密码，请设置环境变量 DB_PASSWORD 或传入 -Password'
}
if (-not $MysqlBin) {
  $candidates = @(
    (Get-Command mysql.exe -ErrorAction SilentlyContinue).Source,
    (Get-Command mysql -ErrorAction SilentlyContinue).Source,
    'D:\MySQL\Server\bin\mysql.exe',
    'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe'
  )
  $MysqlBin = $candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
  if (-not $MysqlBin) {
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
  $commandLine = "`"$MysqlBin`" --host=$DbHost --port=$Port --user=$User --default-character-set=utf8mb4 < `"$File`""
  cmd.exe /c $commandLine

  if ($LASTEXITCODE -ne 0) {
    throw "mysql 退出码 $LASTEXITCODE"
  }
} finally {
  Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
}

Write-Output "RESTORE OK: $File"
