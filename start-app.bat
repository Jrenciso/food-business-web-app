@echo off
setlocal
cd /d "%~dp0"

set "BUNDLED_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
set "NODE_BIN=node"
where node >nul 2>nul
if errorlevel 1 goto try_bundled
for /f %%v in ('node -p "parseInt(process.versions.node.split('.')[0])"') do set "NODE_MAJOR=%%v"
if not defined NODE_MAJOR goto try_bundled
if %NODE_MAJOR% LSS 18 goto try_bundled
goto node_ready
:try_bundled
if exist "%BUNDLED_NODE%" (
  set "NODE_BIN=%BUNDLED_NODE%"
  set "PATH=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%PATH%"
) else (
  echo Node.js 18 or newer is required. Install Node.js LTS, then reopen this file.
  echo https://nodejs.org/
  pause
  exit /b 1
)
:node_ready
where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Install Node.js LTS, then reopen this file.
  pause
  exit /b 1
)

if not exist "node_modules\vite\bin\vite.js" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

echo Starting the food business app. Keep this window open while you use it.
echo Vite will open the app in your browser when the server is ready.
"%NODE_BIN%" node_modules\vite\bin\vite.js --host 0.0.0.0 --open
if errorlevel 1 (
  echo The app did not start. Check the messages above and the project README.
  pause
  exit /b 1
)

endlocal
