/**
 * Discord embed object for rich message formatting
 */
export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  timestamp?: string;
  color?: number;
  footer?: {
    text: string;
    icon_url?: string;
  };
  thumbnail?: {
    url: string;
  };
  author?: {
    name: string;
    url?: string;
    icon_url?: string;
  };
  fields?: {
    name: string;
    value: string;
    inline?: boolean;
  }[];
}

/**
 * Discord webhook payload structure
 */
export interface DiscordWebhookPayload {
  content?: string;
  username?: string;
  avatar_url?: string;
  embeds?: DiscordEmbed[];
}

/**
 * Discord message formatting options
 */
export interface DiscordMessageOptions {
  username?: string;
  avatar_url?: string;
  includeTimestamp: boolean;
  maxContentLength: number;
}

/**
 * Error information for Discord notifications
 */
export interface ErrorInfo {
  type: string;
  message: string;
  severity: ErrorSeverity;
  feedUrl?: string;
  details?: Record<string, unknown>;
}

/**
 * Error severity levels
 */
export type ErrorSeverity = 'high' | 'medium' | 'low';
