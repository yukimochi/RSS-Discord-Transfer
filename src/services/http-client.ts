import https from 'https';
import http from 'http';
import { URL } from 'url';
import { HttpResponse, HttpRequestOptions } from '../types/http';

/**
 * HTTP client with timeout and retry functionality
 */
export class HttpClient {
  private readonly defaultOptions: HttpRequestOptions;

  constructor(options: Partial<HttpRequestOptions> = {}) {
    this.defaultOptions = {
      timeout: 3000, // 3 seconds as per specification
      retries: 1, // 1 retry (total 2 attempts) as per specification
      ...options,
    };
  }

  /**
   * Perform HTTP GET request with retry logic
   */
  async get(url: string, options: Partial<HttpRequestOptions> = {}): Promise<HttpResponse> {
    const requestOptions: HttpRequestOptions = {
      ...this.defaultOptions,
      ...options,
      method: 'GET',
    };
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= requestOptions.retries!; attempt++) {
      try {
        console.log(`HTTP ${requestOptions.method} attempt ${attempt + 1}/${requestOptions.retries! + 1}: ${url}`);
        return await this.performRequest(url, requestOptions);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`HTTP ${requestOptions.method} attempt ${attempt + 1} failed:`, lastError.message);
        
        // Don't wait after the last attempt
        if (attempt < requestOptions.retries!) {
          const delayMs = process.env.NODE_ENV === 'test' ? 10 : 1000; // Shorter delay in test
          await this.delay(delayMs);
        }
      }
    }

    throw new Error(`HTTP request failed after ${requestOptions.retries! + 1} attempts: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Perform a single HTTP request
   */
  async performRequest(url: string, options: HttpRequestOptions): Promise<HttpResponse> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const requestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method || 'GET',
        headers: {
          'User-Agent': 'RSS-Discord-Transfer/1.0.0',
          ...options.headers,
        },
        timeout: options.timeout!,
      };

      const request = client.request(requestOptions, (response) => {
        const chunks: Buffer[] = [];
        
        response.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        response.on('end', () => {
          const data = Buffer.concat(chunks).toString('utf-8');
          const statusCode = response.statusCode || 0;

          if (statusCode < 200 || statusCode >= 300) {
            reject(new Error(`HTTP error ${statusCode}: ${response.statusMessage}`));
            return;
          }

          const headers: Record<string, string> = {};
          
          // Convert headers to simple key-value object
          for (const [key, value] of Object.entries(response.headers)) {
            if (typeof value === 'string') {
              headers[key] = value;
            } else if (Array.isArray(value)) {
              headers[key] = value.join(', ');
            }
          }

          resolve({
            statusCode: statusCode,
            data,
            headers,
          });
        });
      });

      request.on('timeout', () => {
        request.destroy();
        reject(new Error(`Request timeout after ${options.timeout}ms`));
      });

      request.on('error', (err) => {
        reject(new Error(`Request failed: ${err.message}`));
      });

      if (options.body) {
        request.write(options.body);
      }

      request.end();
    });
  }

  /**
   * Validate URL format
   */
  static isValidUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
