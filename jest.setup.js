// Jest setup file for global test configuration

// Mock AWS SDK for testing
jest.mock('@aws-sdk/client-s3');

// Set up global test timeout
jest.setTimeout(10000);

// Global test environment setup
process.env.NODE_ENV = 'test';
