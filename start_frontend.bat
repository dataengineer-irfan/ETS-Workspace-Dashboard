@echo off
echo Starting React Frontend on port 42005...
cd /d "%~dp0frontend"
npm run dev -- --host 0.0.0.0 --port 42005
