$ErrorActionPreference = "Stop"
$PythonExe = "C:\Users\lopez\AppData\Local\Python\pythoncore-3.14-64\python.exe"

if (-Not (Test-Path "venv")) {
    Write-Host "Creando entorno virtual..."
    & $PythonExe -m venv venv
}

Write-Host "Instalando dependencias (Selenium y Pygal)..."
& .\venv\Scripts\python.exe -m pip install -r requirements_fallback.txt

Write-Host "Ejecutando pruebas funcionales..."
& .\venv\Scripts\python.exe -m pytest tests/ --json-report --json-report-file=.report.json

Write-Host "Generando gráficos para el informe..."
& .\venv\Scripts\python.exe generar_reporte.py

Write-Host "Generando documento Word para el informe..."
& .\venv\Scripts\python.exe generar_word.py

Write-Host "Proceso completado. Revisa la carpeta 'reports' para ver los gráficos y el informe Word."
