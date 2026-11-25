param(
    [ValidateSet('Preflight', 'Preview', 'Upload')][string]$Mode = 'Preflight',
    [string]$Username,
    [switch]$UploadAuthorized
)
. (Join-Path $PSScriptRoot 'common.ps1')
$lock = Enter-SteamLock
try {
    $node = (Get-Command node).Source
    Invoke-Checked $node @((Join-Path $PSScriptRoot 'write-vdf.mjs'))
    Invoke-Checked $node @((Join-Path $PSScriptRoot 'preflight.mjs'))
    if ($Mode -eq 'Preflight') { return }
    if ($Mode -eq 'Upload' -and -not $UploadAuthorized) { throw 'Upload requires explicit user authorization. After approval, add -UploadAuthorized.' }
    Invoke-Checked $node @((Join-Path $PSScriptRoot 'record-steampipe.mjs'), 'begin', $Mode)
    if (-not $Username) { $Username = Read-Host 'Steamworks account name (password / Steam Guard only in official SteamCMD)' }
    if ($Username -notmatch '^[A-Za-z0-9_]+$') { throw 'Invalid Steam account name.' }
    $vdf = Join-Path $SteamRoot $(if ($Mode -eq 'Preview') { 'vdf/app_build_5595750_preview.vdf' } else { 'vdf/app_build_5595750.vdf' })
    Push-Location (Join-Path $SteamRoot 'sdk/tools/ContentBuilder/builder')
    try {
        # Never record this terminal, pass a password, or read SteamCMD authentication caches.
        & './steamcmd.exe' '+login' $Username '+run_app_build' $vdf '+quit'
        if ($LASTEXITCODE -ne 0) { throw "SteamCMD failed ($LASTEXITCODE). Inspect official SteamPipe logs." }
    } finally { Pop-Location }
    Invoke-Checked $node @((Join-Path $PSScriptRoot 'record-steampipe.mjs'), 'finish', $Mode)
    Write-Host "$Mode completed. No branch was set live."
} catch { Write-Error $_; exit 1 } finally { $lock.Dispose() }
