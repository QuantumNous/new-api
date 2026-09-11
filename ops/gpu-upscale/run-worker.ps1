$env:PYTHONPATH = Split-Path $PSScriptRoot -Parent
$engineRoot = $env:PYTHONPATH
Set-Location $PSScriptRoot
& "$engineRoot\.venv\Scripts\python.exe" -u "$PSScriptRoot\worker.py" --config "$PSScriptRoot\config.json" *> "$PSScriptRoot\worker.log"
exit $LASTEXITCODE
