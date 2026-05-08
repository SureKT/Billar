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

:: Esperar a que arranque y abrir navegador
timeout /t 2 /nobreak >nul
start http://localhost:8000

:: Info — esta ventana se queda abierta
echo.
echo  ==========================================
echo    BILLAR  -  Servidor activo
echo  ==========================================
echo.
echo  Local:   http://localhost:8000
if not "%IP%"=="" (
  echo  Movil:   http://%IP%:8000
)
echo.
echo  Para parar: cierra la ventana minimizada
echo              "Billar - Servidor".
echo  ==========================================
echo.
pause
