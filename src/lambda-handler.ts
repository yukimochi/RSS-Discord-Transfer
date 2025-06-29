import { Context, ScheduledEvent } from 'aws-lambda';
import { StateManager } from './services/state-manager';
import { FeedParser } from './services/feed-parser';
import { DiscordService } from './services/discord-service';
import { AppState, FeedState, ErrorInfo, ErrorSeverity } from './types';

interface LambdaEnvironmentVariables {
  RSS_FEED_URLS: string;
  DISCORD_WEBHOOK_URL: string;
  ERROR_WEBHOOK_URL?: string;
  S3_BUCKET_NAME: string;
  S3_STATE_KEY?: string;
}

export class RSSDiscordLambda {
  private stateManager: StateManager;
  private feedParser: FeedParser;
  private discordService: DiscordService;
  private errorDiscordService?: DiscordService;
  private feedUrls: string[];
  private maxArticlesPerRun = 10;

  constructor(env: LambdaEnvironmentVariables) {
    this.validateEnvironmentVariables(env);
    
    this.stateManager = new StateManager(
      env.S3_BUCKET_NAME,
      env.S3_STATE_KEY || 'rss-discord-state.json'
    );
    
    this.feedParser = new FeedParser();
    this.discordService = new DiscordService(env.DISCORD_WEBHOOK_URL);
    
    if (env.ERROR_WEBHOOK_URL) {
      this.errorDiscordService = new DiscordService(env.ERROR_WEBHOOK_URL);
    }
    
    this.feedUrls = env.RSS_FEED_URLS.split(',').map(url => url.trim());
  }

  private validateEnvironmentVariables(env: LambdaEnvironmentVariables): void {
    if (!env.RSS_FEED_URLS) {
      throw new Error('RSS_FEED_URLS environment variable is required');
    }
    if (!env.DISCORD_WEBHOOK_URL) {
      throw new Error('DISCORD_WEBHOOK_URL environment variable is required');
    }
    if (!env.S3_BUCKET_NAME) {
      throw new Error('S3_BUCKET_NAME environment variable is required');
    }
  }

  private async sendErrorNotification(errorInfo: ErrorInfo): Promise<void> {
    try {
      const service = this.errorDiscordService || this.discordService;
      await service.sendErrorNotification(errorInfo);
    } catch (notificationError) {
      console.error('Failed to send error notification:', notificationError);
    }
  }

  public async processFeeds(): Promise<void> {
    let currentState: AppState;
    
    try {
      // Load current state from S3
      currentState = await this.stateManager.loadState();
      console.log('Current state loaded:', JSON.stringify(currentState, null, 2));
    } catch (error) {
      console.error('Failed to load state:', error);
      const errorInfo: ErrorInfo = {
        type: 'State Load Error',
        message: 'Failed to load state from S3',
        timestamp: new Date(),
        severity: ErrorSeverity.CRITICAL,
        details: { errorMessage: (error as Error).message },
      };
      await this.sendErrorNotification(errorInfo);
      throw error;
    }

    const now = new Date();
    let totalNewArticles = 0;
    const processedFeeds: string[] = [];
    const failedFeeds: string[] = [];

    // Process each RSS feed
    for (const feedUrl of this.feedUrls) {
      if (totalNewArticles >= this.maxArticlesPerRun) {
        console.log(`Reached maximum articles limit (${this.maxArticlesPerRun}), stopping processing`);
        break;
      }

      try {
        console.log(`Processing feed: ${feedUrl}`);
        
        const feed = await this.feedParser.parseFeed(feedUrl);
        const feedState = currentState.feeds[feedUrl];
        const lastCheckedAt = feedState ? feedState.lastCheckedAt : currentState.lastCheckedAt;
        const lastCheckedDate = new Date(lastCheckedAt);
        
        // Filter new articles
        const newArticles = feed.items
          .filter(item => {
            const publishedDate = new Date(item.publishedAt);
            return publishedDate > lastCheckedDate;
          })
          .sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime())
          .slice(0, this.maxArticlesPerRun - totalNewArticles);

        console.log(`Found ${newArticles.length} new articles in ${feedUrl}`);

        // Send new articles to Discord
        for (const article of newArticles) {
          try {
            await this.discordService.sendFeedItem(article);
            console.log(`Sent article to Discord: ${article.title}`);
            totalNewArticles++;
          } catch (error) {
            console.error(`Failed to send article to Discord: ${article.title}`, error);
            const errorInfo: ErrorInfo = {
              type: 'Discord Send Error',
              message: `Failed to send article: ${article.title}`,
              timestamp: new Date(),
              severity: ErrorSeverity.HIGH,
              feedUrl,
              details: { articleTitle: article.title, errorMessage: (error as Error).message },
            };
            await this.sendErrorNotification(errorInfo);
          }
        }

        // Update feed-specific timestamp
        const updatedFeedState: FeedState = {
          lastCheckedAt: now.toISOString(),
          errorCount: 0,
        };
        currentState = {
          ...currentState,
          feeds: {
            ...currentState.feeds,
            [feedUrl]: updatedFeedState,
          },
        };
        processedFeeds.push(feedUrl);
        
      } catch (error) {
        console.error(`Failed to process feed ${feedUrl}:`, error);
        failedFeeds.push(feedUrl);
        const errorInfo: ErrorInfo = {
          type: 'Feed Processing Error',
          message: `Failed to process RSS feed: ${feedUrl}`,
          timestamp: new Date(),
          severity: ErrorSeverity.HIGH,
          feedUrl,
          details: { errorMessage: (error as Error).message },
        };
        await this.sendErrorNotification(errorInfo);
      }
    }

    // Update global timestamp if at least one feed was processed successfully
    if (processedFeeds.length > 0) {
      currentState = {
        ...currentState,
        lastCheckedAt: now.toISOString(),
      };
    }

    // Save updated state
    try {
      await this.stateManager.saveState(currentState);
      console.log('State saved successfully');
    } catch (error) {
      console.error('Failed to save state:', error);
      const errorInfo: ErrorInfo = {
        type: 'State Save Error',
        message: 'Failed to save state to S3',
        timestamp: new Date(),
        severity: ErrorSeverity.CRITICAL,
        details: { errorMessage: (error as Error).message },
      };
      await this.sendErrorNotification(errorInfo);
      throw error;
    }

    // Log summary
    console.log(`Processing complete. Total new articles: ${totalNewArticles}`);
    console.log(`Successfully processed feeds: ${processedFeeds.length}`);
    console.log(`Failed feeds: ${failedFeeds.length}`);
    
    if (failedFeeds.length > 0) {
      console.log(`Failed feed URLs: ${failedFeeds.join(', ')}`);
    }
  }
}

// Lambda handler function
export const handler = async (event: ScheduledEvent, context: Context): Promise<void> => {
  console.log('Lambda function started');
  console.log('Event:', JSON.stringify(event, null, 2));
  console.log('Context:', JSON.stringify(context, null, 2));

  const env: LambdaEnvironmentVariables = {
    RSS_FEED_URLS: process.env.RSS_FEED_URLS!,
    DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL!,
    ERROR_WEBHOOK_URL: process.env.ERROR_WEBHOOK_URL,
    S3_BUCKET_NAME: process.env.S3_BUCKET_NAME!,
    S3_STATE_KEY: process.env.S3_STATE_KEY,
  };

  try {
    const lambda = new RSSDiscordLambda(env);
    await lambda.processFeeds();
    console.log('Lambda function completed successfully');
  } catch (error) {
    console.error('Lambda function failed:', error);
    
    // Try to send error notification as last resort
    try {
      const errorService = new DiscordService(
        env.ERROR_WEBHOOK_URL || env.DISCORD_WEBHOOK_URL
      );
      const errorInfo: ErrorInfo = {
        type: 'Critical Lambda Error',
        message: 'Lambda execution failed',
        timestamp: new Date(),
        severity: ErrorSeverity.CRITICAL,
        details: { errorMessage: (error as Error).message },
      };
      await errorService.sendErrorNotification(errorInfo);
    } catch (notificationError) {
      console.error('Failed to send critical error notification:', notificationError);
    }
    
    throw error;
  }
};
