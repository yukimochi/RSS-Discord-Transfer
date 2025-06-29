import nock from 'nock';
import { FeedParser } from '../../services/feed-parser';
import { HttpClient } from '../../services/http-client';
import { FeedType } from '../../types';

// Mock data for tests
const rssFeedXml = `
<rss version="2.0">
  <channel>
    <title>RSS Feed Title</title>
    <link>http://example.com/rss</link>
    <description>RSS Feed Description</description>
    <item>
      <title>RSS Item 1</title>
      <link>http://example.com/rss/1</link>
      <pubDate>Sun, 29 Jun 2025 00:00:00 GMT</pubDate>
      <guid>http://example.com/rss/1</guid>
      <description>Description 1</description>
    </item>
    <item>
      <title>RSS Item 2</title>
      <link>http://example.com/rss/2</link>
      <pubDate>Sat, 28 Jun 2025 12:00:00 GMT</pubDate>
      <guid>http://example.com/rss/2</guid>
      <description>Description 2</description>
    </item>
  </channel>
</rss>`;

const atomFeedXml = `
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed Title</title>
  <link href="http://example.com/atom"/>
  <subtitle>Atom Feed Subtitle</subtitle>
  <entry>
    <title>Atom Entry 1</title>
    <link href="http://example.com/atom/1"/>
    <id>urn:uuid:1225c695-cfb8-4ebb-aaaa-80da344efa6a</id>
    <published>2025-06-29T00:00:00Z</published>
    <summary>Summary 1</summary>
  </entry>
  <entry>
    <title>Atom Entry 2</title>
    <link href="http://example.com/atom/2"/>
    <id>urn:uuid:1225c695-cfb8-4ebb-bbbb-80da344efa6b</id>
    <published>2025-06-28T12:00:00Z</published>
    <summary>Summary 2</summary>
  </entry>
</feed>`;

describe('FeedParser', () => {
  const baseURL = 'http://example.com';
  let parser: FeedParser;

  beforeEach(() => {
    parser = new FeedParser(new HttpClient());
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('Successful Parsing', () => {
    it('should parse a valid RSS 2.0 feed', async () => {
      nock(baseURL).get('/rss').reply(200, rssFeedXml);

      const result = await parser.parseFeed(`${baseURL}/rss`);

      expect(result.type).toBe(FeedType.RSS);
      expect(result.items).toHaveLength(2);
      expect(result.feedInfo.title).toBe('RSS Feed Title');

      const firstItem = result.items[0];
      expect(firstItem).toBeDefined();
      expect(firstItem!.title).toBe('RSS Item 1');
      expect(firstItem!.link).toBe('http://example.com/rss/1');
      expect(firstItem!.publishedAt).toEqual(new Date('Sun, 29 Jun 2025 00:00:00 GMT'));
    });

    it('should parse a valid Atom feed', async () => {
      nock(baseURL).get('/atom').reply(200, atomFeedXml);

      const result = await parser.parseFeed(`${baseURL}/atom`);

      expect(result.type).toBe(FeedType.ATOM);
      expect(result.items).toHaveLength(2);
      expect(result.feedInfo.title).toBe('Atom Feed Title');

      const firstItem = result.items[0];
      expect(firstItem).toBeDefined();
      expect(firstItem!.title).toBe('Atom Entry 1');
      expect(firstItem!.link).toBe('http://example.com/atom/1');
      expect(firstItem!.publishedAt).toEqual(new Date('2025-06-29T00:00:00Z'));
    });

    it('should skip items with missing required fields', async () => {
        const incompleteRss = `
        <rss version="2.0">
          <channel>
            <title>Incomplete RSS</title>
            <item><title>Valid Item</title><link>http://example.com/valid</link><pubDate>Sun, 29 Jun 2025 00:00:00 GMT</pubDate></item>
            <item><title>Missing Link</title><pubDate>Sun, 29 Jun 2025 00:00:00 GMT</pubDate></item>
          </channel>
        </rss>`;
        nock(baseURL).get('/incomplete').reply(200, incompleteRss);
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        const result = await parser.parseFeed(`${baseURL}/incomplete`);

        expect(result.items).toHaveLength(1);
        expect(result.items[0]).toBeDefined();
        expect(result.items[0]!.title).toBe('Valid Item');
        expect(consoleWarnSpy).toHaveBeenCalled();
        consoleWarnSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should throw an error for an invalid URL', async () => {
      await expect(parser.parseFeed('invalid-url')).rejects.toThrow('Invalid feed URL: invalid-url');
    });

    it('should throw an error on HTTP failure', async () => {
      nock(baseURL).get('/fail').times(4).reply(404);

      await expect(parser.parseFeed(`${baseURL}/fail`)).rejects.toThrow('HTTP request failed after 2 attempts: HTTP error 404: Not Found');
    });

    it('should throw an error for unsupported feed formats', async () => {
      nock(baseURL).get('/unsupported').reply(200, '<html />');

      await expect(parser.parseFeed(`${baseURL}/unsupported`)).rejects.toThrow('Unsupported feed format for URL: http://example.com/unsupported');
    });

    it('should throw an error for an invalid RSS feed missing <channel>', async () => {
        const invalidRss = `<rss version="2.0"></rss>`;
        nock(baseURL).get('/invalid-rss').reply(200, invalidRss);

        await expect(parser.parseFeed(`${baseURL}/invalid-rss`)).rejects.toThrow('Invalid RSS feed: missing channel element');
    });
  });
});
