import { XMLParser } from 'fast-xml-parser';
import { HttpClient } from './http-client';
import { FeedItem, FeedParseResult, FeedType, RSSFeed, AtomFeed } from '../types';

/**
 * RSS and Atom feed parser
 */
export class FeedParser {
  private readonly httpClient: HttpClient;
  private readonly xmlParser: XMLParser;

  constructor() {
    this.httpClient = new HttpClient();
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });
  }

  /**
   * Fetch and parse RSS/Atom feed from URL
   */
  async parseFeed(feedUrl: string): Promise<FeedParseResult> {
    // Validate URL
    if (!HttpClient.isValidUrl(feedUrl)) {
      throw new Error(`Invalid feed URL: ${feedUrl}`);
    }

    // Fetch feed content
    const response = await this.httpClient.get(feedUrl);
    
    if (response.statusCode !== 200) {
      throw new Error(`HTTP ${response.statusCode} error fetching feed: ${feedUrl}`);
    }

    // Parse XML
    const xmlData = this.xmlParser.parse(response.data);
    
    // Determine feed type and parse accordingly
    if (this.isRSSFeed(xmlData)) {
      return this.parseRSSFeed(xmlData as unknown as { rss: Record<string, unknown> }, feedUrl);
    } else if (this.isAtomFeed(xmlData)) {
      return this.parseAtomFeed(xmlData as unknown as { feed: Record<string, unknown> }, feedUrl);
    } else {
      throw new Error(`Unsupported feed format for URL: ${feedUrl}`);
    }
  }

  /**
   * Check if XML data represents RSS feed
   */
  private isRSSFeed(xmlData: unknown): xmlData is { rss: RSSFeed } {
    return (
      typeof xmlData === 'object' &&
      xmlData !== null &&
      'rss' in xmlData &&
      typeof (xmlData as { rss?: unknown }).rss === 'object'
    );
  }

  /**
   * Check if XML data represents Atom feed
   */
  private isAtomFeed(xmlData: unknown): xmlData is { feed: AtomFeed } {
    return (
      typeof xmlData === 'object' &&
      xmlData !== null &&
      'feed' in xmlData &&
      typeof (xmlData as { feed?: unknown }).feed === 'object'
    );
  }

  /**
   * Parse RSS 2.0 feed
   */
  private parseRSSFeed(xmlData: { rss: Record<string, unknown> }, feedUrl: string): FeedParseResult {
    const rss = xmlData.rss;
    const channel = rss.channel as Record<string, unknown>;

    if (!channel) {
      throw new Error('Invalid RSS feed: missing channel element');
    }

    const items: FeedItem[] = [];
    const rawItems = Array.isArray(channel.item) ? channel.item : [channel.item].filter(Boolean);

    for (const item of rawItems) {
      try {
        const feedItem = this.parseRSSItem(item as Record<string, unknown>, feedUrl);
        if (feedItem) {
          items.push(feedItem);
        }
      } catch (error) {
        console.warn('Failed to parse RSS item:', error);
        // Continue processing other items
      }
    }

    return {
      type: FeedType.RSS,
      items,
      feedInfo: {
        title: this.extractText(channel.title) || 'Unknown RSS Feed',
        description: this.extractText(channel.description),
        link: this.extractText(channel.link) || feedUrl,
      },
    };
  }

  /**
   * Parse Atom feed
   */
  private parseAtomFeed(xmlData: { feed: Record<string, unknown> }, feedUrl: string): FeedParseResult {
    const feed = xmlData.feed;

    const items: FeedItem[] = [];
    const rawEntries = Array.isArray(feed.entry) ? feed.entry : [feed.entry].filter(Boolean);

    for (const entry of rawEntries) {
      try {
        const feedItem = this.parseAtomEntry(entry as Record<string, unknown>, feedUrl);
        if (feedItem) {
          items.push(feedItem);
        }
      } catch (error) {
        console.warn('Failed to parse Atom entry:', error);
        // Continue processing other entries
      }
    }

    return {
      type: FeedType.ATOM,
      items,
      feedInfo: {
        title: this.extractText(feed.title) || 'Unknown Atom Feed',
        description: this.extractText(feed.subtitle),
        link: this.extractAtomLink(feed.link) || feedUrl,
      },
    };
  }

  /**
   * Parse single RSS item
   */
  private parseRSSItem(item: Record<string, unknown>, feedUrl: string): FeedItem | null {
    const title = this.extractText(item.title);
    const link = this.extractText(item.link);
    const pubDate = this.parseDate(this.extractText(item.pubDate));

    if (!title || !link || !pubDate) {
      return null;
    }

    return {
      title,
      link,
      publishedAt: pubDate,
      description: this.extractText(item.description),
      id: this.extractText(item.guid) || this.generateItemId(title, link),
      feedUrl,
    };
  }

  /**
   * Parse single Atom entry
   */
  private parseAtomEntry(entry: Record<string, unknown>, feedUrl: string): FeedItem | null {
    const title = this.extractText(entry.title);
    const link = this.extractAtomLink(entry.link);
    const published = this.parseDate(this.extractText(entry.published));

    if (!title || !link || !published) {
      return null;
    }

    return {
      title,
      link,
      publishedAt: published,
      description: this.extractText(entry.summary),
      id: this.extractText(entry.id) || this.generateItemId(title, link),
      feedUrl,
    };
  }

  /**
   * Extract text content from XML element
   */
  private extractText(element: unknown): string | undefined {
    if (typeof element === 'string') {
      return element.trim();
    }
    if (typeof element === 'object' && element !== null && '#text' in element) {
      return String((element as { '#text': unknown })['#text']).trim();
    }
    return undefined;
  }

  /**
   * Extract link from Atom link element
   */
  private extractAtomLink(linkElement: unknown): string | undefined {
    if (typeof linkElement === 'string') {
      return linkElement;
    }

    if (typeof linkElement === 'object' && linkElement !== null) {
      const link = linkElement as Record<string, unknown>;
      if ('@_href' in link && typeof link['@_href'] === 'string') {
        return link['@_href'];
      }
    }

    if (Array.isArray(linkElement) && linkElement.length > 0) {
      return this.extractAtomLink(linkElement[0]);
    }

    return undefined;
  }

  /**
   * Parse date string to Date object
   */
  private parseDate(dateString: string | undefined): Date | null {
    if (!dateString) {
      return null;
    }

    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }

  /**
   * Generate unique item ID from title and link
   */
  private generateItemId(title: string, link: string): string {
    return `${title}-${link}`.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  }
}
