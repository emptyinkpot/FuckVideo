@echo off
setlocal
rem earth3d terrain data: check and rebuild only what is missing or out of date.
rem   Double-click        full check (including every file against assets.sha256), rebuild as needed, progress window.
rem   rebuild.bat --if-needed   quick check used by start.bat (about a second); starts the rebuild
rem                             in the background only when something is missing or out of date.
rem Existing data is never re-downloaded or deleted. See pipeline/build_all.py.
cd /d "%~dp0pipeline"
set "VENV=%~dp0.cache\venv"

if not exist "%VENV%\Scripts\python.exe" (
    echo earth3d: creating the Python environment for the data pipeline...
    where uv >nul 2>&1
    if not errorlevel 1 (
        uv venv --python 3.13 "%VENV%" && uv pip install --python "%VENV%\Scripts\python.exe" -r requirements.txt
    ) else (
        py -3.13 -m venv "%VENV%" && "%VENV%\Scripts\python.exe" -m pip install -r requirements.txt
    )
    if errorlevel 1 (
        echo earth3d: failed to create the Python environment. Python 3.13 or uv is required.
        if /i not "%~1"=="--if-needed" pause
        exit /b 1
    )
)

rem These data hosts are faster without the local proxy.
set "NO_PROXY=elevation-tiles-prod.s3.amazonaws.com,esa-worldcover.s3.eu-central-1.amazonaws.com,data.hydrosheds.org,naciscdn.org"
set "no_proxy=%NO_PROXY%"

if /i "%~1"=="--if-needed" (
    "%VENV%\Scripts\python.exe" build_all.py --if-needed
    exit /b 0
)

rem Run in the background without a console; build_all.py opens the progress window itself.
start "" "%VENV%\Scripts\pythonw.exe" build_all.py
exit /b 0
