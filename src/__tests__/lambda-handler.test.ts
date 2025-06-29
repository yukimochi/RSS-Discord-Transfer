import { S3Client } from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { RSSDiscordLambda } from '../../src/lambda-handler';
import { StateManager } from '../../src/services/state-manager';
import { FeedParser } from '../../src/services/feed-parser';
import { DiscordService } from '../../src/services/discord-service';
import { AppState, FeedItem, FeedParseResult, FeedType } from '../../src/types';
import { HttpClient } from '../../src/services/http-client';

// Mock services
jest.mock('../../src/services/state-manager');
jest.mock('../../src/services/feed-parser');
jest.mock('../../src/services/discord-service');
jest.mock('../../src/services/http-client');

const StateManagerMock = StateManager as jest.MockedClass<typeof StateManager>;
const FeedParserMock = FeedParser as jest.MockedClass<typeof FeedParser>;
const DiscordServiceMock = DiscordService as jest.MockedClass<typeof DiscordService>;

describe('RSSDiscordLambda', () => {
  let stateManager: jest.Mocked<StateManager>;
  let feedParser: jest.Mocked<FeedParser>;
  let discordService: jest.Mocked<DiscordService>;
  let errorDiscordService: jest.Mocked<DiscordService>;
  let lambda: RSSDiscordLambda;

  const feedUrl1 = 'http://example.com/rss1';
  const feedUrl2 = 'http://example.com/rss2';

  const initialDate = '2023-01-01T00:00:00.000Z';
  const olderDate = '2023-01-01T12:00:00.000Z';
  const newerDate = '2023-01-02T00:00:00.000Z';

  const initialState: AppState = {
    lastCheckedAt: initialDate,
    feeds: {
      [feedUrl1]: {
        lastCheckedAt: olderDate,
        lastItemGuid: 'guid1',
      },
    },
  };

  const feedItems1: FeedItem[] = [
    {
      title: 'New Post',
      link: 'http://example.com/post2',
      publishedAt: new Date(newerDate),
      guid: 'guid2',
      author: 'Author',
      content: 'New content',
      id: 'guid2',
      feedUrl: feedUrl1,
    },
    {
      title: 'Old Post',
      link: 'http://example.com/post1',
      publishedAt: new Date(olderDate),
      guid: 'guid1',
      author: 'Author',
      content: 'Old content',
      id: 'guid1',
      feedUrl: feedUrl1,
    },
  ];

  beforeEach(() => {
    // Reset mocks before each test
    StateManagerMock.mockClear();
    FeedParserMock.mockClear();
    DiscordServiceMock.mockClear();

    // Create new mock instances for each test
    const s3Mock = mockClient(S3Client);
    stateManager = new StateManager(s3Mock as any, 'bucket', 'key') as jest.Mocked<StateManager>;
    feedParser = new FeedParser(new HttpClient()) as jest.Mocked<FeedParser>;
    discordService = new DiscordService(new HttpClient(), 'url') as jest.Mocked<DiscordService>;
    errorDiscordService = new DiscordService(new HttpClient(), 'error-url') as jest.Mocked<DiscordService>;

    lambda = new RSSDiscordLambda(
      [feedUrl1, feedUrl2],
      stateManager,
      feedParser,
      discordService,
      errorDiscordService
    );

    // Default mock implementations
    stateManager.loadState.mockResolvedValue(JSON.parse(JSON.stringify(initialState)));
    stateManager.saveState.mockResolvedValue();
    feedParser.parseFeed.mockImplementation(async (url: string): Promise<FeedParseResult> => {
        if (url === feedUrl1) {
            return {
              type: FeedType.RSS,
              items: feedItems1,
              feedInfo: { title: 'Feed 1', link: url },
            };
        }
        return {
          type: FeedType.RSS,
          items: [],
          feedInfo: { title: 'Feed 2', link: url },
        };
    });
    discordService.sendFeedItems.mockResolvedValue();
    discordService.sendErrorNotification.mockResolvedValue();
    errorDiscordService.sendErrorNotification.mockResolvedValue();
  });

  test('should process new items, send them to discord, and save updated state', async () => {
    await lambda.processFeeds();

    // Verify new items were sent
    expect(discordService.sendFeedItems).toHaveBeenCalledTimes(1);
    const sentItems = discordService.sendFeedItems.mock.calls[0]?.[0];
    expect(sentItems).toBeDefined();
    expect(sentItems?.[0]?.guid).toBe('guid2');

    // Verify state was saved with updated info
    expect(stateManager.saveState).toHaveBeenCalledTimes(1);
    const savedState = stateManager.saveState.mock.calls[0]?.[0];
    expect(savedState).toBeDefined();
    expect(savedState?.feeds?.[feedUrl1]?.lastCheckedAt).toBe(newerDate);
    expect(savedState?.feeds?.[feedUrl1]?.lastItemGuid).toBe('guid2');
    expect(savedState && new Date(savedState.lastCheckedAt) > new Date(initialDate)).toBe(true);
  });

  test('should not send to discord or update feed state if no new items are found', async () => {
    const stateWithRecentItems: AppState = {
        lastCheckedAt: newerDate,
        feeds: {
          [feedUrl1]: {
            lastCheckedAt: newerDate,
            lastItemGuid: 'guid2',
          },
        },
      };
    stateManager.loadState.mockResolvedValue(stateWithRecentItems);
    
    await lambda.processFeeds();

    expect(discordService.sendFeedItems).not.toHaveBeenCalled();
    
    // saveState should still be called to update the global lastCheckedAt
    expect(stateManager.saveState).toHaveBeenCalledTimes(1);
    const savedState = stateManager.saveState.mock.calls[0]?.[0];
    expect(savedState).toBeDefined();
    expect(savedState?.feeds?.[feedUrl1]?.lastCheckedAt).toBe(newerDate);
  });

  test('should handle feed parsing errors and send an error notification', async () => {
    const parsingError = new Error('Failed to parse feed');
    feedParser.parseFeed.mockRejectedValue(parsingError);

    await lambda.processFeeds();

    expect(errorDiscordService.sendErrorNotification).toHaveBeenCalledTimes(2);
    expect(errorDiscordService.sendErrorNotification).toHaveBeenCalledWith({
        type: 'Feed Processing',
        message: `Failed to fetch or parse feed: ${parsingError.message}`,
        severity: 'medium',
        feedUrl: feedUrl1,
    });
    expect(discordService.sendFeedItems).not.toHaveBeenCalled();
    // saveState should still be called to update the global timestamp
    expect(stateManager.saveState).toHaveBeenCalledTimes(1);
  });

  test('should throw and send notification on state loading failure', async () => {
    const loadingError = new Error('S3 is down');
    stateManager.loadState.mockRejectedValue(loadingError);

    await expect(lambda.processFeeds()).rejects.toThrow(loadingError);

    expect(errorDiscordService.sendErrorNotification).toHaveBeenCalledWith({
        type: 'State Management',
        message: `Failed to load state: ${loadingError.message}`,
        severity: 'high',
    });
    expect(stateManager.saveState).not.toHaveBeenCalled();
  });

  test('should throw and send notification on state saving failure', async () => {
    const savingError = new Error('S3 is read-only');
    stateManager.saveState.mockRejectedValue(savingError);

    await expect(lambda.processFeeds()).rejects.toThrow(savingError);

    expect(errorDiscordService.sendErrorNotification).toHaveBeenCalledWith({
        type: 'State Management',
        message: `Failed to save state: ${savingError.message}`,
        severity: 'high',
    });
  });

  test('should send error notification on discord failure and continue', async () => {
    const discordError = new Error('Discord is unavailable');
    discordService.sendFeedItems.mockRejectedValue(discordError);

    await lambda.processFeeds();

    expect(errorDiscordService.sendErrorNotification).toHaveBeenCalledWith({
        type: 'Discord Notification',
        message: `Failed to send items to Discord: ${discordError.message}`,
        severity: 'medium',
        feedUrl: feedUrl1,
    });
    // State should not be updated for the failed feed, but global timestamp should be
    expect(stateManager.saveState).toHaveBeenCalledTimes(1);
    const savedState = stateManager.saveState.mock.calls[0]?.[0];
    expect(savedState).toBeDefined();
    expect(savedState?.feeds?.[feedUrl1]?.lastItemGuid).toBe('guid1');
  });

  test('should send only latest item on first execution and mark it as processed', async () => {
    // Setup: empty state (first run)
    const emptyState: AppState = {
      lastCheckedAt: '1970-01-01T00:00:00.000Z',
      feeds: {},
    };
    stateManager.loadState.mockResolvedValue(emptyState);

    // Setup: feed has multiple items
    const multipleItems: FeedItem[] = [
      {
        id: 'id1',
        title: 'Older Post',
        link: 'http://example.com/post1',
        publishedAt: new Date(olderDate),
        guid: 'guid1',
        author: 'Author',
        feedUrl: feedUrl1,
      },
      {
        id: 'id2',
        title: 'Latest Post',
        link: 'http://example.com/post2',
        publishedAt: new Date(newerDate),
        guid: 'guid2',
        author: 'Author',
        feedUrl: feedUrl1,
      },
    ];

    feedParser.parseFeed.mockImplementation(async (url: string) => {
      if (url === feedUrl1) {
        return {
          type: FeedType.RSS,
          items: multipleItems,
          feedInfo: { title: 'Feed 1', link: url },
        };
      }
      return {
        type: FeedType.RSS,
        items: [],
        feedInfo: { title: 'Feed 2', link: url },
      };
    });

    await lambda.processFeeds();

    // Verify only the latest item was sent to Discord on first run
    expect(discordService.sendFeedItems).toHaveBeenCalledTimes(1);
    const sentItems = discordService.sendFeedItems.mock.calls[0]?.[0];
    expect(sentItems).toBeDefined();
    expect(sentItems).toHaveLength(1);
    expect(sentItems?.[0]?.guid).toBe('guid2'); // Latest item
    expect(sentItems?.[0]?.title).toBe('Latest Post');

    // Verify state was saved with the latest item marked as processed
    expect(stateManager.saveState).toHaveBeenCalledTimes(1);
    const savedState = stateManager.saveState.mock.calls[0]?.[0];
    expect(savedState).toBeDefined();
    expect(savedState?.feeds?.[feedUrl1]?.lastCheckedAt).toBe(newerDate);
    expect(savedState?.feeds?.[feedUrl1]?.lastItemGuid).toBe('guid2');
  });
});
