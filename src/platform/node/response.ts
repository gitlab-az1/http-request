import { Readable } from 'stream';
import { IncomingMessage } from 'http';
import { IDisposable } from '@rapid-d-kit/disposable';
import { LooseAutocomplete } from '@rapid-d-kit/types';

import { XHR } from '../xhr';
import bitwise from '../../@internals/bitwise';
import { option } from '../../@internals/option';
import Exception from '../../@internals/exception';
import { EventEmitter } from '../../@internals/events';
import { jsonSafeParser } from '../../@internals/safe-json';
import { BufferWriter, chunkToBuffer } from '../../@internals/stream';


export function hasNoBody(method: string, code: number): boolean {
  return method === 'HEAD' ||
  /* Informational */ (code >= 100 && code < 200) ||
  /* No Content */  code === 204 ||
  /* Not Modified */ code === 304;
}

export class NodeResponse extends EventEmitter implements XHR.NodeResponse {
  static #hasNoBody(ins: NodeResponse): boolean {
    const method = String(ins.#raw.method).toUpperCase();
    const code = ins.#raw.statusCode || 0;

    return hasNoBody(method, code);
  }

  readonly #raw: IncomingMessage;
  readonly #bodyWriter: BufferWriter;
  readonly #redirected: boolean;

  #bodyUsed: boolean;
  #totalLength: number;
  #responseStreamProcessed: boolean;
  #headers: Map<string, string | string[] | undefined>;

  public constructor(raw: IncomingMessage, redirected: boolean) {
    if(!isResponse(raw)) {
      throw new Exception(`Cannot construct a node response with 'typeof ${typeof raw}'`, 'ERR_INVALID_ARGUMENT');
    }

    super();

    this.#raw = raw;
    this.#totalLength = 0;
    this.#bodyUsed = false;
    this.#redirected = redirected;
    this.#responseStreamProcessed = false;
    this.#bodyWriter = new BufferWriter();

    this.#parseHeaders();
    this.#init();
  }

  public get 'raw-headers'(): readonly [string, string | string[] | undefined][] {
    return Array.from(this.#headers.entries());
  }
  
  public get platformEnv() {
    return 'node' as const;
  }
  
  public get status(): number {
    return this.#raw.statusCode || 0;
  }
  
  public get ok(): boolean {
    return bitwise.or((this.#raw.statusCode || 0) / 100, 0) === 2;
  }
  
  public get bodyUsed(): boolean {
    return this.#bodyUsed;
  }
  
  public get redirected(): boolean {
    return this.#redirected;
  }
  
  public get type(): XHR.BrowserResponse['type'] {
    return 'default';
  }

  public async text() {
    this.#ensureNotBodyUsed();

    if(NodeResponse.#hasNoBody(this)) {
      this.#bodyUsed = true;
      return option<string>(void 0);
    }

    const buffer = await this.#consumeStream();
    this.#bodyUsed = true;

    return option(buffer.toString('utf8'));
  }

  public async json<T>(): Promise<ReturnType<typeof option<T>>> {
    this.#ensureNotBodyUsed();

    if(NodeResponse.#hasNoBody(this)) {
      this.#bodyUsed = true;
      return option<T>(void 0);
    }

    const buffer = await this.#consumeStream();
    this.#bodyUsed = true;

    const parsed = jsonSafeParser<T>(buffer.toString('utf8'));

    if(parsed.isLeft()) {
      throw parsed.value;
    }

    return option(parsed.value);
  }

  public async bytes() {
    this.#ensureNotBodyUsed();

    if(NodeResponse.#hasNoBody(this)) {
      this.#bodyUsed = true;
      return option<Uint8Array>(void 0);
    }

    const buffer = await this.#consumeStream();
    this.#bodyUsed = true;

    return option(new Uint8Array(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength // eslint-disable-line comma-dangle
    ));
  }

  public async blob() {
    this.#ensureNotBodyUsed();

    if(NodeResponse.#hasNoBody(this)) {
      this.#bodyUsed = true;
      return option<Blob>(void 0);
    }

    const buffer = await this.#consumeStream();
    this.#bodyUsed = true;

    return option(new Blob([ buffer ]));
  }

  public async arrayBuffer() {
    this.#ensureNotBodyUsed();

    if(NodeResponse.#hasNoBody(this)) {
      this.#bodyUsed = true;
      return option<ArrayBuffer>(void 0);
    }

    const buffer = await this.#consumeStream();
    this.#bodyUsed = true;

    return option(await new Blob([ buffer ]).arrayBuffer());
  }

  public async buffer() {
    this.#ensureNotBodyUsed();

    if(NodeResponse.#hasNoBody(this)) {
      this.#bodyUsed = true;
      return option<Buffer>(void 0);
    }

    const buffer = await this.#consumeStream();
    this.#bodyUsed = true;

    return option(buffer);
  }

  public formData() {
    this.#ensureNotBodyUsed();
    return Promise.resolve(option<FormData>(void 0));
  }

  public async readableSource() {
    this.#ensureNotBodyUsed();
    await this.#consumeStream();

    if(NodeResponse.#hasNoBody(this)) {
      this.#bodyUsed = true;
      return option<Readable>(void 0);
    }

    this.#bodyUsed = true;

    let index = 0;
    const buffers = this.#bodyWriter.return();

    return option(new Readable({
      read() { this.push(index < buffers.length ? buffers[index++] : null); },
      emitClose: true,
    }));
  }

  public clone(): NodeResponse {
    throw new Exception('Unable to clone a node response object', 'ERR_UNSUPPORTED_OPERATION');
  }

  public on<K extends keyof XHR.DefaultEventsMap>(
    event: LooseAutocomplete<K>,
    listener: (...args: EnsureArray<XHR.DefaultEventsMap[K]>) => unknown,
    thisArgs?: any,
    disposables?: IDisposable[] // eslint-disable-line comma-dangle
  ): IDisposable {
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
    this.#raw.destroy();
  }

  #init() {
    if(this.#responseStreamProcessed)
      return;

    if(NodeResponse.#hasNoBody(this)) {
      this.#responseStreamProcessed = true;
      return;
    }

    return new Promise<void>((resolve, reject) => {
      this.#raw.on('error', reject);
      this.#raw.on('end', () => {
        this.#responseStreamProcessed = true;
        resolve();
      });

      this.#raw.on('data', chunk => {
        const buffer = chunkToBuffer(chunk);
        this.#bodyWriter.write(buffer);
        
        super.emit('progress', {
          loaded: this.#bodyWriter.byteLength,
          total: this.#totalLength,
          lengthComputable: true,
        } satisfies XHR.ProgressEvent);
      });
    });
  }

  #parseHeaders(): void {
    if(this.#headers || !this.#raw) return;
    this.#headers = new Map();

    for(const [key, values] of Object.entries(this.#raw.headers)) {
      if(typeof values === 'undefined') continue;
      const k = key.toLowerCase().trim();

      if(k === 'content-length') {
        let value = '0';

        if(Array.isArray(values)) {
          value = String(values[values.length - 1]);
        } else {
          value = String(values);
        }

        const length = parseInt(value, 10);

        if(!isNaN(length)) {
          this.#totalLength = length;
        }
      }

      if(!this.#headers.has(k)) {
        this.#headers.set(k, Array.isArray(values) ? values.map(String) : String(values));
        continue;
      }

      const existent = this.#headers.get(k) as string | string[];

      if(Array.isArray(existent)) {
        existent.push(...( Array.isArray(values) ? values.map(String) : [String(values)] ));
        continue;
      }

      this.#headers.set(k, [existent, ...( Array.isArray(values) ? values.map(String) : [String(values)] )]);
    }

    super.emit('headers-received', {
      statusCode: this.#raw.statusCode!,
      headers: Array.from(this.#headers.entries()),
    } satisfies XHR.InitialHeaders);
  }

  async #consumeStream(): Promise<Buffer> {
    if(!this.#responseStreamProcessed) {
      await new Promise(resolve => {
        this.#raw.once('end', resolve);
      });
    }
    
    return Buffer.from(
      this.#bodyWriter.buffer.buffer,
      this.#bodyWriter.buffer.byteOffset,
      this.#bodyWriter.buffer.byteLength // eslint-disable-line comma-dangle
    );
  }

  #ensureNotBodyUsed(): void {
    if(this.#bodyUsed) {
      throw new Exception('You can only use a http response body one time', 'ERR_RESOURCE_ALREADY_CONSUMED');
    }
  }
}


function isResponse(arg: unknown): arg is IncomingMessage {
  if(arg instanceof IncomingMessage)
    return true;

  const candidate = (arg as IncomingMessage);

  return (
    typeof candidate.pipe === 'function' &&
    typeof candidate.statusCode === 'number' &&
    typeof candidate.headers === 'object' &&
    typeof candidate.httpVersion === 'string'
  );
}


export default NodeResponse;
