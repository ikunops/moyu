@echo off
REM ============================================================
REM  Bitan Pond - desktop koi pond (top-down koi wallpaper)
REM  One-click build.  Requirements: 64-bit Windows only.
REM  Uses the .NET Framework csc shipped with Windows,
REM  so no Visual Studio / dotnet SDK is needed.
REM  WebView2 SDK is downloaded automatically from NuGet.
REM ============================================================
setlocal
cd /d "%~dp0"

set "CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%CSC%" (
  echo [ERROR] csc.exe not found. 64-bit Windows required.
  pause & exit /b 1
)

set "SDKVER=1.0.2903.40"
set "SDK=build\wv2"

if not exist "%SDK%\lib\net462\Microsoft.Web.WebView2.Core.dll" (
  echo [1/3] Downloading WebView2 SDK %SDKVER% ...
  if not exist build mkdir build
  curl -sSL -o "build\wv2.zip" ^
    "https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/%SDKVER%/microsoft.web.webview2.%SDKVER%.nupkg"
  if errorlevel 1 (
    echo [ERROR] download failed, check your network
    pause & exit /b 1
  )
  powershell -NoProfile -Command "Expand-Archive -LiteralPath 'build\wv2.zip' -DestinationPath '%SDK%' -Force"
  if errorlevel 1 (
    echo [ERROR] extract failed
    pause & exit /b 1
  )
)

echo [2/3] Compiling host ...
"%CSC%" /nologo /target:winexe /platform:x64 /out:build\BitanPond.exe ^
  /r:"%SDK%\lib\net462\Microsoft.Web.WebView2.Core.dll" ^
  /r:"%SDK%\lib\net462\Microsoft.Web.WebView2.WinForms.dll" ^
  /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Core.dll ^
  src\PondHost.cs
if errorlevel 1 ( echo [ERROR] compile failed & pause & exit /b 1 )

echo [3/3] Assembling run folder ...
if not exist build\run mkdir build\run
copy /y src\*.js          build\run\ >nul
copy /y src\index.html    build\run\ >nul
copy /y build\BitanPond.exe build\run\ >nul
copy /y "%SDK%\lib\net462\Microsoft.Web.WebView2.Core.dll"     build\run\ >nul
copy /y "%SDK%\lib\net462\Microsoft.Web.WebView2.WinForms.dll" build\run\ >nul
copy /y "%SDK%\runtimes\win-x64\native\WebView2Loader.dll"     build\run\ >nul

echo.
echo ============================================
echo  Build OK:  build\run\BitanPond.exe
echo  Double-click it. The koi pond attaches
echo  to the desktop wallpaper layer.
echo ============================================
pause
