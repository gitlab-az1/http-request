import { assertUnsignedInteger } from '@rapid-d-kit/safe';

import Exception from './exception';


export interface IReader<T extends Uint8Array | Buffer = Uint8Array> {
  read(): T;

  readonly readable: boolean;
  readonly byteLength: number;
}

export interface IWriter<T extends Uint8Array | Buffer = Uint8Array> {
  write(chunk: T): void;
  drain(): T;
}


export class BufferWriter implements IWriter<Buffer> {
  #buffers: Buffer[] = [];

  public get buffer(): Buffer {
    return Buffer.concat(this.#buffers);
  }

  public get chunks(): Buffer[] {
    return [ ...this.#buffers ];
  }

  public get byteLength(): number {
    return this.#buffers.reduce((accumulator, current) => {
      return (accumulator += current.byteLength);
    }, 0);
  }

  public write(chunk: Buffer): void {
    this.#buffers.push(chunk);
  }

  public drain(): Buffer {
    const result = Buffer.concat(this.#buffers);
    this.#buffers = [];

    return result;
  }

  public return(): Buffer[] {
    const result = this.#buffers;
    this.#buffers = [];

    return result;
  }
}

export class BufferReader implements IReader<Buffer> {
  #cursor: number = 0;
  readonly #buffer: Buffer;

  public constructor( _buffer: Buffer ) {
    if(!Buffer.isBuffer(_buffer)) {
      throw new Exception(`Cannot create a reader from a non-buffer argument 'typeof ${typeof _buffer}'`, 'ERR_INVALID_ARGUMENT');
    }

    this.#buffer = _buffer;
  }

  public read(bytes?: number): Buffer {
    if(this.#cursor >= this.#buffer.byteLength) {
      throw new Exception('The buffer has already been completely consumed', 'ERR_END_OF_STREAM');
    }

    if(typeof bytes !== 'number') {
      this.#cursor = this.#buffer.byteLength;
      return this.#buffer.subarray(0);
    }

    assertUnsignedInteger(bytes);
    const chunk = this.#buffer.subarray(this.#cursor, this.#cursor + bytes);

    this.#cursor += chunk.byteLength;
    return chunk;
  }

  public get readable(): boolean {
    return this.#cursor < this.#buffer.byteLength;
  }

  public get byteLength(): number {
    return this.#buffer.byteLength - this.#cursor;
  }
}



export function chunkToBuffer(chunk: any): Buffer {
  if(Buffer.isBuffer(chunk)) return chunk;
  if(typeof chunk === 'string') return Buffer.from(chunk);
  if(chunk instanceof ArrayBuffer) return Buffer.from(chunk);
  if(chunk instanceof Uint8Array) return Buffer.from(chunk);
  if(chunk instanceof Uint16Array) return Buffer.from(chunk);
  if(chunk instanceof Uint32Array) return Buffer.from(chunk);
  if(chunk instanceof Int8Array) return Buffer.from(chunk);
  if(chunk instanceof Int16Array) return Buffer.from(chunk);
  if(chunk instanceof Int32Array) return Buffer.from(chunk);
  if(chunk instanceof Float32Array) return Buffer.from(chunk);
  if(chunk instanceof Float64Array) return Buffer.from(chunk);
  if(chunk instanceof SharedArrayBuffer) return Buffer.from(chunk);
  if(chunk instanceof DataView) return Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  if(ArrayBuffer.isView(chunk)) return Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);

  throw new Exception('Received non-buffer chunk', 'ERR_INVALID_TYPE');
}
