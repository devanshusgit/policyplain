@echo off
cd /d "%~dp0"
echo.
echo ================================
echo  PolicyPlain - Git Setup
echo ================================
echo.
echo Current folder: %CD%
echo.

git --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Git is not installed!
    echo Please download it from https://git-scm.com/download/win
    pause
    exit /b
)

echo [1/3] Initializing git...
git init

echo.
echo [2/3] Adding all files...
git add .

echo.
echo [3/3] Creating first commit...
git commit -m "PolicyPlain v1"

echo.
echo ================================
echo  DONE! Git setup complete.
echo ================================
echo.
echo Next steps:
echo 1. Go to github.com and create a NEW repo called: policyplain
echo 2. Copy the commands GitHub gives you (git remote add origin ...)
echo 3. Run those commands in PowerShell
echo.
pause
