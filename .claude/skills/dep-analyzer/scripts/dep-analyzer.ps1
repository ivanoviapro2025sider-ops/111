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

function Test-CommandExists {
    param([Parameter(Mandatory = $true)][string]$Name)
    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-PythonCommand {
    # Priority: python3 -> python -> py -3
    if (Test-CommandExists -Name "python3") {
        return @{ Cmd = "python3"; Prefix = @() }
    }
    if (Test-CommandExists -Name "python") {
        return @{ Cmd = "python"; Prefix = @() }
    }
    if (Test-CommandExists -Name "py") {
        return @{ Cmd = "py"; Prefix = @("-3") }
    }
    return $null
}

function Invoke-Python {
    param(
        [Parameter(Mandatory = $true)][hashtable]$PythonSpec,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )
    & $PythonSpec.Cmd @($PythonSpec.Prefix + $Arguments)
}

$pythonSpec = Get-PythonCommand
if ($null -eq $pythonSpec) {
    throw @"
Python не найден в PATH.
Установите Python 3 и проверьте команды: python3 или python, либо Windows launcher: py -3.
"@
}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$pythonScript = Join-Path $scriptRoot "dep-analyzer.py"
if (-not (Test-Path -LiteralPath $pythonScript)) {
    throw "Не найден entry-point: $pythonScript"
}

# Check lxml and install if needed
$checkArgs = @("-c", "import lxml")
try {
    Invoke-Python -PythonSpec $pythonSpec -Arguments $checkArgs | Out-Null
} catch {
    Write-Host "lxml не найден, выполняется установка через pip..." -ForegroundColor Yellow
    $pipArgs = @("-m", "pip", "install", "lxml")
    Invoke-Python -PythonSpec $pythonSpec -Arguments $pipArgs
}

$arguments = @(
    "--config-path", $ConfigPath,
    "--mode", $Mode,
    "--target", $Target,
    "--depth", "$Depth",
    "--out-format", $OutFormat,
    "--limit", "$Limit",
    "--offset", "$Offset"
)

if ($OutFile) {
    $arguments += @("--out-file", $OutFile)
}

# Critical fix: call detected python command, not script directly
Invoke-Python -PythonSpec $pythonSpec -Arguments @($pythonScript + $arguments)
