@echo off
cd /d "%~dp0"

:: Detectar IP local
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /r "Direcci.n IPv4.*192\.168"') do set IP=%%a
if "%IP%"=="" (
  for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /r "IPv4.*192\.168"') do set IP=%%a
)
set IP=%IP: =%

:: Arrancar servidor en ventana minimizada
start /min "Billar - Servidor" cmd /k "cd /d "%~dp0" && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"

:: Abrir navegador
start http://localhost:8000