import { Async } from '@rapid-d-kit/async';
import { IDisposable } from '@rapid-d-kit/disposable';
import type { LooseAutocomplete } from '@rapid-d-kit/types';

import { XHR } from '../xhr';
import bitwise from '../../@internals/bitwise';
import { option } from '../../@internals/option';
import Exception from '../../@internals/exception';
import { EventEmitter } from '../../@internals/events';
import { jsonSafeParser } from '../../@internals/safe-json';


export class BrowserResponse extends EventEmitter implements XHR.BrowserResponse {
  readonly #raw: Response;

  #bodyUsed: boolean;
  // @ts-expect-error The property 'totalLength' is used to emit progress events that are not implemented yet
  #totalLength: number;
  #headers: Map<string, string | string[]>;
  #emittedHeadersReceived: boolean;

  public constructor(raw: Response) {
    if(!(raw instanceof Response)) {
      throw new Exception(`Cannot construct a browser response with 'typeof ${typeof raw}'`, 'ERR_INVALID_ARGUMENT');
    }

    super();

    this.#raw = raw;
    this.#bodyUsed = false;
    this.#emittedHeadersReceived = false;

    this.#parseHeaders();
  }

  public get 'raw-headers'(): readonly [string, string | string[] | undefined][] {
    return Array.from(this.#headers.entries());
  }

  public get platformEnv() {
    return 'browser' as const;
  }

  public get status(): number {
    return this.#raw.status;
  }

  public get ok(): boolean {
    return bitwise.or(this.#raw.status / 100, 0) === 2;
  }

  public get bodyUsed(): boolean {
    return this.#bodyUsed;
  }

  public get redirected(): boolean {
    return this.#raw.redirected;
  }

  public get type(): XHR.BrowserResponse['type'] {
    return this.#raw.type;
  }

  public readableSource() {
    this.#ensureNotBodyUsed();

    this.#bodyUsed = true;
    return option(this.#raw.body);
  }

  public async text() {
    this.#ensureNotBodyUsed();

    if(!this.#raw.body) {
      this.#bodyUsed = true;
      return option<string>(void 0);
    }

    const result = await this.#raw.text();
    this.#bodyUsed = true;

    return option(result);
  }

  public async json<T>(): Promise<ReturnType<typeof option<T>>> {
    this.#ensureNotBodyUsed();

    if(!this.#raw.body) {
      this.#bodyUsed = true;
      return option<T>(void 0);
    }

    const result = await this.#raw.text();
    this.#bodyUsed = true;

    const parsed = jsonSafeParser<T>(result);

    if(parsed.isLeft()) {
      throw parsed.value;
    }

    return option(parsed.value);
  }

  public async arrayBuffer() {
    this.#ensureNotBodyUsed();

    if(!this.#raw.body) {
      this.#bodyUsed = true;
      return option<ArrayBuffer>(void 0);
    }

    const result = await this.#raw.arrayBuffer();
    this.#bodyUsed = true;

    return option(result);
  }

  public async bytes() {
    this.#ensureNotBodyUsed();

    if(!this.#raw.body) {
      this.#bodyUsed = true;
      return option<Uint8Array>(void 0);
    }

    const result = await this.#raw.bytes();
    this.#bodyUsed = true;

    return option(result);
  }

  public async blob() {
    this.#ensureNotBodyUsed();

    if(!this.#raw.body) {
      this.#bodyUsed = true;
      return option<Blob>(void 0);
    }

    const result = await this.#raw.blob();
    this.#bodyUsed = true;

    return option(result);
  }

  public async formData() {
    this.#ensureNotBodyUsed();

    if(!this.#raw.body) {
      this.#bodyUsed = true;
      return option<FormData>(void 0);
    }

    try {
      const result = await this.#raw.formData();
      this.#bodyUsed = true;

      return option(result);
    } catch {
      return option<FormData>(void 0);
    }
  }

  public buffer() {
    this.#ensureNotBodyUsed();
    return Promise.resolve(option<Buffer>(void 0));
  }

  public clone(): BrowserResponse {
    return new BrowserResponse(this.#raw.clone());
  }

  public on<K extends keyof XHR.DefaultEventsMap>(
    event: LooseAutocomplete<K>,
    listener: (...args: EnsureArray<XHR.DefaultEventsMap[K]>) => unknown,
    thisArgs?: any,
    disposables?: IDisposable[] // eslint-disable-line comma-dangle
  ): IDisposable {
    if(event === 'headers-received' && !this.#emittedHeadersReceived) {
      Async.delay()
        .then(() => {
          Async.resolveNextTick()
            .then(() => {
              super.emit('headers-received', {
                statusCode: this.#raw.status,
                headers: Array.from(this.#headers.entries()),
              } satisfies XHR.InitialHeaders);
            });
        });

      this.#emittedHeadersReceived = true;
    }

    return super.addListener(
      event,
      listener as () => void,
      thisArgs,
      disposables,
      { once: false } // eslint-disable-line comma-dangle
    );
  }

  public once<K extends keyof XHR.DefaultEventsMap>(
    event: LooseAutocomplete<K>,
    listener: (...args: EnsureArray<XHR.DefaultEventsMap[K]>) => unknown,
    thisArgs?: any,
    disposables?: IDisposable[] // eslint-disable-line comma-dangle
  ): IDisposable {
    if(event === 'headers-received' && !this.#emittedHeadersReceived) {
      Async.delay()
        .then(() => {
          Async.resolveNextTick()
            .then(() => {
              super.emit('headers-received', {
                statusCode: this.#raw.status,
                headers: Array.from(this.#headers.entries()),
              } satisfies XHR.InitialHeaders);
            });
        });

      this.#emittedHeadersReceived = true;
    }

    return super.addListener(
      event,
      listener as () => void,
      thisArgs,
      disposables,
      { once: true } // eslint-disable-line comma-dangle
    );
  }

  public off<K extends keyof XHR.DefaultEventsMap>(
    event: LooseAutocomplete<K>,
    listener: (...args: EnsureArray<XHR.DefaultEventsMap[K]>) => unknown // eslint-disable-line comma-dangle
  ): boolean {
    return super.removeListener(event, listener as () => void);
  }

  public override dispose(): void {
    super.dispose();
    this.#raw.body?.cancel();
  }

  #parseHeaders(): void {
    if(this.#headers || !this.#raw) return;

    this.#headers = new Map();
    this.#totalLength = 0;

    for(const [key, value] of this.#raw.headers.entries()) {
      const k = key.toLowerCase().trim();

      if(k === 'content-length') {
        const length = parseInt(value, 10);

        if(!isNaN(length)) {
          this.#totalLength = length;
        }
      }

      if(!this.#headers.has(k)) {
        this.#headers.set(k, value);
        continue;
      }

      const existent = this.#headers.get(k) as string | string[];

      if(Array.isArray(existent)) {
        existent.push(value);
        continue;
      }

      this.#headers.set(k, [existent, value]);
    }
  }

  #ensureNotBodyUsed(): void {
    if(this.#bodyUsed) {
      throw new Exception('You can only use a http response body one time', 'ERR_RESOURCE_ALREADY_CONSUMED');
    }
  }
}

export default BrowserResponse;
