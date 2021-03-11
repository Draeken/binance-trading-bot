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
