#!/usr/bin/env node

/**
 * RSS Discord Transfer Lambda Function - Local Test Script
 * This script allows you to test the Lambda function locally
 */

const path = require('path');
const fs = require('fs');

// Load environment variables from .env file if it exists
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envLines = envContent.split('\n');
  
  envLines.forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        process.env[key.trim()] = value;
      }
    }
  });
}

// Check if TypeScript files are compiled
const distPath = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distPath)) {
  console.error('Error: Compiled JavaScript files not found.');
  console.error('Please run the build script first:');
  console.error('  npm run build');
  process.exit(1);
}

// Check required environment variables
const requiredEnvVars = [
  'RSS_FEED_URLS',
  'DISCORD_WEBHOOK_URL',
  'S3_BUCKET_NAME'
];

const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingVars.length > 0) {
  console.error('Error: Missing required environment variables:');
  missingVars.forEach(envVar => {
    console.error(`  - ${envVar}`);
  });
  console.error('\nPlease create a .env file in the project root with the following variables:');
  console.error('RSS_FEED_URLS=https://example.com/rss.xml,https://example2.com/feed.xml');
  console.error('DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_URL');
  console.error('ERROR_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_ERROR_WEBHOOK_URL');
  console.error('S3_BUCKET_NAME=your-s3-bucket-name');
  console.error('S3_STATE_KEY=rss-discord-state.json');
  console.error('AWS_REGION=us-east-1');
  process.exit(1);
}

console.log('Starting local test of RSS Discord Transfer Lambda Function...');
console.log('Configuration:');
console.log(`- RSS Feed URLs: ${process.env.RSS_FEED_URLS}`);
console.log(`- Discord Webhook: ${process.env.DISCORD_WEBHOOK_URL ? 'Set' : 'Not set'}`);
console.log(`- Error Webhook: ${process.env.ERROR_WEBHOOK_URL ? 'Set' : 'Using main webhook'}`);
console.log(`- S3 Bucket: ${process.env.S3_BUCKET_NAME}`);
console.log(`- S3 State Key: ${process.env.S3_STATE_KEY || 'rss-discord-state.json'}`);
console.log(`- AWS Region: ${process.env.AWS_REGION || 'us-east-1'}`);
console.log('');

// Import and run the Lambda handler
async function runTest() {
  try {
    // Import the compiled handler
    const { handler } = require('../dist/lambda-handler');
    
    // Create mock event and context
    const mockEvent = {
      version: '0',
      id: 'test-event-id',
      'detail-type': 'Scheduled Event',
      source: 'aws.events',
      account: '123456789012',
      time: new Date().toISOString(),
      region: process.env.AWS_REGION || 'us-east-1',
      resources: ['arn:aws:events:us-east-1:123456789012:rule/test-rule'],
      detail: {}
    };
    
    const mockContext = {
      callbackWaitsForEmptyEventLoop: true,
      functionName: 'rss-discord-transfer-test',
      functionVersion: '$LATEST',
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:rss-discord-transfer-test',
      memoryLimitInMB: '512',
      awsRequestId: 'test-request-id',
      logGroupName: '/aws/lambda/rss-discord-transfer-test',
      logStreamName: '2024/01/01/[$LATEST]test-stream',
      getRemainingTimeInMillis: () => 30000,
      done: () => {},
      fail: () => {},
      succeed: () => {}
    };
    
    console.log('Executing Lambda handler...');
    const startTime = Date.now();
    
    await handler(mockEvent, mockContext);
    
    const endTime = Date.now();
    const executionTime = endTime - startTime;
    
    console.log('');
    console.log('========================================');
    console.log('Local test completed successfully!');
    console.log(`Execution time: ${executionTime}ms`);
    console.log('========================================');
    
  } catch (error) {
    console.error('');
    console.error('========================================');
    console.error('Local test failed with error:');
    console.error(error);
    console.error('========================================');
    process.exit(1);
  }
}

runTest();
