export interface CoinProps {
  code: string;
}

export interface Coin {
  code: string;
}

export class Bridge implements Coin {
  readonly isBridge = true;
  constructor(public readonly code: string) {}
}

export class AltCoin implements Coin {
  readonly code: string;
  private trending: number;
  private valuation: number;
  private pairs: Set<Coin> = new Set();

  constructor(props: CoinProps) {
    this.code = props.code;
  }

  addPair(coin: Coin) {
    this.pairs.add(coin);
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
