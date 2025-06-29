import { S3Client, GetObjectCommand, PutObjectCommand, NoSuchKey } from '@aws-sdk/client-s3';
import { sdkStreamMixin } from '@aws-sdk/util-stream-node';
import { Readable } from 'stream';
import { AppState, FeedState } from '../types/state';

/**
 * S3 state manager for RSS Discord transfer application
 */
export class StateManager {
  private s3: S3Client;
  private bucketName: string;
  private stateKey: string;

  constructor(s3: S3Client, bucketName: string, stateKey: string) {
    this.s3 = s3;
    this.bucketName = bucketName;
    this.stateKey = stateKey;
  }

  private getDefaultState(): AppState {
    return {
      feeds: {},
      lastCheckedAt: new Date(0).toISOString(), // Epoch time
    };
  }

  private isValidState(state: unknown): state is AppState {
    return (
      typeof state === 'object' &&
      state !== null &&
      typeof (state as Record<string, unknown>).feeds === 'object' &&
      (state as Record<string, unknown>).feeds !== null &&
      typeof (state as Record<string, unknown>).lastCheckedAt === 'string'
    );
  }

  async loadState(): Promise<AppState> {
    try {
      const output = await this.s3.send(new GetObjectCommand({ Bucket: this.bucketName, Key: this.stateKey }));
      if (!output.Body) return this.getDefaultState();
      const body = await sdkStreamMixin(output.Body as Readable).transformToString();
      if (!body) return this.getDefaultState();

      try {
        const parsedState = JSON.parse(body);
        if (!this.isValidState(parsedState)) {
          return this.getDefaultState();
        }
        return parsedState;
      } catch (parseError) {
        return this.getDefaultState();
      }
    } catch (error) {
      if (this.isNoSuchKeyError(error)) {
        return this.getDefaultState();
      }
      throw new Error(`Failed to load state: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private isNoSuchKeyError(error: unknown): error is NoSuchKey {
    return error instanceof Error && error.name === 'NoSuchKey';
  }

  async saveState(state: AppState): Promise<void> {
    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: this.stateKey,
          Body: JSON.stringify(state, null, 2),
          ContentType: 'application/json',
        }),
      );
    } catch (error) {
      throw new Error(`Failed to save state: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateFeedState(feedUrl: string, feedState: Partial<FeedState>): Promise<void> {
    const currentState = await this.loadState();
    const now = new Date().toISOString();

    const existingFeedState = currentState.feeds[feedUrl] || {};

    currentState.feeds[feedUrl] = {
      ...existingFeedState,
      ...feedState,
      lastCheckedAt: now,
    } as FeedState;

    await this.saveState(currentState);
  }
}
