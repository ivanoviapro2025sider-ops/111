[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$ConfigPath,
    [string]$Mode = "deps",
    [string]$Target = "",
    [int]$Depth = 3,
    [string]$OutFormat = "text",
    [int]$Limit = 150,
    [int]$Offset = 0,
    [string]$OutFile = ""
)

$ErrorActionPreference = "Stop"
$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pythonScript = Join-Path $scriptDir "dep-analyzer.py"

function Find-Python {
    foreach ($cmd in @("python3", "python", "py")) {
        try {
            if ($cmd -eq "py") {
                $ver = & $cmd -3 --version 2>&1
            } else {
                $ver = & $cmd --version 2>&1
            }
            if ($LASTEXITCODE -eq 0 -and $ver -match "Python 3") {
                if ($cmd -eq "py") { return "py", "-3" }
                return $cmd, $null
            }
        } catch {}
    }
    return $null, $null
}

$pythonCmd, $pyFlag = Find-Python

if (-not $pythonCmd) {
    Write-Error @"
Python 3 not found. Please install Python 3.8+ and ensure it is on PATH.
  - Windows: https://www.python.org/downloads/
  - Linux:   sudo apt install python3 python3-pip
  - macOS:   brew install python3
"@
    exit 1
}

function Invoke-Python {
    param([string[]]$Arguments)
    if ($pyFlag) {
        & $pythonCmd $pyFlag @Arguments
    } else {
        & $pythonCmd @Arguments
    }
}

$lxmlCheck = Invoke-Python @("-c", "import lxml") 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "[dep-analyzer] Installing lxml..." -ForegroundColor Yellow
    Invoke-Python @("-m", "pip", "install", "lxml", "--quiet")
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to install lxml. Run manually: pip install lxml"
        exit 1
    }
    Write-Host "[dep-analyzer] lxml installed successfully." -ForegroundColor Green
}

$arguments = @(
    $pythonScript,
    "--config-path", $ConfigPath,
    "--mode", $Mode,
    "--depth", $Depth.ToString(),
    "--format", $OutFormat,
    "--limit", $Limit.ToString(),
    "--offset", $Offset.ToString()
)

if ($Target) {
    $arguments += @("--target", $Target)
}

if ($OutFile) {
    $arguments += @("--out-file", $OutFile)
}

if ($pyFlag) {
    & $pythonCmd $pyFlag @arguments
} else {
    & $pythonCmd @arguments
}

exit $LASTEXITCODE
