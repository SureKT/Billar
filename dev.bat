@echo off
cd /d "%~dp0"

:: Arrancar backend y frontend minimizados
start /min "Billar - Backend"  cmd /k "cd /d "%~dp0" && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
start /min "Billar - Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

:: Esperar a que Vite arranque y abrir navegador
timeout /t 3 /nobreak >nul
start http://localhost:5173

:: Info — esta ventana se queda abierta
echo.
echo  ==========================================
echo    BILLAR  -  Entorno de desarrollo
echo  ==========================================
echo.
echo  Backend:   http://localhost:8000
echo  Frontend:  http://localhost:5173
echo.
echo  Para parar: cierra las ventanas minimizadas
echo              "Billar - Backend" y "Billar - Frontend".
echo  ==========================================
echo.
pause
