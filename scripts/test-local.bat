@echo off
REM RSS Discord Transfer Lambda Function - Windows Local Test Script

echo Starting local test for RSS Discord Transfer Lambda Function...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed or not in PATH
    exit /b 1
)

REM Check if build exists
if not exist "dist\lambda-handler.js" (
    echo Error: Compiled JavaScript files not found.
    echo Please run the build script first:
    echo   npm run build
    exit /b 1
)

REM Check if .env file exists
if not exist ".env" (
    echo Warning: .env file not found.
    echo Please create a .env file based on scripts\env.example
    echo with your actual configuration values.
    echo.
    echo Required environment variables:
    echo - RSS_FEED_URLS
    echo - DISCORD_WEBHOOK_URL  
    echo - S3_BUCKET_NAME
    echo.
    pause
    exit /b 1
)

echo Running local test...
echo.

node scripts\test-local.js

echo.
echo Local test completed.
pause
