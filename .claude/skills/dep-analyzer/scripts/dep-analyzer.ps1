[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$ConfigPath,
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

function Get-PythonCommand {
    if (Get-Command python3 -ErrorAction SilentlyContinue) {
        return @{ Cmd = "python3"; Prefix = @() }
    }
    if (Get-Command python -ErrorAction SilentlyContinue) {
        return @{ Cmd = "python"; Prefix = @() }
    }
    if (Get-Command py -ErrorAction SilentlyContinue) {
        return @{ Cmd = "py"; Prefix = @("-3") }
    }
    return $null
}

function Invoke-Python {
    param(
        [Parameter(Mandatory = $true)][string]$PythonCmd,
        [Parameter(Mandatory = $true)][string[]]$Prefix,
        [Parameter(Mandatory = $true)][string[]]$ArgsList
    )
    & $PythonCmd @Prefix @ArgsList
    return $LASTEXITCODE
}

$pythonInfo = Get-PythonCommand
if (-not $pythonInfo) {
    Write-Error @"
Python not found.
Install Python 3 and ensure one of the commands is available in PATH:
  1) python3
  2) python
  3) py -3
"@
}

$pythonCmd = $pythonInfo.Cmd
$pythonPrefix = $pythonInfo.Prefix
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pythonScript = Join-Path $scriptDir "dep-analyzer.py"

if (-not (Test-Path -LiteralPath $pythonScript)) {
    Write-Error "Entry-point script not found: $pythonScript"
}

# Check lxml, install automatically if missing.
$checkCode = Invoke-Python -PythonCmd $pythonCmd -Prefix $pythonPrefix -ArgsList @("-c", "import lxml")
if ($checkCode -ne 0) {
    Write-Host "lxml not found, installing..."
    $installCode = Invoke-Python -PythonCmd $pythonCmd -Prefix $pythonPrefix -ArgsList @("-m", "pip", "install", "lxml")
    if ($installCode -ne 0) {
        Write-Error "Failed to install lxml via pip."
    }

    $recheckCode = Invoke-Python -PythonCmd $pythonCmd -Prefix $pythonPrefix -ArgsList @("-c", "import lxml")
    if ($recheckCode -ne 0) {
        Write-Error "lxml is still unavailable after installation."
    }
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

# Critical bugfix: run selected python executable, not script path as command.
& $pythonCmd @pythonPrefix $pythonScript @arguments
$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) {
    throw "dep-analyzer failed with exit code $exitCode"
}
