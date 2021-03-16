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
export class AltCoin implements Coin {
  readonly isBridge = false;
  readonly code: string;
  private _trending: number;
  private _valuation: number;
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

  addPair(coin: Coin, market: { base: Coin; quote: Coin }) {
    this.pairMarketName[coin.code] = market;
  }

  hasPair(coin: Coin) {
    return this.pairMarketName[coin.code] != undefined;
  }

  pairInfo(coin: Coin) {
    return { ...this.pairMarketName[coin.code] };
  }

  update({ trending, valuation }: { trending: number; valuation: number }) {
    this._trending = trending;
    this._valuation = valuation;
  }

  ratio(coin: AltCoin) {
    return this._valuation / coin._valuation;
  }
}
