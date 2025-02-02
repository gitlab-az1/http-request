import Exception from './exception';


const enum OptionType {
  None,
  Some,
}


const $type = Symbol('kOptionType');
const $value = Symbol('kOptionValue');


export type None = { [$type]: OptionType.None };
export type Some<T> = { [$type]: OptionType.Some; [$value]: T };
export type Option<T> = None | Some<T>;


export function isSome<T>(option: Option<T>): option is Some<T> {
  return option[$type] === OptionType.Some;
}

export function isNone<T>(option: Option<T>): option is None {
  return option[$type] === OptionType.None;
}


export const none: None = Object.freeze({ [$type]: OptionType.None });
export const some = <T>(value: T) => ({ [$value]: value, [$type]: OptionType.Some });


export function optionalCatch<T>(fn: () => T): Option<T> {
  try {
    return some(fn());
  } catch {
    return none;
  }
}

export async function optionalResolve<T>(p: Promise<T>): Promise<Option<T>> {
  try {
    return some(await p);
  } catch {
    return none;
  }
}


export function toOptional<I, O extends I>(fn: (input: I) => input is O): ((arg: I) => Option<O>) {
  return function(arg: I): Option<O> {
    try {
      return fn(arg) ? some(arg) : none;
    } catch {
      return none;
    }
  };
}

export const optionalDefined = toOptional( <T>(arg: T | null | undefined): arg is T => !!arg );


export const optionalBuffer = toOptional( (arg: Uint8Array | null | undefined): arg is Buffer => !!arg && Buffer.isBuffer(arg) );


export function unwrap<T>(option: Option<T>): T {
  if(option[$type] === OptionType.Some) return option[$value];
  throw new Exception('Cannot unwrap a None value', 'ERR_UNWRAP_NONE');
}

export function unwrapOr<T>(option: Option<T>, fallback: T): T {
  if(option[$type] === OptionType.Some) return option[$value];
  return fallback;
}

export function unwrapExpect<T>(option: Option<T>, message?: string): T {
  if(option[$type] !== OptionType.Some) {
    throw new Exception(message || 'Cannot unwrap a None value', 'ERR_UNWRAP_NONE');
  }

  return option[$value];
}


export abstract class OptionBody<T, TSome extends T> {
  readonly #option: Option<TSome>;

  public constructor(
    checker: (value: T) => value is TSome,
    value: T // eslint-disable-line comma-dangle
  ) {
    this.#option = toOptional(checker)(value);
  }

  public is_some(): this is Some<TSome> {
    return isSome(this.#option);
  }
  
  public is_none(): this is None {
    return isNone(this.#option);
  }

  public unwrap(): TSome {
    return unwrap(this.#option);
  }

  public unwrap_or(fallback: TSome): TSome {
    return unwrapOr(this.#option, fallback);
  }

  public unwrap_expect(message?: string): TSome {
    return unwrapExpect(this.#option, message);
  }
}

export class OptionDefined<T, TSome extends T = T> extends OptionBody<T, TSome> {
  public constructor(value: T | null | undefined) {
    super(((arg: any) => !!arg) as any, value as any);
  }
}


export function option<T>(value: T | null | undefined): OptionBody<T, T> {
  return new (class extends OptionBody<T, T> {
    public constructor(value: T | null | undefined) {
      super(((arg: any) => !!arg) as any, value as any);
    }
  })(value);
}
