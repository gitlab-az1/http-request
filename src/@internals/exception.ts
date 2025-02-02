import bitwise from './bitwise';


export enum ERROR_CODE {
  ERR_UNKNOWN_ERROR = 1001,
  ERR_UNWRAP_NONE = 1002,
  ERR_TOKEN_CANCELLED = 1003,
  ERR_INVALID_ARGUMENT = 1004,
  ERR_LIMIT_REACHED = 1005,
  ERR_RESOURCE_DISPOSED = 1006,
  ERR_RESOURCE_ALREADY_CONSUMED = 1007,
  ERR_END_OF_STREAM = 1008,
  ERR_INVALID_TYPE = 1009,
  ERR_UNSUPPORTED_OPERATION = 1010,
  ERR_TIMEOUT = 1011,
}


export type ErrorOptions = {
  context?: any;
}

export class Exception extends Error {
  public override readonly name: string;
  public readonly context?: any;
  public readonly code: number;

  public constructor(message: string, code: keyof typeof ERROR_CODE | ERROR_CODE, options?: ErrorOptions) {
    super(message);

    const c = typeof code === 'number' ?
      code :
      ERROR_CODE[code] || ERROR_CODE.ERR_UNKNOWN_ERROR;

    this.name = 'Exception';
    this.context = options?.context;
    this.code = -Math.abs(bitwise.or(c, 0));
  }
}

export default Exception;
