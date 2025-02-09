import { assertUnsignedInteger } from '@rapid-d-kit/safe';
import { Async, CancellationToken, promises } from '@rapid-d-kit/async';

import { XHR } from '../xhr';
import BrowserResponse from './response';
import { isPlainObject } from '../../@internals/util';
import { Exception } from '../../@internals/exception';


export function request(url: string | URL, init?: Omit<XHR.RequestInit, 'url'>): Promise<BrowserResponse>;
export function request(init: Omit<XHR.RequestInit, 'url'> & { url: string | URL }): Promise<BrowserResponse>;
export function request(
  urlOrInit: string | URL | Omit<XHR.RequestInit, 'url'> & { url: string | URL },
  init?: Omit<XHR.RequestInit, 'url'> // eslint-disable-line comma-dangle
): Promise<BrowserResponse> {
  let u: string | URL;
  let options: XHR.RequestInit = init || {} as any;

  if(typeof urlOrInit !== 'string' && !(urlOrInit instanceof URL)) {
    u = urlOrInit.url;
    options = urlOrInit;
  } else {
    u = urlOrInit;
  }

  return promises.withAsyncBody(async (resolve, reject) => {
    if(options.delay) {
      assertUnsignedInteger(options.delay);

      await Async.delay(options.delay);
      await Async.resolveNextTick();
    }

    const token = options.token || CancellationToken.None;
    const ac = new AbortController();

    if(token.isCancellationRequested) {
      throw new Exception('Asynchronous http request was cancelled by token', 'ERR_TOKEN_CANCELLED');
    }

    token.onCancellationRequested(reason => {
      ac.abort(reason);
      throw new Exception('Asynchronous http request was cancelled by token', 'ERR_TOKEN_CANCELLED');
    });

    const reqInit: globalThis.RequestInit = {
      body: options.payload as any,
      method: String(options.method || 'GET'),
      mode: options.mode || 'cors',
      redirect: options.followRedirects ? 'follow' : 'manual',
      signal: ac.signal,
      headers: new Headers(),
      credentials: options.credentials,
    };

    if(Array.isArray(options.headers)) {
      for(const [key, value] of options.headers) {
        if(typeof value === 'undefined')
          continue;

        if(Array.isArray(value)) {
          value.forEach(v => (reqInit.headers as Headers).append(key, v));
        } else {
          (reqInit.headers as Headers).append(key, value);
        }
      }
    } else if(options.headers instanceof globalThis.Headers) {
      reqInit.headers = options.headers;
    } else if(typeof options.headers === 'object' && isPlainObject(options.headers)) {
      for(const [key, value] of Object.entries(options.headers)) {
        if(typeof value === 'undefined')
          continue;

        if(Array.isArray(value)) {
          value.forEach(v => (reqInit.headers as Headers).append(key, v));
        } else {
          (reqInit.headers as Headers).append(key, value);
        }
      }
    }

    if(options.user && options.password) {
      (reqInit.headers as Headers).append('Authorization', 'Basic ' + btoa(`${options.user}:${options.password}`));
    }

    if(typeof options.timeout === 'number') {
      assertUnsignedInteger(options.timeout);

      Promise.race<Response>([
        fetch(u, reqInit),
        new Promise((_, reject) => {
          setTimeout(() => {
            ac.abort();
            reject(new Exception(`Timeout exceded while trying to connect to '${u.toString()}' in ${options.timeout}ms`, 'ERR_TIMEOUT'));
          }, options.timeout);
        }),
      ])
        .then(res => {
          resolve(new BrowserResponse(res));
        }, reject);
    } else {
      fetch(u, reqInit)
        .then(res => {
          resolve(new BrowserResponse(res));
        }, reject);
    }
  });
}
