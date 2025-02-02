import * as zlib from 'zlib';
import * as http from 'http';
import * as https from 'https';
import { Readable } from 'stream';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { Url, parse as parseUrl, format } from 'url';
import { assertUnsignedInteger } from '@rapid-d-kit/safe';
import { Async, CancellationToken, promises } from '@rapid-d-kit/async';

import { XHR } from '../xhr';
import Exception from '../../@internals/exception';
import NodeResponse, { hasNoBody } from './response';
import { isPlainObject } from '../../@internals/util';


let proxyUrl: string | undefined = undefined;
let strictSSL: boolean = true;

export const configure = (_proxyUrl: string | undefined, _strictSSL: boolean) => {
  proxyUrl = _proxyUrl;
  strictSSL = _strictSSL;
};


export function request(url: string | URL, init?: Omit<XHR.RequestInit, 'url'>): Promise<NodeResponse>;
export function request(init: Omit<XHR.RequestInit, 'url'> & { url: string | URL }): Promise<NodeResponse>;
export function request(
  urlOrInit: string | URL | Omit<XHR.RequestInit, 'url'> & { url: string | URL },
  init?: Omit<XHR.RequestInit, 'url'> // eslint-disable-line comma-dangle
): Promise<NodeResponse> {
  let u: string | URL;
  let options: XHR.RequestInit = init || {} as any;

  if(typeof urlOrInit !== 'string' && !(urlOrInit instanceof URL)) {
    u = urlOrInit.url;
    options = urlOrInit;
  } else {
    u = urlOrInit;
  }

  if(typeof options.strictSSL !== 'boolean') {
    options.strictSSL = strictSSL;
  }

  if(!options.agent) {
    options.agent = getProxyAgent(u, { proxyUrl, strictSSL });
  }

  if(typeof options.followRedirects !== 'number') {
    options.followRedirects = 5;
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

    let req: http.ClientRequest;
    let redirected: boolean = false;

    const endpoint = parseUrl(u.toString());
    let headers = new Headers();

    if(Array.isArray(options.headers)) {
      for(const [key, value] of options.headers) {
        if(typeof value === 'undefined')
          continue;
    
        if(Array.isArray(value)) {
          value.forEach(v => headers.append(key, v));
        } else {
          headers.append(key, value);
        }
      }
    } else if(options.headers instanceof globalThis.Headers) {
      headers = options.headers;
    } else if(typeof options.headers === 'object' && isPlainObject(options.headers)) {
      for(const [key, value] of Object.entries(options.headers)) {
        if(typeof value === 'undefined')
          continue;
    
        if(Array.isArray(value)) {
          value.forEach(v => headers.append(key, v));
        } else {
          headers.append(key, value);
        }
      }
    }

    const normalizedHeaders: Record<string, string | string[] | undefined> = {};

    for(const [key, value] of headers.entries()) {
      if(!(key in normalizedHeaders)) {
        normalizedHeaders[key] = value;
        continue;
      }

      const existent = normalizedHeaders[key];

      if(Array.isArray(existent)) {
        existent.push(value);
        continue;
      }

      normalizedHeaders[key] = [existent, value].filter(Boolean) as string[];
    }

    const opts: https.RequestOptions = {
      hostname: endpoint.hostname,
      agent: options.agent ? options.agent as http.Agent : false,
      port: endpoint.port ? parseInt(endpoint.port) : (endpoint.protocol === 'https:' ? 443 : 80),
      path: endpoint.path,
      method: options.method?.toString() || 'GET',
      headers: normalizedHeaders,
      rejectUnauthorized: (typeof options.strictSSL === 'boolean') ? options.strictSSL : true,
      timeout: options.timeout,
      signal: ac.signal,
    };
    
    if(options.user && options.password) {
      opts.auth = options.user + ':' + options.password;
    }

    const handler = (res: http.IncomingMessage) => {
      if(res.statusCode! >= 300 && res.statusCode! < 400 && options.followRedirects && options.followRedirects > 0 && res.headers['location']) {
        let location = res.headers['location'];

        if(location.startsWith('/')) {
          location = format({
            protocol: endpoint.protocol,
            hostname: endpoint.hostname,
            port: endpoint.port,
            pathname: location,
          });
        }

        redirected = true;

        resolve(<any>request(assign({}, options, {
          url: location,
          followRedirects: options.followRedirects - 1,
        })));
      } else {
        let readable: Readable = res;
        const encoding = res.headers && res.headers['content-encoding'];

        if(encoding && !hasNoBody(options.method?.toString() || 'GET', res.statusCode!)) {
          const zlibOptions = {
            flush: zlib.constants.Z_SYNC_FLUSH,
            finishFlush: zlib.constants.Z_SYNC_FLUSH,
          };

          if(encoding === 'gzip') {
            const gunzip = zlib.createGunzip(zlibOptions);

            res.pipe(gunzip);
            readable = gunzip;
          } else if(encoding === 'deflate') {
            const inflate = zlib.createInflate(zlibOptions);

            res.pipe(inflate);
            readable = inflate;
          }
        }

        resolve(new NodeResponse(
          new WrappedResponse(res, readable) as unknown as http.IncomingMessage,
          redirected // eslint-disable-line comma-dangle
        ));
        
        if(token.isCancellationRequested) {
          readable.destroy();
        }

        token.onCancellationRequested(() => {
          readable.destroy();
        });
      }
    };

    if(endpoint.protocol === 'https:') {
      req = https.request(opts, handler);
    } else {
      req = http.request(opts, handler);
    }

    req.on('error', reject);

    if(options.timeout) {
      req.setTimeout(options.timeout);
    }

    if(options.payload) {
      if(options.payload instanceof Readable) {
        options.payload.pipe(req);
      } else {
        req.write(options.payload);
      }
    }

    req.end();

    if(token.isCancellationRequested) {
      req.destroy(new Exception('Asynchronous http request has cancelled by token', 'ERR_TOKEN_CANCELLED'));
    }

    token.onCancellationRequested(() => {
      req.destroy(new Exception('Asynchronous http request has cancelled by token', 'ERR_TOKEN_CANCELLED'));
    });
  });
}


function assign(destination: any, ...sources: any[]): any {
  sources.forEach(source => Object.keys(source).forEach((key) => destination[key] = source[key]));
  return destination;
}

function getSystemProxyURI(requestURL: Url): string | null {
  if(requestURL.protocol === 'http:')
    return process.env.HTTP_PROXY || process.env.http_proxy || null;

  if(requestURL.protocol === 'https:')
    return process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || null;

  return null;
}

type ProxyOptions = {
	proxyUrl?: string;
	strictSSL?: boolean;
}

function getProxyAgent(rawRequestURL: string | URL, options: ProxyOptions = {}): HttpProxyAgent<string> | HttpsProxyAgent<string> | null | undefined {
  const requestURL = parseUrl(rawRequestURL.toString());
  const proxyURL = options.proxyUrl || getSystemProxyURI(requestURL);

  if(!proxyURL)
    return null;

  if(!/^https?:/.test(proxyURL))
    return null;

  return requestURL.protocol === 'http:' ? new HttpProxyAgent(proxyURL) : new HttpsProxyAgent(proxyURL, { rejectUnauthorized: options.strictSSL ?? true });
}


class WrappedResponse extends Readable {
  public readonly headers: http.IncomingHttpHeaders;
  public readonly statusCode?: number;
  public readonly statusMessage?: string;
  public readonly httpVersion: string;

  public constructor(originalRes: http.IncomingMessage, decompressedStream: Readable) {
    super();

    this.headers = originalRes.headers;
    this.statusCode = originalRes.statusCode;
    this.statusMessage = originalRes.statusMessage;
    this.httpVersion = originalRes.httpVersion;

    decompressedStream.on('end', () => this.push(null));
    decompressedStream.on('data', (chunk) => this.push(chunk));
    decompressedStream.on('error', (err) => this.emit('error', err));
  }

  public _read() { }
}
