@echo off
setlocal
cd /d "%~dp0"

rem Generated data: every module under src\ that has a rebuild.bat gets a quick check.
rem Up-to-date modules pass silently; out-of-date ones rebuild in the background
rem (with a progress window) while Studio starts. A failed check never blocks startup.
for /d %%d in ("%~dp0src\*") do (
    if exist "%%d\rebuild.bat" call "%%d\rebuild.bat" --if-needed
)
cd /d "%~dp0"

echo Checking Remotion versions...
call npm outdated remotion @remotion/bundler @remotion/cli @remotion/renderer @remotion/studio @remotion/three @remotion/zod-types @remotion/eslint-config-flat --json >nul 2>&1
if errorlevel 1 (
    echo A Remotion update is available. Updating the Remotion packages...
    call npm run upgrade -- --skip-skills --log=info
    if errorlevel 1 (
        echo Remotion update failed. Starting with the installed packages.
    )
) else (
    echo Remotion packages are up to date.
)

echo Starting Remotion Studio...
call npm run dev
set "EXIT_CODE=%ERRORLEVEL%"
exit /b %EXIT_CODE%
