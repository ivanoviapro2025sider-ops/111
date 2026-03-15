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

function Test-PythonCandidate {
    param(
        [Parameter(Mandatory)][string]$Executable,
        [string[]]$BaseArgs = @()
    )

    try {
        & $Executable @BaseArgs "-c" "import sys; print(sys.version.split()[0])" *> $null
        if ($LASTEXITCODE -eq 0) {
            return $true
        }
    } catch {
        return $false
    }

    return $false
}

function Resolve-PythonCommand {
    $candidates = @(
        @{ Executable = "python3"; BaseArgs = @() },
        @{ Executable = "python"; BaseArgs = @() },
        @{ Executable = "py"; BaseArgs = @("-3") }
    )

    foreach ($candidate in $candidates) {
        $command = Get-Command $candidate.Executable -ErrorAction SilentlyContinue
        if (-not $command) {
            continue
        }
        if (Test-PythonCandidate -Executable $candidate.Executable -BaseArgs $candidate.BaseArgs) {
            return $candidate
        }
    }

    return $null
}

function Ensure-Lxml {
    param(
        [Parameter(Mandatory)][string]$PythonExe,
        [string[]]$PythonBaseArgs = @()
    )

    & $PythonExe @PythonBaseArgs "-c" "import lxml" *> $null
    if ($LASTEXITCODE -eq 0) {
        return
    }

    Write-Host "[INFO] lxml not found. Installing..."
    & $PythonExe @PythonBaseArgs "-m" "pip" "install" "lxml"
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to install lxml via pip."
    }

    & $PythonExe @PythonBaseArgs "-c" "import lxml" *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "lxml installation completed, but import still fails."
    }
}

$python = Resolve-PythonCommand
if (-not $python) {
    Write-Error "Python 3 was not found. Install Python 3 and ensure one of these commands works: python3, python, or py -3."
    exit 1
}

$pythonCmd = $python.Executable
$pythonBaseArgs = $python.BaseArgs
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pythonScript = Join-Path $scriptDir "dep-analyzer.py"

if (-not (Test-Path $pythonScript)) {
    Write-Error "dep-analyzer.py not found рядом с PowerShell-обёрткой: $pythonScript"
    exit 1
}

Ensure-Lxml -PythonExe $pythonCmd -PythonBaseArgs $pythonBaseArgs

$arguments = @(
    "-ConfigPath", $ConfigPath,
    "-Mode", $Mode,
    "-Target", $Target,
    "-Depth", $Depth,
    "-OutFormat", $OutFormat,
    "-Limit", $Limit,
    "-Offset", $Offset
)

if ($OutFile) {
    $arguments += @("-OutFile", $OutFile)
}

& $pythonCmd @pythonBaseArgs $pythonScript @arguments
exit $LASTEXITCODE
