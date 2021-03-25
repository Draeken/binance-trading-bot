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
  price: number;
}

export interface TradeUpdateProps {
  id: number;
  status: TradeStatus;
  amount: TradeBaseQuoteAmount;
  price: number;
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
  private _executedPrice: number;
  private _isDirectPair = false;

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
      this._isDirectPair = true;
      this._quote = quote;
      this._base = base as AltCoin;
      if (_from === base) {
        this._type = 'SELL';
      } else {
        this._type = 'BUY';
      }
    }
  }

  updateAfterInit({ amount, id, status, price }: TradeUpdateProps) {
    this.executedAmount = amount;
    this._executedPrice = price;
    this.lastUpdateAt = Date.now();
    this.id = id;
    this.status = status;
    this.handleStatus();
  }

  update({ amount, status, price }: TradeUpdateProps) {
    this.executedAmount = amount;
    this._executedPrice = price;
    this.lastUpdateAt = Date.now();
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

  get marketName() {
    return this._base.code + this._quote.code;
  }

  get executedPrice() {
    return this._executedPrice;
  }

  get orderId() {
    return this.id;
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
        return;
    }
  }

  private tradeAmountBQtoFT(): TradeFromToAmount {
    const amount = this.executedAmount;
    return {
      from: this._base === this.from ? amount.base : amount.quote,
      to: this._quote === this.to ? amount.quote : amount.base,
      price: this._executedPrice,
    };
  }
}
