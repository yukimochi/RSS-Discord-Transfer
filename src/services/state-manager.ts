import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { AppState, FeedState } from '../types';

/**
 * S3 state manager for RSS Discord transfer application
 */
export class StateManager {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly stateKey: string;

  constructor(bucketName: string, stateKey = 'rss-discord-state.json') {
    this.s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
    this.bucketName = bucketName;
    this.stateKey = stateKey;
  }

  /**
   * Load application state from S3
   */
  async loadState(): Promise<AppState> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: this.stateKey,
      });

      const response = await this.s3Client.send(command);
      
      if (!response.Body) {
        return this.getDefaultState();
      }

      const stateData = await response.Body.transformToString();
      
      try {
        const parsedState = JSON.parse(stateData) as AppState;
        
        // Validate state structure
        if (!this.isValidState(parsedState)) {
          console.warn('Invalid state structure found, using default state');
          return this.getDefaultState();
        }

        return parsedState;
      } catch (parseError) {
        console.warn('Failed to parse state JSON, using default state:', parseError);
        return this.getDefaultState();
      }
    } catch (error) {
      if (this.isNoSuchKeyError(error)) {
        console.log('State file not found, creating default state');
        return this.getDefaultState();
      }
      
      console.error('Error loading state from S3:', error);
      throw new Error(`Failed to load state: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save application state to S3
   */
  async saveState(state: AppState): Promise<void> {
    try {
      const stateData = JSON.stringify(state, null, 2);
      
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: this.stateKey,
        Body: stateData,
        ContentType: 'application/json',
      });

      await this.s3Client.send(command);
      console.log('State saved successfully to S3');
    } catch (error) {
      console.error('Error saving state to S3:', error);
      throw new Error(`Failed to save state: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update feed state for a specific feed URL
   */
  async updateFeedState(feedUrl: string, feedState: Partial<FeedState>): Promise<void> {
    const currentState = await this.loadState();
    
    const existingFeedState = currentState.feeds[feedUrl] || {
      lastCheckedAt: new Date().toISOString(),
      errorCount: 0,
    };

    const updatedFeedState: FeedState = {
      ...existingFeedState,
      ...feedState,
    };

    const updatedState: AppState = {
      ...currentState,
      feeds: {
        ...currentState.feeds,
        [feedUrl]: updatedFeedState,
      },
    };

    await this.saveState(updatedState);
  }

  /**
   * Get default application state
   */
  private getDefaultState(): AppState {
    return {
      lastCheckedAt: new Date().toISOString(),
      feeds: {},
    };
  }

  /**
   * Validate state object structure
   */
  private isValidState(state: unknown): state is AppState {
    if (typeof state !== 'object' || state === null) {
      return false;
    }

    const stateObj = state as Record<string, unknown>;
    
    return (
      typeof stateObj.lastCheckedAt === 'string' &&
      typeof stateObj.feeds === 'object' &&
      stateObj.feeds !== null
    );
  }

  /**
   * Check if error is a NoSuchKey error from S3
   */
  private isNoSuchKeyError(error: unknown): boolean {
    return (
      error instanceof Error &&
      'name' in error &&
      error.name === 'NoSuchKey'
    );
  }
}
