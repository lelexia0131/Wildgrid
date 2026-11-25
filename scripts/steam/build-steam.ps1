param()
. (Join-Path $PSScriptRoot 'common.ps1')
$lock = Enter-SteamLock
try {
    Invoke-Checked (Get-Command node).Source @((Join-Path $PSScriptRoot 'build.mjs'))
} catch { Write-Error $_; exit 1 } finally { $lock.Dispose() }
