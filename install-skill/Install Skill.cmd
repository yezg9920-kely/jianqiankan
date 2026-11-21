@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
  py -3 "%~dp0install-skill.py" %*
) else (
  python "%~dp0install-skill.py" %*
)
if errorlevel 1 (
  echo Skill installation failed. Please make sure Python 3.10+ is available.
  pause
  exit /b 1
)
echo Skill installation complete.
pause

