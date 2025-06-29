#!/bin/bash
# RSS Discord Transfer Lambda Function - Linux/macOS Build Script
# This script compiles TypeScript, installs production dependencies, and creates a ZIP package

set -e  # Exit on any error

echo "Starting build process for RSS Discord Transfer Lambda Function..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed or not in PATH"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed or not in PATH"
    exit 1
fi

echo "Step 1: Installing dependencies..."
npm install

echo "Step 2: Running tests..."
npm test

echo "Step 3: Running lint check..."
npm run lint

echo "Step 4: Building TypeScript..."
npm run build

echo "Step 5: Creating deployment package..."
rm -rf deployment
mkdir -p deployment/node_modules

# Copy compiled JavaScript files
cp -r dist/* deployment/

# Install production dependencies in deployment directory
cd deployment
cp ../package.json package.json
npm install --production
rm -f package.json package-lock.json
cd ..

echo "Step 6: Creating ZIP package..."
cd deployment
zip -r ../rss-discord-transfer.zip . > /dev/null
cd ..

echo "Step 7: Cleaning up temporary files..."
rm -rf deployment

echo
echo "========================================"
echo "Build completed successfully!"
echo "Package: rss-discord-transfer.zip"
echo "Size: $(du -h rss-discord-transfer.zip | cut -f1)"
echo "========================================"
echo
echo "Upload the ZIP file to AWS Lambda manually:"
echo "1. Go to AWS Lambda Console"
echo "2. Create or update your function"
echo "3. Upload rss-discord-transfer.zip"
echo "4. Set the handler to: lambda-handler.handler"
echo "5. Configure environment variables"
echo
