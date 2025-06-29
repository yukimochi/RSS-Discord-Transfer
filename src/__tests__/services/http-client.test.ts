import nock from 'nock';
import { HttpClient } from '../../services/http-client';

describe('HttpClient', () => {
  const baseURL = 'http://example.com';

  afterEach(() => {
    nock.cleanAll();
  });

  it('should fetch data successfully on the first attempt', async () => {
    nock(baseURL).get('/').reply(200, 'Success');

    const client = new HttpClient();
    const response = await client.get(`${baseURL}/`);

    expect(response.statusCode).toBe(200);
    expect(response.data).toBe('Success');
    expect(nock.isDone()).toBe(true);
  });

  it('should retry on failure and succeed on the second attempt', async () => {
    nock(baseURL).get('/').reply(500);
    nock(baseURL).get('/').reply(200, 'Success');

    const client = new HttpClient({ retries: 1 });
    const response = await client.get(`${baseURL}/`);

    expect(response.statusCode).toBe(200);
    expect(response.data).toBe('Success');
    expect(nock.isDone()).toBe(true);
  });

  it('should throw an error after all retry attempts fail', async () => {
    nock(baseURL).get('/').times(2).reply(500, 'Internal Server Error');

    const client = new HttpClient({ retries: 1 });

    await expect(client.get(`${baseURL}/`)).rejects.toThrow(
      'HTTP request failed after 2 attempts: HTTP error 500: Internal Server Error'
    );
    expect(nock.isDone()).toBe(true);
  });

  it('should handle timeout and retry', async () => {
    nock(baseURL).get('/').delay(100).reply(200, 'Success'); // This will timeout
    nock(baseURL).get('/').reply(200, 'Success');

    const client = new HttpClient({ timeout: 50, retries: 1 });
    const response = await client.get(`${baseURL}/`);

    expect(response.statusCode).toBe(200);
    expect(response.data).toBe('Success');
    expect(nock.isDone()).toBe(true);
  });

  it('should throw a timeout error after all retries', async () => {
    nock(baseURL).get('/').times(2).delay(100).reply(200, 'Success');

    const client = new HttpClient({ timeout: 50, retries: 1 });

    await expect(client.get(`${baseURL}/`)).rejects.toThrow(
        'HTTP request failed after 2 attempts: Request timeout after 50ms'
    );
    expect(nock.isDone()).toBe(true);
  });

  describe('isValidUrl', () => {
    it('should return true for valid http and https URLs', () => {
      expect(HttpClient.isValidUrl('http://example.com')).toBe(true);
      expect(HttpClient.isValidUrl('https://example.com/path?query=1')).toBe(true);
    });

    it('should return false for invalid URLs', () => {
      expect(HttpClient.isValidUrl('ftp://example.com')).toBe(false);
      expect(HttpClient.isValidUrl('example.com')).toBe(false);
      expect(HttpClient.isValidUrl('not a url')).toBe(false);
    });
  });
});
