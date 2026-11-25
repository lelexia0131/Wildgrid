$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$OutputEncoding = [Text.UTF8Encoding]::new($false)
$ProjectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$SteamRoot = Join-Path $ProjectRoot 'steam'
New-Item -ItemType Directory -Path $SteamRoot -Force | Out-Null
function Enter-SteamLock {
    try { return [IO.File]::Open((Join-Path $SteamRoot '.operation.lock'), 'OpenOrCreate', 'ReadWrite', 'None') }
    catch { throw 'Another Steam build, verification or upload is running.' }
}
function Invoke-Checked([string]$Executable, [string[]]$Arguments) {
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Executable failed with exit code $LASTEXITCODE" }
}
