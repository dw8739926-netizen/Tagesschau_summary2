@echo off
set "GIT_PATH=%~dp0bin\git\cmd"
set "PATH=%GIT_PATH%;%PATH%"
echo Starting Git GUI...
start "" "%GIT_PATH%\git-gui.exe"
