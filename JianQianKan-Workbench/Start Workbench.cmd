@echo off
setlocal DisableDelayedExpansion
pushd "%~dp0"
if errorlevel 1 exit /b 1
where node.exe >nul 2>&1
if errorlevel 1 (
  echo Please install Node.js 22 or later from https://nodejs.org/ and reopen this window.
  if /i not "%~1"=="--no-open" pause
  popd
  exit /b 1
)
node tools\start-release.mjs --open %*
set "WORKBENCH_EXIT=%ERRORLEVEL%"
if not "%WORKBENCH_EXIT%"=="0" if /i not "%~1"=="--no-open" pause
popd
exit /b %WORKBENCH_EXIT%
