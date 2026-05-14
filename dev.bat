@echo off
cd /d "%~dp0"

:: Arrancar backend y frontend minimizados
start /min "Billar - Backend"  cmd /k "cd /d "%~dp0" && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
start /min "Billar - Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

:: Abrir navegador
start http://localhost:5173
