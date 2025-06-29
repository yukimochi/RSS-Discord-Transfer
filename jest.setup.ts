// Jest setup file for global test configuration
// This file runs before each test file

import { jest } from '@jest/globals';

// Mock AWS SDK for testing
jest.mock('@aws-sdk/client-s3');

// Set up global test timeout
jest.setTimeout(10000);
