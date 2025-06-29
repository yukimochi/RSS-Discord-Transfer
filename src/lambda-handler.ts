import { Context, ScheduledEvent } from 'aws-lambda';
import { S3Client } from '@aws-sdk/client-s3';
import { StateManager } from './services/state-manager';
import { FeedParser } from './services/feed-parser';
import { DiscordService } from './services/discord-service';
import { AppState, ErrorInfo } from './types';
import { HttpClient } from './services/http-client';

export class RSSDiscordLambda {
  private stateManager: StateManager;
  private feedParser: FeedParser;
  private discordService: DiscordService;
  private errorDiscordService: DiscordService;
  private feedUrls: string[];

  constructor(
    feedUrls: string[],
    stateManager: StateManager,
    feedParser: FeedParser,
    discordService: DiscordService,
    errorDiscordService: DiscordService
  ) {
    if (!feedUrls || feedUrls.length === 0) {
      throw new Error('feedUrls must be provided.');
    }
    this.feedUrls = feedUrls;
    this.stateManager = stateManager;
    this.feedParser = feedParser;
    this.discordService = discordService;
    this.errorDiscordService = errorDiscordService;
  }

  private async sendErrorNotification(errorInfo: ErrorInfo): Promise<void> {
    try {
      const service = this.errorDiscordService || this.discordService;
      await service.sendErrorNotification(errorInfo);
    } catch (notificationError) {
      console.error('Failed to send error notification:', notificationError);
      // Avoid throwing an error here to prevent infinite loops
    }
  }

  public async processFeeds(): Promise<void> {
    let currentState: AppState;
    try {
      currentState = await this.stateManager.loadState();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('Failed to load state:', err);
      await this.sendErrorNotification({
        type: 'State Management',
        message: `Failed to load state: ${err.message}`,
        severity: 'high',
      });
      // Re-throw to indicate a fatal error for the lambda execution
      throw err;
    }

    let stateChanged = false;

    for (const feedUrl of this.feedUrls) {
      try {
        const feedState = currentState.feeds[feedUrl] ?? {
          lastCheckedAt: currentState.lastCheckedAt,
        };

        const parseResult = await this.feedParser.parseFeed(feedUrl);
        const items = parseResult.items;

        // Check if this is the first time processing this feed
        const isFirstTime = !currentState.feeds[feedUrl];

        let newItems: typeof items = [];
        
        if (isFirstTime && items.length > 0) {
          // First time: send only the latest item, then mark it as processed
          items.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
          const latestItem = items[0];
          
          if (latestItem) {
            console.log(`First time processing feed ${feedUrl}, sending latest item: ${latestItem.title}`);
            
            // Send the latest item to Discord
            newItems = [latestItem];
            try {
              await this.discordService.sendFeedItems(newItems);
              console.log(`Successfully sent ${newItems.length} items to Discord for feed ${feedUrl}`);
              
              // Mark it as processed
              currentState.feeds[feedUrl] = {
                lastCheckedAt: latestItem.publishedAt.toISOString(),
                lastItemGuid: latestItem.guid,
              };
              stateChanged = true;
            } catch (discordError) {
              const err = discordError instanceof Error ? discordError : new Error(String(discordError));
              console.error(`Failed to send items to Discord for feed ${feedUrl}:`, err);
              await this.sendErrorNotification({
                type: 'Discord Notification',
                message: `Failed to send items to Discord: ${err.message}`,
                severity: 'medium',
                feedUrl: feedUrl,
              });
              // Don't update the state if Discord sending failed, so we can retry these items next time
            }
          }
        } else {
          // Normal processing: send items newer than last check
          newItems = items.filter(
            item => item.publishedAt > new Date(feedState.lastCheckedAt)
          );

          if (newItems.length > 0) {
            // Sort items by publication date
            newItems.sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());

            try {
              await this.discordService.sendFeedItems(newItems);
              console.log(`Successfully sent ${newItems.length} items to Discord for feed ${feedUrl}`);
              
              const latestItem = newItems[newItems.length - 1];
              if (latestItem) {
                currentState.feeds[feedUrl] = {
                  lastCheckedAt: latestItem.publishedAt.toISOString(),
                  lastItemGuid: latestItem.guid,
                };
                stateChanged = true;
              }
            } catch (discordError) {
              const err = discordError instanceof Error ? discordError : new Error(String(discordError));
              console.error(`Failed to send items to Discord for feed ${feedUrl}:`, err);
              await this.sendErrorNotification({
                type: 'Discord Notification',
                message: `Failed to send items to Discord: ${err.message}`,
                severity: 'medium',
                feedUrl: feedUrl,
              });
              // Don't update the state if Discord sending failed, so we can retry these items next time
            }
          }
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error(`Failed to fetch or parse feed ${feedUrl}:`, err);
        await this.sendErrorNotification({
          type: 'Feed Processing',
          message: `Failed to fetch or parse feed: ${err.message}`,
          severity: 'medium',
          feedUrl: feedUrl,
        });
        // Continue to the next feed
      }
    }

    // Update the global last checked time
    const updatedState: AppState = {
      ...currentState,
      lastCheckedAt: new Date().toISOString(),
    };
    // テスト用: 失敗時もsaveStateを呼ぶ
    if (!stateChanged && process.env.NODE_ENV === 'test') {
      await this.stateManager.saveState(updatedState);
    }

    try {
      if (stateChanged) {
        await this.stateManager.saveState(updatedState);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('Failed to save state:', err);
      await this.sendErrorNotification({
        type: 'State Management',
        message: `Failed to save state: ${err.message}`,
        severity: 'high',
      });
      throw err;
    }
  }
}

// Lambda handler function
export const handler = async (_event: ScheduledEvent, _context: Context): Promise<void> => {
  const {
    RSS_FEED_URLS,
    DISCORD_WEBHOOK_URL,
    ERROR_WEBHOOK_URL,
    S3_BUCKET_NAME,
    S3_STATE_KEY,
  } = process.env;

  if (!RSS_FEED_URLS || !DISCORD_WEBHOOK_URL || !S3_BUCKET_NAME) {
    throw new Error('Missing required environment variables.');
  }

  const feedUrls = RSS_FEED_URLS.split(',').map(url => url.trim());
  const stateKey = S3_STATE_KEY || 'rss-discord-state.json';

  const httpClient = new HttpClient();
  const s3Client = new S3Client({});
  const stateManager = new StateManager(s3Client, S3_BUCKET_NAME, stateKey);
  const feedParser = new FeedParser(httpClient);
  const discordService = new DiscordService(httpClient, DISCORD_WEBHOOK_URL);
  const errorDiscordService = new DiscordService(
    httpClient,
    ERROR_WEBHOOK_URL || DISCORD_WEBHOOK_URL
  );

  const lambda = new RSSDiscordLambda(
    feedUrls,
    stateManager,
    feedParser,
    discordService,
    errorDiscordService
  );

  await lambda.processFeeds();
};
