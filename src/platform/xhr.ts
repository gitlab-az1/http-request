/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable no-inner-declarations */

import { ICancellationToken } from '@rapid-d-kit/async';
import type { CommonHttpHeaders, HttpMethod, MaybePromise } from '@rapid-d-kit/types';

import { option } from '../@internals/option';


export namespace XHR {
  export interface ProgressEvent {
    readonly lengthComputable: boolean;
    readonly total: number;
    readonly loaded: number;
  }

  export interface InitialHeaders {
    readonly statusCode: number;
    readonly headers: readonly [string, string | string[] | undefined][];
  }

  export interface DefaultEventsMap {
    progress: [ event: ProgressEvent ];
    upload: [ event: ProgressEvent ];
    'headers-received': [ headers: InitialHeaders ];
    dispose: [];
  }

  export interface RequestInit {
    url?: string | URL;
    method: HttpMethod;
    token?: ICancellationToken;
    user?: string;
    password?: string;
    credentials?: 'include' | 'omit' | 'same-origin';
    headers?: Headers | [string, string | string[] | undefined][] | (CommonHttpHeaders & {
      [key: Exclude<string, keyof CommonHttpHeaders>]: string | string[] | undefined;
    });
    timeout?: number;
    delay?: number;
    strictSSL?: boolean;
    followRedirects?: number;
    mode?: RequestMode;
    agent?: HttpProxyAgent | HttpsProxyAgent;
    payload?: string | Uint8Array | Blob | FormData | ReadableStream | import('stream').Readable;
  }

  export interface AbstractResponse {
    readonly ok: boolean;
    readonly status: number;
    readonly bodyUsed: boolean;
    readonly redirected: boolean;
    readonly 'raw-headers': readonly [string, string | string[] | undefined][];
    readonly type: 'basic' | 'cors' | 'default' | 'error' | 'opaque' | 'opaqueredirect';

    text(): Promise<ReturnType<typeof option<string>>>;
    arrayBuffer(): Promise<ReturnType<typeof option<ArrayBuffer>>>;
    bytes(): Promise<ReturnType<typeof option<Uint8Array>>>;
    buffer(): Promise<ReturnType<typeof option<Buffer>>>;
    json<T>(): Promise<ReturnType<typeof option<T>>>;
    blob(): Promise<ReturnType<typeof option<Blob>>>;
    formData(): Promise<ReturnType<typeof option<FormData>>>;
    clone(): AbstractResponse;
  }

  export interface BrowserResponse extends AbstractResponse {
    readonly platformEnv: 'browser';
    
    readableSource(): MaybePromise<ReturnType<typeof option<ReadableStream<Uint8Array>>>>;
    clone(): BrowserResponse;
  }

  export interface NodeResponse extends AbstractResponse {
    readonly platformEnv: 'node';

    readableSource(): MaybePromise<ReturnType<typeof option<import('stream').Readable>>>;
    clone(): NodeResponse;
  }

  export type Response = BrowserResponse | NodeResponse;

  export type HttpProxyAgent = unknown;
  export type HttpsProxyAgent = unknown;
}


export function parseHeaders(source: XHR.RequestInit['headers']): Headers {
  if(source instanceof Headers)
    return source;

  const result = new Headers();

  if(Array.isArray(source)) {
    for(let i = 0; i < source.length; i++) {
      const [key, values] = source[i];
      
      if(typeof values === 'undefined')
        continue;

      if(Array.isArray(values)) {
        for(let j = 0; j < values.length; j++) {
          result.append(key.toLowerCase().trim(), values[j]);
        }
      } else {
        result.append(key.toLowerCase().trim(), values);
      }
    }
  } else if(typeof source === 'object') {
    for(const [key, values] of Object.entries(source).filter(([, v]) => typeof v === 'string' || Array.isArray(v))) {
      if(typeof values === 'undefined')
        continue;

      if(Array.isArray(values)) {
        for(let j = 0; j < values.length; j++) {
          result.append(key.toLowerCase().trim(), values[j]);
        }
      } else {
        result.append(key.toLowerCase().trim(), values);
      }
    }
  }

  return result;
}

export function headersEntries(source: XHR.RequestInit['headers']): readonly [string, string | string[] | undefined][] {
  const headers = parseHeaders(source);
  const result: [string, string | string[] | undefined][] = [];

  for(const [key, value] of headers.entries()) {
    const values = value.split(',').map(item => item.trim());

    result.push([
      key.toLowerCase().trim(),
      values.length === 1 ? values[0] : values,
    ]);
  }

  return result;
}
