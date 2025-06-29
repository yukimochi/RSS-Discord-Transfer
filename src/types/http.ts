/**
 * Represents the options for an HTTP request.
 */
export interface HttpRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  body?: string;
}

/**
 * Represents the response from an HTTP request.
 */
export interface HttpResponse {
  statusCode: number;
  data: string;
  headers: Record<string, string>;
}
