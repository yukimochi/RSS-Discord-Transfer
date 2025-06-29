import { HttpClient } from './http-client';
import { DiscordWebhookPayload, DiscordMessageOptions, ErrorInfo, DiscordEmbed } from '../types';
import { FeedItem } from '../types';

/**
 * Discord webhook service for sending feed items and error notifications
 */
export class DiscordService {
  private readonly httpClient: HttpClient;
  private readonly webhookUrl: string;
  private readonly errorWebhookUrl: string;
  private readonly messageOptions: DiscordMessageOptions;

  constructor(
    httpClient: HttpClient,
    webhookUrl: string,
    errorWebhookUrl?: string,
    options: Partial<DiscordMessageOptions> = {}
  ) {
    this.httpClient = httpClient;
    this.webhookUrl = webhookUrl;
    this.errorWebhookUrl = errorWebhookUrl || webhookUrl;
    this.messageOptions = {
      includeTimestamp: true,
      maxContentLength: 2000, // Discord message limit
      ...options,
    };
  }

  /**
   * Send embeds to Discord, chunking them to respect the 10-embed limit.
   */
  async sendEmbeds(embeds: DiscordEmbed[]): Promise<void> {
    if (embeds.length === 0) {
      return;
    }

    const chunks = [];
    for (let i = 0; i < embeds.length; i += 10) {
      chunks.push(embeds.slice(i, i + 10));
    }

    for (const chunk of chunks) {
      const payload: DiscordWebhookPayload = {
        embeds: chunk,
        username: this.messageOptions.username,
        avatar_url: this.messageOptions.avatar_url,
      };
      await this.sendWebhook(this.webhookUrl, payload);
    }
  }

  /**
   * Send a webhook payload to the specified URL.
   */
  private async sendWebhook(url: string, payload: DiscordWebhookPayload): Promise<void> {
    await this.httpClient.performRequest(url, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10 seconds for Discord webhook requests
    });
  }

  /**
   * Send multiple feed items to Discord
   */
  async sendFeedItems(items: FeedItem[]): Promise<void> {
    const embeds = items.map(item => this.createEmbedFromFeedItem(item));
    await this.sendEmbeds(embeds);
  }

  /**
   * Send error notification to Discord
   */
  async sendErrorNotification(errorInfo: ErrorInfo): Promise<void> {
    const embed = this.createEmbedFromErrorInfo(errorInfo);

    try {
      console.log(`Sending error notification to Discord: ${errorInfo.type}`);
      // Use errorWebhookUrl for error notifications
      const payload: DiscordWebhookPayload = { embeds: [embed] };
      await this.sendWebhook(this.errorWebhookUrl, payload);
      console.log(`Successfully sent error notification: ${errorInfo.type}`);
    } catch (error) {
      console.error(`Failed to send error notification to Discord:`, error);
      // Don't throw here to avoid infinite error loops
    }
  }

  private createEmbedFromFeedItem(item: FeedItem): DiscordEmbed {
    // Create description with ID and timestamp as specified in the requirements
    let description = '';
    if (item.id && item.id !== item.guid) {
      description += `ID: ${item.id}`;
    }
    if (this.messageOptions.includeTimestamp) {
      if (description) description += '\n';
      description += `投稿日時: ${item.publishedAt.toISOString().replace('T', ' ').replace('Z', ' UTC')}`;
    }

    const embed: DiscordEmbed = {
      title: item.title,
      url: item.link,
      description: description || undefined, // Only include description if there's content
      timestamp: this.messageOptions.includeTimestamp ? item.publishedAt.toISOString() : undefined,
      color: 0x00ff00, // Green
      author: item.author ? { name: item.author } : undefined,
    };
    return embed;
  }

  private createEmbedFromErrorInfo(errorInfo: ErrorInfo): DiscordEmbed {
    const embed: DiscordEmbed = {
      title: `Error: ${errorInfo.type}`,
      description: errorInfo.message,
      color: errorInfo.severity === 'high' ? 0xff0000 : 0xffff00, // Red for high, Yellow for medium
      fields: [
        { name: 'Feed URL', value: errorInfo.feedUrl || 'N/A', inline: false },
        { name: 'Severity', value: errorInfo.severity, inline: true },
        { name: 'Timestamp', value: new Date().toISOString(), inline: true },
      ],
    };
    return embed;
  }
}
