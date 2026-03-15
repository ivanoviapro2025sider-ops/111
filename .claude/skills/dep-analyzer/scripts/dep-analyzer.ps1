<#
.SYNOPSIS
    dep-analyzer: Анализатор зависимостей метаданных 1С (PowerShell-обёртка)
.DESCRIPTION
    Находит Python, проверяет/устанавливает lxml, запускает dep-analyzer.py.
    Совместимость: PowerShell 5.1 (Windows) + PowerShell Core 7+ (Linux/macOS).
.PARAMETER ConfigPath
    Путь к корню выгрузки конфигурации (содержит Configuration.xml).
.PARAMETER Mode
    Режим анализа: deps | debug | rights | full | list
.PARAMETER Target
    Целевой объект метаданных (Document.РеализацияТоваровУслуг) или фильтр.
.PARAMETER Depth
    Глубина обхода графа зависимостей (по умолчанию 3).
.PARAMETER OutFormat
    Формат вывода: text | json | md
.PARAMETER Limit
    Максимальное количество записей в выводе.
.PARAMETER Offset
    Смещение для пагинации.
.PARAMETER OutFile
    Путь к файлу для записи результата.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$ConfigPath,

    [ValidateSet("deps", "debug", "rights", "full", "list")]
    [string]$Mode = "deps",

    [string]$Target = "",

    [int]$Depth = 3,

    [ValidateSet("text", "json", "md")]
    [string]$OutFormat = "text",

    [int]$Limit = 150,

    [int]$Offset = 0,

    [string]$OutFile = ""
)

$ErrorActionPreference = "Stop"

# UTF-8 output
if ($PSVersionTable.PSVersion.Major -ge 6) {
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
} else {
    $OutputEncoding = [System.Text.UTF8Encoding]::new()
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
}

function Find-Python {
    $candidates = @("python3", "python", "py")
    foreach ($cmd in $candidates) {
        try {
            if ($cmd -eq "py") {
                $result = & py -3 --version 2>&1
                if ($LASTEXITCODE -eq 0) {
                    return @{ Command = "py"; Args = @("-3") }
                }
            } else {
                $result = & $cmd --version 2>&1
                if ($LASTEXITCODE -eq 0) {
                    $versionStr = "$result"
                    if ($versionStr -match "Python\s+3") {
                        return @{ Command = $cmd; Args = @() }
                    }
                }
            }
        } catch {
            continue
        }
    }
    return $null
}

function Test-LxmlInstalled {
    param([hashtable]$PythonInfo)
    try {
        $testArgs = $PythonInfo.Args + @("-c", "import lxml; print('ok')")
        $result = & $PythonInfo.Command @testArgs 2>&1
        return ($LASTEXITCODE -eq 0)
    } catch {
        return $false
    }
}

function Install-Lxml {
    param([hashtable]$PythonInfo)
    Write-Host "[INFO] Installing lxml..." -ForegroundColor Yellow
    try {
        $pipArgs = $PythonInfo.Args + @("-m", "pip", "install", "lxml", "--quiet")
        & $PythonInfo.Command @pipArgs 2>&1
        if ($LASTEXITCODE -ne 0) {
            $pipArgs = $PythonInfo.Args + @("-m", "pip", "install", "lxml", "--user", "--quiet")
            & $PythonInfo.Command @pipArgs 2>&1
        }
        return ($LASTEXITCODE -eq 0)
    } catch {
        return $false
    }
}

# --- Main ---

$pythonInfo = Find-Python
if (-not $pythonInfo) {
    Write-Error @"
[ERROR] Python 3 not found.

Please install Python 3.8+ and ensure it is in PATH:
  - Windows: https://www.python.org/downloads/
  - Ubuntu/Debian: sudo apt install python3 python3-pip
  - macOS: brew install python3

After installation, re-run this script.
"@
    exit 1
}

Write-Host "[INFO] Python found: $($pythonInfo.Command) $($pythonInfo.Args -join ' ')" -ForegroundColor Green

if (-not (Test-LxmlInstalled $pythonInfo)) {
    $installed = Install-Lxml $pythonInfo
    if (-not $installed) {
        Write-Error @"
[ERROR] Failed to install lxml.

Please install manually:
  $($pythonInfo.Command) $($pythonInfo.Args -join ' ') -m pip install lxml
"@
        exit 1
    }
    Write-Host "[INFO] lxml installed successfully." -ForegroundColor Green
}

$scriptDir = $PSScriptRoot
if (-not $scriptDir) {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}
$pythonScript = Join-Path $scriptDir "dep-analyzer.py"

if (-not (Test-Path $pythonScript)) {
    Write-Error "[ERROR] dep-analyzer.py not found at: $pythonScript"
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

$allArgs = $pythonInfo.Args + @($pythonScript) + $arguments

Write-Host "[INFO] Running: $($pythonInfo.Command) $($allArgs -join ' ')" -ForegroundColor Cyan

& $pythonInfo.Command @allArgs

if ($LASTEXITCODE -ne 0) {
    Write-Error "[ERROR] dep-analyzer.py exited with code $LASTEXITCODE"
    exit $LASTEXITCODE
}
