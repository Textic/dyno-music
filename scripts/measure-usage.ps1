<#
.SYNOPSIS
  Measures Dyno Music's CPU and memory on Windows: the app itself and every WebView2 process it
  started (browser, GPU, renderers, utilities).

.EXAMPLE
  pwsh scripts/measure-usage.ps1                 # 30 s, while music plays
  pwsh scripts/measure-usage.ps1 -Seconds 60

.NOTES
  CPU is the average over the window, as a share of the whole machine (100% = every core busy).
  Memory is private bytes (what the process alone uses), at the end of the window. Each WebView
  page runs in its own renderer: the busiest one while music plays is the hidden YouTube Music
  page, the other one is Dyno Music's own interface.
#>
param(
  [int]$Seconds = 30,
  [string[]]$Names = @("dyno-music", "Dyno Music")
)

$root = Get-Process -Name $Names -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $root) {
  Write-Error "Dyno Music is not running."
  exit 1
}

# Everything below the app in the process tree (WebView2 starts its own processes).
$all = Get-CimInstance Win32_Process
$tree = @{ $root.Id = $all | Where-Object ProcessId -eq $root.Id }
do {
  $added = $false
  foreach ($p in $all) {
    if (-not $tree.ContainsKey([int]$p.ProcessId) -and $tree.ContainsKey([int]$p.ParentProcessId)) {
      $tree[[int]$p.ProcessId] = $p
      $added = $true
    }
  }
} while ($added)

function Get-Kind($cim) {
  if ($cim.ProcessId -eq $root.Id) { return "app (Rust)" }
  if ($cim.CommandLine -match "--type=([\w-]+)") {
    switch ($Matches[1]) {
      "renderer" { return "renderer" }
      "gpu-process" { return "GPU" }
      "utility" {
        if ($cim.CommandLine -match "--utility-sub-type=([\w.]+)") { return "utility ($($Matches[1] -replace '^.*\.', ''))" }
        return "utility"
      }
      "crashpad-handler" { return "crash handler" }
      default { return $Matches[1] }
    }
  }
  return "WebView2 browser"
}

$ids = [int[]]$tree.Keys
$cpuBefore = @{}
foreach ($id in $ids) {
  $proc = Get-Process -Id $id -ErrorAction SilentlyContinue
  if ($proc) { $cpuBefore[$id] = $proc.TotalProcessorTime.TotalSeconds }
}
$started = Get-Date
Write-Host "Measuring $($ids.Count) processes for $Seconds s..."
Start-Sleep -Seconds $Seconds
$elapsed = ((Get-Date) - $started).TotalSeconds
$cores = [Environment]::ProcessorCount

$rows = foreach ($id in $ids) {
  $proc = Get-Process -Id $id -ErrorAction SilentlyContinue
  if (-not $proc -or -not $cpuBefore.ContainsKey($id)) { continue }
  $cpuSeconds = $proc.TotalProcessorTime.TotalSeconds - $cpuBefore[$id]
  [pscustomobject]@{
    Kind         = Get-Kind $tree[$id]
    PID          = $id
    "CPU %"      = [math]::Round(100 * $cpuSeconds / ($elapsed * $cores), 2)
    "CPU % core" = [math]::Round(100 * $cpuSeconds / $elapsed, 1)
    "Memory MB"  = [math]::Round($proc.PrivateMemorySize64 / 1MB, 0)
  }
}

$rows | Sort-Object "CPU %" -Descending | Format-Table -AutoSize
$total = [pscustomobject]@{
  "CPU % (machine)"   = [math]::Round(($rows | Measure-Object "CPU %" -Sum).Sum, 2)
  "CPU % (one core)"  = [math]::Round(($rows | Measure-Object "CPU % core" -Sum).Sum, 1)
  "Memory MB"         = ($rows | Measure-Object "Memory MB" -Sum).Sum
  Cores               = $cores
}
Write-Host "Total:"
$total | Format-List
