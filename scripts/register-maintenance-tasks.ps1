param(
  [switch]$Unregister
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$tasks = @(
  @{ Name = 'RetailOS-Backup'; Task = 'backup'; At = '02:00'; Desc = 'RetailOS 每日数据库备份' },
  @{ Name = 'RetailOS-Reconcile'; Task = 'reconcile'; At = '06:30'; Desc = 'RetailOS 每日只读对账' },
  @{ Name = 'RetailOS-AuditArchive'; Task = 'archive'; At = '03:30'; Desc = 'RetailOS 每周审计归档' }
)

if ($Unregister) {
  foreach ($item in $tasks) {
    Unregister-ScheduledTask -TaskName $item.Name -Confirm:$false -ErrorAction SilentlyContinue
  }
  Write-Output '已移除 RetailOS 计划任务'
  return
}

foreach ($item in $tasks) {
  $argument = "-NoProfile -ExecutionPolicy Bypass -File `"$root\scripts\run-maintenance.ps1`" -Task $($item.Task)"
  $action = New-ScheduledTaskAction -Execute $powershell -Argument $argument
  if ($item.Task -eq 'archive') {
    $trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At $item.At
  } else {
    $trigger = New-ScheduledTaskTrigger -Daily -At $item.At
  }
  Register-ScheduledTask `
    -TaskName $item.Name `
    -Action $action `
    -Trigger $trigger `
    -Description $item.Desc `
    -Force | Out-Null
  Write-Output "已注册 $($item.Name)"
}
