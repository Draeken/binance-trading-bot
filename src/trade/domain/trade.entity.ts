import { AltCoin, Coin } from './coin.entity';

export enum TradeStatus {
  'CANCELED',
  'EXPIRED',
  'FILLED',
  'NEW',
  'PARTIALLY_FILLED',
  'PENDING_CANCEL',
  'REJECTED',
}
export class Trade {
  private createdAt: number;
  private lastUpdateAt: number;
  private status: TradeStatus;
  private id: number;
  private _quote: Coin;
  private _base: Coin;
  private _type: 'SELL' | 'BUY';

  constructor(private _from: Coin, private _to: Coin, private _amount: number) {
    this.createdAt = Date.now();
    this.lastUpdateAt = Date.now();
    if (_from.isBridge) {
      this._quote = _from;
      this._base = _to;
      this._type = 'BUY';
    } else if (_to.isBridge) {
      this._quote = _to;
      this._base = _from;
      this._type = 'SELL';
    } else {
      const { base, quote } = (_from as AltCoin).pairInfo(_to);
      this._quote = quote;
      this._base = base;
      this._type = _from === base ? 'SELL' : 'BUY';
    }
  }

  updateAfterInit(id: number, status: TradeStatus) {
    this.lastUpdateAt = Date.now();
    this.id = id;
    this.status = status;
  }

  get isFromBridge() {
    return this._from.isBridge;
  }

  get operation() {
    return { type: this._type, base: this._base, quote: this._quote };
  }

  get from() {
    return this._from;
  }

  get to() {
    return this._to;
  }

  get amount() {
    return this._amount;
  }
}
