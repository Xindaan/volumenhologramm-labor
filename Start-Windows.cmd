@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>&1
if not errorlevel 1 (
  py -3 start.py %*
) else (
  where python >nul 2>&1
  if errorlevel 1 (
    echo Python 3 wird benoetigt. Siehe INSTALLATION.md.
    pause
    exit /b 1
  )
  python start.py %*
)
if errorlevel 1 (
  echo Start fehlgeschlagen. Bitte die Meldung oben und INSTALLATION.md lesen.
  pause
  exit /b 1
)
