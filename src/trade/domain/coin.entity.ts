export interface CoinProps {
  code: string;
}

export interface Coin {
  code: string;
}

export class Bridge implements Coin {
  constructor(public readonly code: string) {}
}

export class AltCoin implements Coin {
  readonly code: string;
  private trending: number;
  private valuation: number;
  private pairs: Coin[] = [];

  constructor(props: CoinProps) {
    this.code = props.code;
  }

  addPair(coin: Coin) {
    this.pairs.push(coin);
  }

  update({ trending, valuation }: { trending: number; valuation: number }) {
    this.trending = trending;
    this.valuation = valuation;
  }
}
