[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ConfigPath,

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

function Get-PythonRuntime {
    $candidates = @(
        @{ Command = "python3"; Prefix = @() },
        @{ Command = "python"; Prefix = @() },
        @{ Command = "py"; Prefix = @("-3") }
    )

    foreach ($candidate in $candidates) {
        $cmd = Get-Command $candidate.Command -ErrorAction SilentlyContinue
        if ($null -ne $cmd) {
            return $candidate
        }
    }

    return $null
}

function Test-LxmlInstalled {
    param(
        [string]$PythonCmd,
        [string[]]$PythonPrefixArgs
    )

    & $PythonCmd @PythonPrefixArgs -c "import lxml" *> $null
    return ($LASTEXITCODE -eq 0)
}

function Install-Lxml {
    param(
        [string]$PythonCmd,
        [string[]]$PythonPrefixArgs
    )

    Write-Host "Installing Python package: lxml"
    & $PythonCmd @PythonPrefixArgs -m pip install lxml
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to install lxml via pip."
    }
}

$runtime = Get-PythonRuntime
if ($null -eq $runtime) {
    throw "Python was not found. Install Python 3 and ensure one of these launchers is available in PATH: python3, python, or py -3."
}

$pythonCmd = $runtime.Command
$pythonPrefixArgs = @($runtime.Prefix)
$pythonScript = Join-Path $PSScriptRoot "dep-analyzer.py"

if (-not (Test-Path -LiteralPath $pythonScript)) {
    throw "Entry-point not found: $pythonScript"
}

if (-not (Test-LxmlInstalled -PythonCmd $pythonCmd -PythonPrefixArgs $pythonPrefixArgs)) {
    Install-Lxml -PythonCmd $pythonCmd -PythonPrefixArgs $pythonPrefixArgs
    if (-not (Test-LxmlInstalled -PythonCmd $pythonCmd -PythonPrefixArgs $pythonPrefixArgs)) {
        throw "lxml is still unavailable after installation."
    }
}

$arguments = @(
    "--config-path", $ConfigPath,
    "--mode", $Mode,
    "--target", $Target,
    "--depth", $Depth,
    "--out-format", $OutFormat,
    "--limit", $Limit,
    "--offset", $Offset
)

if ($OutFile) {
    $arguments += @("--out-file", $OutFile)
}

& $pythonCmd @pythonPrefixArgs $pythonScript @arguments
exit $LASTEXITCODE
