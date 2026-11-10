@echo off
rem Builds FuckVideo.exe into the repo root with the C# compiler bundled in Windows (.NET Framework 4.x).
setlocal
set "CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%CSC%" set "CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe"
if not exist "%CSC%" (
  echo csc.exe not found. .NET Framework 4.x is required.
  exit /b 1
)
"%CSC%" /nologo /target:winexe /optimize+ /out:"%~dp0..\FuckVideo.exe" /r:System.Windows.Forms.dll /r:System.Drawing.dll "%~dp0FuckVideo.cs"
