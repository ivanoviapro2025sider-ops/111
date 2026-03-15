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

try {
    $OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
} catch {
    $utf8 = New-Object System.Text.UTF8Encoding
    $OutputEncoding = [Console]::OutputEncoding = $utf8
}

function Resolve-PythonCommand {
    $candidates = @(
        @{ Command = "python3"; PrefixArgs = @() },
        @{ Command = "python"; PrefixArgs = @() }
    )

    foreach ($candidate in $candidates) {
        $cmdInfo = Get-Command $candidate.Command -ErrorAction SilentlyContinue
        if (-not $cmdInfo) { continue }
        try {
            & $candidate.Command @($candidate.PrefixArgs) -c "import sys" | Out-Null
            if ($LASTEXITCODE -eq 0) {
                return $candidate
            }
        } catch {
        }
    }

    $pyCmd = Get-Command "py" -ErrorAction SilentlyContinue
    if ($pyCmd) {
        try {
            & py -3 -c "import sys" | Out-Null
            if ($LASTEXITCODE -eq 0) {
                return @{ Command = "py"; PrefixArgs = @("-3") }
            }
        } catch {
        }
    }

    return $null
}

function Ensure-LxmlInstalled {
    param(
        [Parameter(Mandatory)][string]$PythonCmd,
        [string[]]$PythonPrefixArgs = @()
    )

    try {
        & $PythonCmd @PythonPrefixArgs -c "import lxml" | Out-Null
        if ($LASTEXITCODE -eq 0) {
            return
        }
    } catch {
    }

    Write-Host "[INFO] Python package 'lxml' not found. Installing via pip..."
    & $PythonCmd @PythonPrefixArgs -m pip install lxml
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to install Python package 'lxml'."
    }

    & $PythonCmd @PythonPrefixArgs -c "import lxml" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Python package 'lxml' is still unavailable after installation."
    }
}

$python = Resolve-PythonCommand
if (-not $python) {
    Write-Error "Python 3 was not found. Install Python and ensure one of these commands works: python3, python, or py -3."
    exit 1
}

$pythonCmd = $python.Command
$pythonPrefixArgs = @($python.PrefixArgs)

$pythonScript = Join-Path $PSScriptRoot "dep-analyzer.py"
if (-not (Test-Path $pythonScript -PathType Leaf)) {
    Write-Error "Python entry-point not found: $pythonScript"
    exit 1
}

Ensure-LxmlInstalled -PythonCmd $pythonCmd -PythonPrefixArgs $pythonPrefixArgs

$arguments = @(
    "-ConfigPath", $ConfigPath,
    "-Mode", $Mode,
    "-Target", $Target,
    "-Depth", "$Depth",
    "-OutFormat", $OutFormat,
    "-Limit", "$Limit",
    "-Offset", "$Offset"
)

if ($OutFile) {
    $arguments += @("-OutFile", $OutFile)
}

& $pythonCmd @pythonPrefixArgs $pythonScript @arguments
exit $LASTEXITCODE
