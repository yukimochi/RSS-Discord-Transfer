/**
 * RSS feed item interface
 */
export interface RSSItem {
  readonly title: string;
  readonly link: string;
  readonly pubDate: Date;
  readonly description?: string;
  readonly guid?: string;
}

/**
 * RSS feed data structure
 */
export interface RSSFeed {
  readonly title: string;
  readonly description: string;
  readonly link: string;
  readonly items: RSSItem[];
}

/**
 * Atom feed entry interface
 */
export interface AtomEntry {
  readonly title: string;
  readonly link: string;
  readonly published: Date;
  readonly updated?: Date;
  readonly summary?: string;
  readonly id: string;
}

/**
 * Atom feed data structure
 */
export interface AtomFeed {
  readonly title: string;
  readonly subtitle?: string;
  readonly link: string;
  readonly entries: AtomEntry[];
}

/**
 * Normalized feed item (common interface for RSS and Atom)
 */
export interface FeedItem {
  readonly title: string;
  readonly link: string;
  readonly publishedAt: Date;
  readonly description?: string;
  readonly id: string;
  readonly feedUrl: string;
}

/**
 * Feed type enumeration
 */
export enum FeedType {
  RSS = 'rss',
  ATOM = 'atom',
}

/**
 * Feed parsing result
 */
export interface FeedParseResult {
  readonly type: FeedType;
  readonly items: FeedItem[];
  readonly feedInfo: {
    readonly title: string;
    readonly description?: string;
    readonly link: string;
  };
}
