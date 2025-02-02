import type { Dict, LooseAutocomplete } from '@rapid-d-kit/types';
import { assertDefinedString, assertUnsignedInteger } from '@rapid-d-kit/safe';
import { Disposable, IDisposable, disposeIfDisposable, toDisposable } from '@rapid-d-kit/disposable';

import Exception from './exception';


export type ListenerCallback<TArgs> = (...args: TArgs extends unknown[] ? TArgs : [TArgs]) => unknown;

export type EmitterOptions = {
  maxListeners?: number;
}

export class EventEmitter<T extends Dict<unknown> = Dict<unknown>> extends Disposable {
  readonly #listeners: Map<string | symbol, Set<ListenerCallback<T[keyof T]>>>;
  readonly #metadata: Map<string | symbol, Map<ListenerCallback<T[keyof T]>, {
    once: boolean;
    callsCount: number;
    thisArgs?: any;
  }>>;

  #maxListeners: number;
  #disposed: boolean;
  #state: number;

  public constructor(options?: EmitterOptions) {
    super();

    this.#listeners = new Map();
    this.#metadata = new Map();

    this.#maxListeners = options?.maxListeners || 30;
    assertUnsignedInteger(this.#maxListeners);

    this.#disposed = false;
    this.#state = 0;
  }

  public addListener<K extends keyof T>(
    event: LooseAutocomplete<K> | symbol,
    callback: ListenerCallback<T[K]>,
    thisArgs?: any,
    disposables?: IDisposable[],
    options?: { once?: boolean } // eslint-disable-line comma-dangle
  ): IDisposable {
    this.#ensureNotDisposed();

    if(typeof event !== 'symbol') {
      assertDefinedString(event);
    }

    if(!this.#listeners.has(event)) {
      this.#listeners.set(event, new Set());
    }

    if(!this.#metadata.has(event)) {
      this.#metadata.set(event, new Map());
    }

    const set = this.#listeners.get(event)!;

    if(set.has(callback as () => void))
      return toDisposable(() => {
        if(!Array.isArray(disposables))
          return;

        disposeIfDisposable(disposables);
      });

    if(set.size >= this.#maxListeners) {
      throw new Exception(`Maximum listeners limit reached for event "${String(event)}"`, 'ERR_LIMIT_REACHED');
    }

    set.add(callback as () => void);
    const metadata = this.#metadata.get(event)!;

    metadata.set(callback as () => void, {
      once: options?.once ?? false,
      callsCount: 0,
      thisArgs,
    });

    if(Array.isArray(disposables)) {
      for(let i = 0; i < disposables.length; i++) {
        super._register(disposables[i]);
      }
    }

    return toDisposable(() => {
      if(Array.isArray(disposables)) {
        disposeIfDisposable(disposables);
      }

      if(this.#disposed)
        return;

      metadata.delete(callback as () => void);
      set.delete(callback as () => void);

      if(set.size === 0) {
        this.#listeners.delete(event);
        this.#metadata.delete(event);
      }
    });
  }

  public removeListener<K extends keyof T>(
    event: LooseAutocomplete<K> | symbol,
    callback: ListenerCallback<T[K]> // eslint-disable-line comma-dangle
  ): boolean {
    this.#ensureNotDisposed();

    if(typeof event !== 'symbol') {
      assertDefinedString(event);
    }

    const set = this.#listeners.get(event);
    if(!set) return false;

    if(!set.delete(callback as () => void))
      return false;

    this.#metadata.get(event)?.delete(callback as () => void);

    if(set.size === 0) {
      this.#listeners.delete(event);
      this.#metadata.delete(event);
    }

    return true;
  }

  public removeManyListeners<K extends keyof T>(event: LooseAutocomplete<K> | symbol): boolean {
    this.#ensureNotDisposed();

    if(typeof event !== 'symbol') {
      assertDefinedString(event);
    }

    if(!this.#listeners.delete(event))
      return false;

    this.#metadata.delete(event);
    return true;
  }

  public removeAllListeners(): void {
    this.#ensureNotDisposed();

    this.#listeners.clear();
    this.#metadata.clear();

    this.#state++;
    super.clear();
  }

  public emit<K extends keyof T>(event: LooseAutocomplete<K> | symbol, ...args: T[K] extends unknown[] ? T[K] : [T[K]]): boolean {
    this.#ensureNotDisposed();

    if(typeof event !== 'symbol') {
      assertDefinedString(event);
    }

    const set = this.#listeners.get(event);
    if(!set) return false;

    const metadata = this.#metadata.get(event);
    if(!metadata) return false;

    for(const listener of [...set]) {
      const meta = metadata.get(listener);
      if(!meta) continue;

      listener.apply(typeof meta.thisArgs === 'object' ? meta.thisArgs : null, args);
      meta.callsCount++;

      if(meta.once) {
        set.delete(listener);
        metadata.delete(listener);

        if(set.size === 0) {
          this.#listeners.delete(event);
          this.#metadata.delete(event);
        }
      }
    }

    return true;
  }

  public fire(event: LooseAutocomplete<keyof T> | symbol): boolean {
    this.#ensureNotDisposed();

    if(typeof event !== 'symbol') {
      assertDefinedString(event);
    }

    const set = this.#listeners.get(event);
    if(!set) return false;

    const metadata = this.#metadata.get(event);
    if(!metadata) return false;

    for(const listener of [...set]) {
      const meta = metadata.get(listener);
      if(!meta) continue;

      listener(...([] as any));
      meta.callsCount++;

      if(meta.once) {
        set.delete(listener);
        metadata.delete(listener);

        if(set.size === 0) {
          this.#listeners.delete(event);
          this.#metadata.delete(event);
        }
      }
    }

    return true;
  }

  public listenerCount(event?: LooseAutocomplete<keyof T> | symbol): number {
    this.#ensureNotDisposed();

    if(typeof event === 'undefined' || event == null) {
      return Array.from(this.#listeners.values())
        .reduce((accumulator, current) => {
          accumulator += current.size;
          return accumulator;
        }, 0);
    }

    if(typeof event !== 'symbol') {
      assertDefinedString(event);
    }

    return this.#listeners.get(event)?.size ?? 0;
  }

  public eventNames(): (string | symbol)[] {
    this.#ensureNotDisposed();
    return Array.from(this.#listeners.keys());
  }

  public setMaxListeners(n: number): void {
    this.#ensureNotDisposed();

    assertUnsignedInteger(n);
    this.#maxListeners = n;
  }

  public getMaxListeners(): number {
    this.#ensureNotDisposed();
    return this.#maxListeners;
  }

  public override dispose(): void {
    super.dispose();

    if(!this.#disposed) {
      this.#listeners.clear();
      this.#metadata.clear();

      this.#disposed = true;
    }
  }

  #ensureNotDisposed(): void {
    if(this.#disposed) {
      throw new Exception('This event emitter was already disposed', 'ERR_RESOURCE_DISPOSED');
    }
  }
}
