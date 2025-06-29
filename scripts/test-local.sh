#!/bin/bash
# RSS Discord Transfer Lambda Function - Linux/macOS Local Test Script

set -e

echo "Starting local test for RSS Discord Transfer Lambda Function..."
echo

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed or not in PATH"
    exit 1
fi

# Check if build exists
if [ ! -f "dist/lambda-handler.js" ]; then
    echo "Error: Compiled JavaScript files not found."
    echo "Please run the build script first:"
    echo "  npm run build"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "Warning: .env file not found."
    echo "Please create a .env file based on scripts/env.example"
    echo "with your actual configuration values."
    echo
    echo "Required environment variables:"
    echo "- RSS_FEED_URLS"
    echo "- DISCORD_WEBHOOK_URL"
    echo "- S3_BUCKET_NAME"
    echo
    read -p "Press Enter to continue anyway, or Ctrl+C to exit..."
    exit 1
fi

echo "Running local test..."
echo

node scripts/test-local.js

echo
echo "Local test completed."
