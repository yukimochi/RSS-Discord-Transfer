/**
 * Discord webhook payload structure
 */
export interface DiscordWebhookPayload {
  readonly content: string;
  readonly username?: string;
  readonly avatar_url?: string;
}

/**
 * Discord message formatting options
 */
export interface DiscordMessageOptions {
  readonly includeTimestamp: boolean;
  readonly maxContentLength: number;
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Error information for Discord notifications
 */
export interface ErrorInfo {
  readonly type: string;
  readonly message: string;
  readonly severity: ErrorSeverity;
  readonly timestamp: Date;
  readonly feedUrl?: string;
  readonly details?: Record<string, unknown>;
}

/**
 * HTTP response interface
 */
export interface HttpResponse {
  readonly statusCode: number;
  readonly data: string;
  readonly headers: Record<string, string>;
}

/**
 * HTTP request options
 */
export interface HttpRequestOptions {
  readonly timeout: number;
  readonly retries: number;
  readonly headers?: Record<string, string>;
}
