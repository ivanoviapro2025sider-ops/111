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
$utf8 = [System.Text.UTF8Encoding]::new()
$OutputEncoding = $utf8
[Console]::OutputEncoding = $utf8

function Get-PythonCommand {
    $python3 = Get-Command python3 -ErrorAction SilentlyContinue
    if ($python3) {
        return @($python3.Source)
    }

    $python = Get-Command python -ErrorAction SilentlyContinue
    if ($python) {
        return @($python.Source)
    }

    $py = Get-Command py -ErrorAction SilentlyContinue
    if ($py) {
        return @($py.Source, "-3")
    }

    return $null
}

function Invoke-Python {
    param(
        [Parameter(Mandatory = $true)][string[]]$PythonCmd,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    $prefixArgs = @()
    if ($PythonCmd.Length -gt 1) {
        $prefixArgs = $PythonCmd[1..($PythonCmd.Length - 1)]
    }

    & $PythonCmd[0] @prefixArgs @Arguments
    return $LASTEXITCODE
}

function Test-LxmlInstalled {
    param([Parameter(Mandatory = $true)][string[]]$PythonCmd)

    $args = @("-c", "import lxml")
    $null = Invoke-Python -PythonCmd $PythonCmd -Arguments $args 2>$null
    return ($LASTEXITCODE -eq 0)
}

function Install-Lxml {
    param([Parameter(Mandatory = $true)][string[]]$PythonCmd)

    Write-Host "Installing Python dependency: lxml"
    $installArgs = @("-m", "pip", "install", "lxml")
    $exitCode = Invoke-Python -PythonCmd $PythonCmd -Arguments $installArgs
    if ($exitCode -ne 0) {
        throw "Failed to install lxml via pip."
    }
}

$pythonCmd = Get-PythonCommand
if (-not $pythonCmd) {
    throw "Python was not found. Install Python 3 and ensure one of these commands is available in PATH: python3, python, or py -3."
}

$pythonScript = Join-Path $PSScriptRoot "dep-analyzer.py"
if (-not (Test-Path -LiteralPath $pythonScript)) {
    throw "Entry-point script not found: $pythonScript"
}

if (-not (Test-LxmlInstalled -PythonCmd $pythonCmd)) {
    Install-Lxml -PythonCmd $pythonCmd
    if (-not (Test-LxmlInstalled -PythonCmd $pythonCmd)) {
        throw "lxml is still unavailable after installation."
    }
}

$scriptArguments = @(
    "--config-path", $ConfigPath,
    "--mode", $Mode,
    "--target", $Target,
    "--depth", "$Depth",
    "--out-format", $OutFormat,
    "--limit", "$Limit",
    "--offset", "$Offset"
)

if ($OutFile) {
    $scriptArguments += @("--out-file", $OutFile)
}

$allArguments = @($pythonScript) + $scriptArguments
$null = Invoke-Python -PythonCmd $pythonCmd -Arguments $allArguments
exit $LASTEXITCODE
