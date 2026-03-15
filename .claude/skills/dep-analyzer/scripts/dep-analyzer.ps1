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

function Resolve-PythonRuntime {
    $candidates = @(
        @{ Name = "python3"; Prefix = @() },
        @{ Name = "python"; Prefix = @() },
        @{ Name = "py"; Prefix = @("-3") }
    )

    foreach ($candidate in $candidates) {
        $cmd = Get-Command $candidate.Name -ErrorAction SilentlyContinue
        if ($null -eq $cmd) {
            continue
        }

        try {
            & $candidate.Name @($candidate.Prefix + @("-c", "import sys; print(sys.version)")) | Out-Null
            return $candidate
        } catch {
            continue
        }
    }

    return $null
}

function Ensure-Lxml {
    param(
        [Parameter(Mandatory = $true)][string]$PythonCmd,
        [Parameter(Mandatory = $true)][string[]]$PythonPrefix
    )

    try {
        & $PythonCmd @($PythonPrefix + @("-c", "import lxml")) | Out-Null
    } catch {
        Write-Host "[INFO] Python package 'lxml' not found, installing..."
        & $PythonCmd @($PythonPrefix + @("-m", "pip", "install", "lxml"))
        & $PythonCmd @($PythonPrefix + @("-c", "import lxml")) | Out-Null
    }
}

$runtime = Resolve-PythonRuntime
if ($null -eq $runtime) {
    Write-Error "Python не найден. Установите Python 3 и убедитесь, что доступна команда 'python3' или 'python', либо launcher 'py -3'."
    exit 1
}

$pythonCmd = $runtime.Name
$pythonPrefix = $runtime.Prefix

Ensure-Lxml -PythonCmd $pythonCmd -PythonPrefix $pythonPrefix

$pythonScript = Join-Path $PSScriptRoot "dep-analyzer.py"
if (-not (Test-Path $pythonScript)) {
    Write-Error "Не найден скрипт dep-analyzer.py по пути: $pythonScript"
    exit 1
}

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

# Важно: запуск python командой, а не путём к .py.
& $pythonCmd @($pythonPrefix + @($pythonScript) + $arguments)
$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) {
    exit $exitCode
}
