export interface CoinProps {
  code: string;
}

export interface Coin {
  code: string;
  isBridge: boolean;
}

export class Bridge implements Coin {
  readonly isBridge = true;
  constructor(public readonly code: string) {}
}
export class AltCoin implements Coin {
  readonly isBridge = false;
  readonly code: string;
  private trending: number;
  private valuation: number;
  private pairs: Set<Coin> = new Set();
  private pairMarketName: { [key: string]: string };

  constructor(props: CoinProps) {
    this.code = props.code;
  }

  addPair(coin: Coin, marketname: string) {
    this.pairs.add(coin);
    this.pairMarketName[coin.code] = marketname;
  }

  hasPair(coin: Coin) {
    return this.pairs.has(coin);
  }

  update({ trending, valuation }: { trending: number; valuation: number }) {
    this.trending = trending;
    this.valuation = valuation;
  }

  ratio(coin: AltCoin) {
    return this.valuation / coin.valuation;
  }
}
