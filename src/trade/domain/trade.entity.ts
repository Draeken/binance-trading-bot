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

export interface TradeBaseQuoteAmount {
  base: number;
  quote: number;
}

export interface TradeFromToAmount {
  from: number;
  to: number;
}

export class Trade {
  private createdAt: number;
  private lastUpdateAt: number;
  private status: TradeStatus;
  private id: number;
  private _quote: Coin;
  private _base: AltCoin;
  private _type: 'SELL' | 'BUY';
  private executedAmount: TradeBaseQuoteAmount = { base: 0, quote: 0 };

  constructor(
    private _from: Coin,
    private _to: Coin,
    private _amount: number,
    private onFilled: (amount?: TradeFromToAmount) => void,
  ) {
    this.createdAt = Date.now();
    this.lastUpdateAt = Date.now();
    if (_from.isBridge) {
      this._quote = _from;
      this._base = _to as AltCoin;
      this._type = 'BUY';
    } else if (_to.isBridge) {
      this._quote = _to;
      this._base = _from as AltCoin;
      this._type = 'SELL';
    } else {
      const { base, quote } = (_from as AltCoin).pairInfo(_to);
      this._quote = quote;
      this._base = base as AltCoin;
      this._type = _from === base ? 'SELL' : 'BUY';
    }
  }

  updateAfterInit(
    id: number,
    status: TradeStatus,
    amount: TradeBaseQuoteAmount,
  ) {
    this.executedAmount = amount;
    this.lastUpdateAt = Date.now();
    this.id = id;
    this.status = status;
    this.handleStatus();
  }

  get isFromBridge() {
    return this._from.isBridge;
  }

  get operation() {
    return {
      type: this._type,
      base: this._base,
      quote: this._quote,
    };
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

  private handleStatus() {
    switch (this.status) {
      case TradeStatus.FILLED:
        return this.onFilled(this.tradeAmountBQtoFT());
      case TradeStatus.PARTIALLY_FILLED:
        return this.onFilled();
      default:
        // ask for a new order query
        return;
    }
  }

  private tradeAmountBQtoFT(): TradeFromToAmount {
    const amount = this.executedAmount;
    return {
      from: this._base === this.from ? amount.base : amount.quote,
      to: this._quote === this.to ? amount.quote : amount.base,
    };
  }
}
