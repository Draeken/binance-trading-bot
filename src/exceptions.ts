export class InvalidProps<P> extends Error {
  private _prop: keyof P;

  constructor(message: string, prop: keyof P) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
    this._prop = prop;
  }

  get prop() {
    return this._prop;
  }
}

export class FailedCoinFilter extends Error {
  private _message: string;
  constructor(
    coinCode: string,
    filterName: string,
    expected: number,
    actual: number,
  ) {
    const message = `Failed filter: ${filterName} on ${coinCode}. Expected: ${expected}, receive: ${actual}`;
    super(message);
    this._message = message;
    Error.captureStackTrace(this, this.constructor);
  }

  get message() {
    return this._message;
  }
}
