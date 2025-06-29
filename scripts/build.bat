@echo off
REM RSS Discord Transfer Lambda Function - Windows Build Script
REM This script compiles TypeScript, installs production dependencies, and creates a ZIP package

echo Starting build process for RSS Discord Transfer Lambda Function...

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed or not in PATH
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: npm is not installed or not in PATH
    exit /b 1
)

echo Step 1: Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo Error: Failed to install dependencies
    exit /b 1
)

echo Step 2: Running tests...
call npm test
if %errorlevel% neq 0 (
    echo Error: Tests failed
    exit /b 1
)

echo Step 3: Running lint check...
call npm run lint
if %errorlevel% neq 0 (
    echo Error: Lint check failed
    exit /b 1
)

echo Step 4: Building TypeScript...
call npm run build
if %errorlevel% neq 0 (
    echo Error: TypeScript compilation failed
    exit /b 1
)

echo Step 5: Creating deployment package...
if exist "deployment" rmdir /s /q "deployment"
mkdir deployment
mkdir deployment\node_modules

REM Copy compiled JavaScript files
xcopy /s /e "dist\*" "deployment\" >nul
if %errorlevel% neq 0 (
    echo Error: Failed to copy compiled files
    exit /b 1
)

REM Install production dependencies in deployment directory
cd deployment
copy ..\package.json package.json >nul
call npm install --production
if %errorlevel% neq 0 (
    echo Error: Failed to install production dependencies
    cd ..
    exit /b 1
)
del package.json >nul 2>&1
del package-lock.json >nul 2>&1
cd ..

echo Step 6: Creating ZIP package...
powershell -Command "Compress-Archive -Path deployment\* -DestinationPath rss-discord-transfer.zip -Force"
if %errorlevel% neq 0 (
    echo Error: Failed to create ZIP package
    exit /b 1
)

echo Step 7: Cleaning up temporary files...
rmdir /s /q "deployment"

echo.
echo ========================================
echo Build completed successfully!
echo Package: rss-discord-transfer.zip
echo Size: 
for %%A in (rss-discord-transfer.zip) do echo %%~zA bytes
echo ========================================
echo.
echo Upload the ZIP file to AWS Lambda manually:
echo 1. Go to AWS Lambda Console
echo 2. Create or update your function
echo 3. Upload rss-discord-transfer.zip
echo 4. Set the handler to: lambda-handler.handler
echo 5. Configure environment variables
echo.
