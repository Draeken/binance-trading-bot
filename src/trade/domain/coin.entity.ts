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
  private trending: string;
  private valuation: string;
  private pairs: Coin[] = [];

  constructor(props: CoinProps) {
    this.code = props.code;
  }

  addPair(coin: Coin) {
    this.pairs.push(coin);
  }
}
