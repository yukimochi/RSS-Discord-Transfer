/**
 * Application state structure stored in S3
 */
export interface AppState {
  readonly lastCheckedAt: string; // ISO 8601 string
  readonly feeds: Record<string, FeedState>;
}

/**
 * Per-feed state information
 */
export interface FeedState {
  readonly lastCheckedAt: string; // ISO 8601 string
  readonly lastProcessedItemId?: string;
  readonly errorCount: number;
  readonly lastError?: string;
}

/**
 * Environment variables interface
 */
export interface EnvironmentVariables {
  readonly RSS_FEED_URLS: string;
  readonly DISCORD_WEBHOOK_URL: string;
  readonly ERROR_WEBHOOK_URL?: string;
  readonly S3_BUCKET_NAME: string;
  readonly S3_STATE_KEY?: string;
}

/**
 * Lambda handler configuration
 */
export interface LambdaConfig {
  readonly feedUrls: string[];
  readonly discordWebhookUrl: string;
  readonly errorWebhookUrl: string;
  readonly s3BucketName: string;
  readonly s3StateKey: string;
}
