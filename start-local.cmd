@echo off
cd /d "%~dp0"
call npm install --no-fund
if errorlevel 1 goto end
start "" "http://127.0.0.1:8080/"
call npm start
:end
pause
