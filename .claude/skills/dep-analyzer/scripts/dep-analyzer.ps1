<#
.SYNOPSIS
    PowerShell-обёртка для dep-analyzer — анализатора зависимостей метаданных 1С.

.DESCRIPTION
    Находит Python, устанавливает lxml при необходимости, запускает dep-analyzer.py.
    Совместимо с PowerShell 5.1 (Windows) и PowerShell Core 7+ (Linux/macOS).

.PARAMETER ConfigPath
    Путь к каталогу выгрузки конфигурации 1С.

.PARAMETER Mode
    Режим работы: deps, debug, rights, full.

.PARAMETER Target
    Целевой объект метаданных (например, "Document.РеализацияТоваровУслуг").

.PARAMETER Depth
    Глубина обхода графа зависимостей.

.PARAMETER OutFormat
    Формат вывода: text, json, md.

.PARAMETER Limit
    Максимальное количество записей.

.PARAMETER Offset
    Смещение для пагинации.

.PARAMETER OutFile
    Путь к файлу для сохранения результата.

.EXAMPLE
    .\dep-analyzer.ps1 -ConfigPath "C:\MyConfig" -Mode deps -Target "Document.РеализацияТоваровУслуг"

.EXAMPLE
    .\dep-analyzer.ps1 -ConfigPath "./config" -Mode full -Target "Catalog.*" -OutFormat json -OutFile result.json
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$ConfigPath,

    [ValidateSet("deps", "debug", "rights", "full")]
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

$OutputEncoding = [System.Text.UTF8Encoding]::new()
if ($null -ne [Console]::OutputEncoding) {
    try { [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new() } catch {}
}

function Find-Python {
    $candidates = @("python3", "python", "py")

    foreach ($cmd in $candidates) {
        try {
            if ($cmd -eq "py") {
                $result = & py -3 --version 2>&1
                if ($LASTEXITCODE -eq 0) {
                    return @{ Cmd = "py"; Args = @("-3") }
                }
            }
            else {
                $result = & $cmd --version 2>&1
                if ($LASTEXITCODE -eq 0) {
                    $versionStr = "$result"
                    if ($versionStr -match "Python\s+3") {
                        return @{ Cmd = $cmd; Args = @() }
                    }
                }
            }
        }
        catch {
            continue
        }
    }

    return $null
}

function Test-LxmlInstalled {
    param([hashtable]$PythonInfo)

    $testArgs = $PythonInfo.Args + @("-c", "import lxml; print('ok')")
    try {
        $result = & $PythonInfo.Cmd @testArgs 2>&1
        return ($LASTEXITCODE -eq 0 -and "$result" -match "ok")
    }
    catch {
        return $false
    }
}

function Install-Lxml {
    param([hashtable]$PythonInfo)

    Write-Host "[dep-analyzer] Установка lxml..." -ForegroundColor Yellow

    $pipArgs = $PythonInfo.Args + @("-m", "pip", "install", "lxml", "--quiet")
    try {
        & $PythonInfo.Cmd @pipArgs 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            $pipArgs = $PythonInfo.Args + @("-m", "pip", "install", "lxml", "--user", "--quiet")
            & $PythonInfo.Cmd @pipArgs 2>&1 | Out-Null
        }
    }
    catch {
        Write-Warning "Не удалось установить lxml: $_"
        Write-Warning "Попробуйте вручную: pip install lxml"
    }
}

$pythonInfo = Find-Python

if ($null -eq $pythonInfo) {
    Write-Error @"
[dep-analyzer] Python 3 не найден!

Для работы dep-analyzer требуется Python 3.8+.
Установите Python:
  - Windows: https://www.python.org/downloads/ или winget install Python.Python.3.12
  - macOS: brew install python3
  - Linux: sudo apt install python3 python3-pip

После установки убедитесь, что python3 доступен в PATH.
"@
    exit 1
}

$pythonCmd = $pythonInfo.Cmd
$pythonBaseArgs = $pythonInfo.Args
Write-Verbose "[dep-analyzer] Python: $pythonCmd $($pythonBaseArgs -join ' ')"

if (-not (Test-LxmlInstalled -PythonInfo $pythonInfo)) {
    Install-Lxml -PythonInfo $pythonInfo

    if (-not (Test-LxmlInstalled -PythonInfo $pythonInfo)) {
        Write-Error "[dep-analyzer] lxml не установлен. Установите вручную: pip install lxml"
        exit 1
    }
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pythonScript = Join-Path $scriptDir "dep-analyzer.py"

if (-not (Test-Path $pythonScript)) {
    Write-Error "[dep-analyzer] Скрипт не найден: $pythonScript"
    exit 1
}

$arguments = @(
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

$allArgs = $pythonBaseArgs + @($pythonScript) + $arguments

Write-Verbose "[dep-analyzer] Запуск: $pythonCmd $($allArgs -join ' ')"

& $pythonCmd @allArgs

if ($LASTEXITCODE -ne 0) {
    Write-Error "[dep-analyzer] Скрипт завершился с ошибкой (код: $LASTEXITCODE)"
    exit $LASTEXITCODE
}
