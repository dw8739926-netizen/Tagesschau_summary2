@echo off
pushd "%~dp0"
set "PATH=%PATH%;C:\Program Files\nodejs"
echo Starte Tagesschau Projekt...
echo (Stelle sicher, dass du deine Keys in .env.local eingetragen hast!)
echo.
call npm.cmd run dev
pause
