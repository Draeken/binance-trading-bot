import { FailedCoinFilter } from 'src/exceptions';

export interface CoinProps {
  code: string;
}

export interface Coin {
  code: string;
  isBridge: boolean;
  trending: number;
  valuation: number;
}

export class Bridge implements Coin {
  readonly isBridge = true;
  readonly valuation = 1;
  readonly trending = 0;
  constructor(public readonly code: string) {}
}

export interface CoinValueFilter {
  min: number;
  max: number;
  precision: number;
}

export interface AltCoinUpdateFiltersProps {
  price: CoinValueFilter;
  quantity: CoinValueFilter;
  notional: number;
}
export class AltCoin implements Coin {
  readonly isBridge = false;
  readonly code: string;
  private _trending: number;
  private _valuation: number;
  private _quantityFilters: CoinValueFilter;
  private _priceFilters: CoinValueFilter;
  private _notionalFilter: number;
  private pairMarketName: { [key: string]: { base: Coin; quote: Coin } } = {};

  constructor(props: CoinProps) {
    this.code = props.code;
  }

  get trending() {
    return this._trending;
  }

  get valuation() {
    return this._valuation;
  }

  get filters(): AltCoinUpdateFiltersProps {
    return {
      price: this._priceFilters,
      quantity: this._quantityFilters,
      notional: this._notionalFilter,
    };
  }

  addPair(coin: Coin, market: { base: Coin; quote: Coin }) {
    this.pairMarketName[coin.code] = market;
  }

  hasPair(coin: Coin) {
    return this.pairMarketName[coin.code] != undefined;
  }

  allPairs() {
    return Object.entries(this.pairMarketName).map(([code, info]) => ({
      code,
      ...info,
    }));
  }

  pairInfo(coin: Coin) {
    return { ...this.pairMarketName[coin.code] };
  }

  updateFilters(filters: AltCoinUpdateFiltersProps) {
    this._priceFilters = filters.price;
    this._quantityFilters = filters.quantity;
    this._notionalFilter = filters.notional;
  }

  checkQuantity(quantity: number) {
    if (quantity < this._quantityFilters.min) {
      throw new FailedCoinFilter(
        this.code,
        'quantityFilter.min',
        this._quantityFilters.min,
        quantity,
      );
    }
    if (quantity > this._quantityFilters.max && this._quantityFilters.max > 0) {
      throw new FailedCoinFilter(
        this.code,
        'quantityFilter.max',
        this._quantityFilters.max,
        quantity,
      );
    }
    const precisionFactor = 10 ** this._quantityFilters.precision;
    const trunkedQuantity =
      Math.floor(quantity * precisionFactor) / precisionFactor;
    if (trunkedQuantity * this._valuation < this._notionalFilter) {
      throw new FailedCoinFilter(
        this.code,
        'notional',
        this._notionalFilter,
        trunkedQuantity * this._valuation,
      );
    }
    return trunkedQuantity;
  }

  isTradable(quantity: number) {
    if (quantity < this._quantityFilters.min) {
      return false;
    }
    if (quantity > this._quantityFilters.max && this._quantityFilters.max > 0) {
      return false;
    }
    if (quantity * this._valuation < this._notionalFilter) {
      return false;
    }
    return true;
  }

  updateMarket({
    trending,
    valuation,
  }: {
    trending: number;
    valuation: number;
  }) {
    this._trending = trending;
    this._valuation = valuation;
  }

  ratio(coin: AltCoin) {
    return this._valuation / coin._valuation;
  }
}
