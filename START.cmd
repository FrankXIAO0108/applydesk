@echo off
setlocal
cd /d "%~dp0"
set "APPLYDESK_NODE="
for /f "delims=" %%N in ('where node.exe 2^>nul') do if not defined APPLYDESK_NODE set "APPLYDESK_NODE=%%N"
if defined APPLYDESK_NODE (
  "%APPLYDESK_NODE%" -e "let v=process.versions.node.split('.').map(Number);process.exit(v[0]>22||v[0]===22&&v[1]>=13?0:1)"
  if errorlevel 1 set "APPLYDESK_NODE="
)
if not defined APPLYDESK_NODE if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "APPLYDESK_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not defined APPLYDESK_NODE (
  echo Node runtime not found. Open this folder in Codex and ask it to follow START_HERE.md.
  pause
  exit /b 1
)
"%APPLYDESK_NODE%" scripts\start.mjs --open
if errorlevel 1 pause
