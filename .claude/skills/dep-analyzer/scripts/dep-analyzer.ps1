<#
.SYNOPSIS
    PowerShell-обёртка для dep-analyzer — анализатора зависимостей метаданных 1С.
.DESCRIPTION
    Находит Python, устанавливает lxml при необходимости и запускает dep-analyzer.py.
    Совместима с PowerShell 5.1 (Windows) и PowerShell Core 7+ (Linux/macOS).
.EXAMPLE
    .\dep-analyzer.ps1 -ConfigPath "C:\MyConfig" -Mode deps -Target "Document.РеализацияТоваровУслуг"
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$ConfigPath,

    [ValidateSet("deps", "debug", "rights", "full")]
    [string]$Mode = "deps",

    [string]$Target = "",

    [ValidateRange(1, 99)]
    [int]$Depth = 3,

    [ValidateSet("text", "json", "md")]
    [string]$OutFormat = "text",

    [ValidateRange(1, 10000)]
    [int]$Limit = 150,

    [ValidateRange(0, 100000)]
    [int]$Offset = 0,

    [string]$OutFile = ""
)

$ErrorActionPreference = "Stop"

if ($PSVersionTable.PSVersion.Major -ge 6) {
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
    $OutputEncoding = [System.Text.UTF8Encoding]::new()
} else {
    try {
        [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
        $OutputEncoding = [System.Text.UTF8Encoding]::new()
    } catch {
        Write-Verbose "Could not set UTF-8 encoding: $_"
    }
}

function Find-Python {
    $candidates = @("python3", "python", "py")
    foreach ($cmd in $candidates) {
        try {
            if ($cmd -eq "py") {
                $ver = & py -3 --version 2>&1
                if ($LASTEXITCODE -eq 0) { return @{ Cmd = "py"; Args = @("-3") } }
            } else {
                $ver = & $cmd --version 2>&1
                if ($LASTEXITCODE -eq 0) { return @{ Cmd = $cmd; Args = @() } }
            }
        } catch {
            continue
        }
    }
    return $null
}

$pyInfo = Find-Python
if (-not $pyInfo) {
    Write-Error @"
Python 3 not found. Please install Python 3.8+ and ensure it is in PATH.
  - Windows: https://www.python.org/downloads/
  - Linux:   sudo apt install python3
  - macOS:   brew install python3
"@
    exit 1
}

$pythonCmd = $pyInfo.Cmd
$pythonArgs = $pyInfo.Args
Write-Verbose "Using Python: $pythonCmd $($pythonArgs -join ' ')"

try {
    $checkLxml = & $pythonCmd @pythonArgs -c "import lxml; print('ok')" 2>&1
    if ($checkLxml -ne "ok") { throw "lxml not available" }
} catch {
    Write-Host "[dep-analyzer] Installing lxml..." -ForegroundColor Yellow
    $pipArgs = @("-m", "pip", "install", "lxml", "--quiet")
    & $pythonCmd @pythonArgs @pipArgs 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to install lxml. Please run: $pythonCmd -m pip install lxml"
        exit 1
    }
    Write-Host "[dep-analyzer] lxml installed successfully." -ForegroundColor Green
}

$scriptDir = $PSScriptRoot
if (-not $scriptDir) {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}
$pythonScript = Join-Path $scriptDir "dep-analyzer.py"

if (-not (Test-Path $pythonScript)) {
    Write-Error "Entry point not found: $pythonScript"
    exit 1
}

$arguments = @(
    "--config-path", $ConfigPath,
    "--mode", $Mode,
    "--depth", $Depth.ToString(),
    "--out-format", $OutFormat,
    "--limit", $Limit.ToString(),
    "--offset", $Offset.ToString()
)

if ($Target) {
    $arguments += @("--target", $Target)
}

if ($OutFile) {
    $arguments += @("--out-file", $OutFile)
}

Write-Verbose "Running: $pythonCmd $($pythonArgs -join ' ') $pythonScript $($arguments -join ' ')"

& $pythonCmd @pythonArgs $pythonScript @arguments
$exitCode = $LASTEXITCODE

if ($exitCode -ne 0) {
    Write-Error "dep-analyzer.py exited with code $exitCode"
}

exit $exitCode
