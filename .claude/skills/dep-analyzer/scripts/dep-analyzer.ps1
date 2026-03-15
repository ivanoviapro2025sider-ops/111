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
    param([string[]]$Candidate)
    try {
        if ($Candidate.Count -gt 1) {
            & $Candidate[0] @($Candidate[1..($Candidate.Count - 1)]) --version *> $null
        } else {
            & $Candidate[0] --version *> $null
        }
        return $true
    } catch {
        return $false
    }
}

function Resolve-PythonCommand {
    $candidates = @(
        @("python3"),
        @("python"),
        @("py", "-3")
    )
    foreach ($candidate in $candidates) {
        if (Test-PythonCandidate -Candidate $candidate) {
            return $candidate
        }
    }
    return $null
}

function Invoke-Python {
    param(
        [string[]]$PythonCmd,
        [string[]]$Arguments
    )
    if ($PythonCmd.Count -gt 1) {
        & $PythonCmd[0] @($PythonCmd[1..($PythonCmd.Count - 1)]) @Arguments
    } else {
        & $PythonCmd[0] @Arguments
    }
}

$pythonCmd = Resolve-PythonCommand
if (-not $pythonCmd) {
    Write-Error @"
Python не найден (проверено: python3, python, py -3).
Установите Python 3.9+ и убедитесь, что команда доступна в PATH.
Windows: https://www.python.org/downloads/windows/
Linux/macOS: https://www.python.org/downloads/
"@
    exit 127
}

$pythonScript = Join-Path $PSScriptRoot "dep-analyzer.py"
if (-not (Test-Path -LiteralPath $pythonScript)) {
    Write-Error "Файл entry-point не найден: $pythonScript"
    exit 2
}

try {
    Invoke-Python -PythonCmd $pythonCmd -Arguments @("-c", "import lxml")
} catch {
    Write-Host "lxml не найден, выполняю установку через pip..."
    try {
        Invoke-Python -PythonCmd $pythonCmd -Arguments @("-m", "pip", "install", "lxml")
        Invoke-Python -PythonCmd $pythonCmd -Arguments @("-c", "import lxml")
    } catch {
        Write-Error "Не удалось установить пакет lxml. Установите вручную: pip install lxml"
        exit 3
    }
}

$arguments = @(
    "--config-path", $ConfigPath,
    "--mode", $Mode,
    "--target", $Target,
    "--depth", $Depth.ToString(),
    "--out-format", $OutFormat,
    "--limit", $Limit.ToString(),
    "--offset", $Offset.ToString()
)

if ($OutFile -and $OutFile.Trim()) {
    $arguments += @("--out-file", $OutFile)
}

# Критичный фикс: запускаем python командой, а не путём к скрипту.
if ($pythonCmd.Count -gt 1) {
    & $pythonCmd[0] @($pythonCmd[1..($pythonCmd.Count - 1)]) $pythonScript @arguments
} else {
    & $pythonCmd[0] $pythonScript @arguments
}
$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) {
    exit $exitCode
}

