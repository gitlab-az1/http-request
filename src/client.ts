import { assertDefinedString } from '@rapid-d-kit/safe';

import { request } from './polyfill';
import { headersEntries, parseHeaders, XHR } from './platform/xhr';


export type ClientOptions = {
  defaultHeaders?: XHR.RequestInit['headers'];
  defaultTimeout?: number;
};

export class HttpClient {
  readonly #base: string;
  readonly #defaultHeaders: Headers;
  readonly #options: ClientOptions;

  public constructor(baseUrl: string | URL, options?: ClientOptions) {
    this.#base = baseUrl.toString();
    assertDefinedString(this.#base);

    this.#options = { ...options };
    this.#defaultHeaders = parseHeaders(options?.defaultHeaders || {});
  }

  public get(url: string | URL, init?: Omit<XHR.RequestInit, 'url' | 'method' | 'payload'>): Promise<XHR.Response> {
    const requestUrl = new URL(url, this.#base);

    const entries = [...headersEntries(this.#defaultHeaders)].filter(([, v]) => typeof v === 'string' || Array.isArray(v)) as [string, string | string[]][];
    const object = Object.fromEntries(entries) as Record<string, string | readonly string[]>;

    const headers = new Headers( object as unknown as any );

    if(init?.headers) {
      for(const [key, value] of parseHeaders(init.headers).entries()) {
        headers.append(key, value);
      }
    }

    return request(requestUrl, {
      ...init,
      headers,
      method: 'GET',
      timeout: init?.timeout || this.#options.defaultTimeout,
    });
  }

  public post(url: string | URL, init?: Omit<XHR.RequestInit, 'url' | 'method'>): Promise<XHR.Response> {
    const requestUrl = new URL(url, this.#base);

    const headers = new Headers(Object.fromEntries(this.#defaultHeaders.entries()));

    if(init?.headers) {
      for(const [key, value] of parseHeaders(init.headers).entries()) {
        headers.append(key, value);
      }
    }

    return request(requestUrl, {
      ...init,
      headers,
      method: 'POST',
      timeout: init?.timeout || this.#options.defaultTimeout,
    });
  }

  public put(url: string | URL, init?: Omit<XHR.RequestInit, 'url' | 'method'>): Promise<XHR.Response> {
    const requestUrl = new URL(url, this.#base);

    const headers = new Headers(Object.fromEntries(this.#defaultHeaders.entries()));

    if(init?.headers) {
      for(const [key, value] of parseHeaders(init.headers).entries()) {
        headers.append(key, value);
      }
    }

    return request(requestUrl, {
      ...init,
      headers,
      method: 'PUT',
      timeout: init?.timeout || this.#options.defaultTimeout,
    });
  }

  public patch(url: string | URL, init?: Omit<XHR.RequestInit, 'url' | 'method'>): Promise<XHR.Response> {
    const requestUrl = new URL(url, this.#base);

    const headers = new Headers(Object.fromEntries(this.#defaultHeaders.entries()));

    if(init?.headers) {
      for(const [key, value] of parseHeaders(init.headers).entries()) {
        headers.append(key, value);
      }
    }

    return request(requestUrl, {
      ...init,
      headers,
      method: 'PATCH',
      timeout: init?.timeout || this.#options.defaultTimeout,
    });
  }

  public delete(url: string | URL, init?: Omit<XHR.RequestInit, 'url' | 'method'>): Promise<XHR.Response> {
    const requestUrl = new URL(url, this.#base);

    const headers = new Headers(Object.fromEntries(this.#defaultHeaders.entries()));

    if(init?.headers) {
      for(const [key, value] of parseHeaders(init.headers).entries()) {
        headers.append(key, value);
      }
    }

    return request(requestUrl, {
      ...init,
      headers,
      method: 'DELETE',
      timeout: init?.timeout || this.#options.defaultTimeout,
    });
  }

  public options(url: string | URL, init?: Omit<XHR.RequestInit, 'url' | 'method'>): Promise<XHR.Response> {
    const requestUrl = new URL(url, this.#base);

    const headers = new Headers(Object.fromEntries(this.#defaultHeaders.entries()));

    if(init?.headers) {
      for(const [key, value] of parseHeaders(init.headers).entries()) {
        headers.append(key, value);
      }
    }

    return request(requestUrl, {
      ...init,
      headers,
      method: 'OPTIONS',
      timeout: init?.timeout || this.#options.defaultTimeout,
    });
  }

  public head(url: string | URL, init?: Omit<XHR.RequestInit, 'url' | 'method' | 'payload'>): Promise<XHR.Response> {
    const requestUrl = new URL(url, this.#base);

    const headers = new Headers(Object.fromEntries(this.#defaultHeaders.entries()));

    if(init?.headers) {
      for(const [key, value] of parseHeaders(init.headers).entries()) {
        headers.append(key, value);
      }
    }

    return request(requestUrl, {
      ...init,
      headers,
      method: 'HEAD',
      timeout: init?.timeout || this.#options.defaultTimeout,
    });
  }

  public connect(url: string | URL, init?: Omit<XHR.RequestInit, 'url' | 'method'>): Promise<XHR.Response> {
    const requestUrl = new URL(url, this.#base);

    const headers = new Headers(Object.fromEntries(this.#defaultHeaders.entries()));

    if(init?.headers) {
      for(const [key, value] of parseHeaders(init.headers).entries()) {
        headers.append(key, value);
      }
    }

    return request(requestUrl, {
      ...init,
      headers,
      method: 'CONNECT',
      timeout: init?.timeout || this.#options.defaultTimeout,
    });
  }

  public request(url: string | URL, init?: Omit<XHR.RequestInit, 'url'>): Promise<XHR.Response> {
    const requestUrl = new URL(url, this.#base);

    const headers = new Headers(Object.fromEntries(this.#defaultHeaders.entries()));

    if(init?.headers) {
      for(const [key, value] of parseHeaders(init.headers).entries()) {
        headers.append(key, value);
      }
    }

    return request(requestUrl, {
      ...init,
      headers,
      method: init?.method || 'GET',
      timeout: init?.timeout || this.#options.defaultTimeout,
    });
  }
}


export function createClient(baseUrl: string | URL, options?: ClientOptions): HttpClient {
  return new HttpClient(baseUrl, options);
}

export default createClient;
