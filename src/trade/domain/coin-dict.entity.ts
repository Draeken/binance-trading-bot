import { AltCoin } from './coin.entity';

export interface CoinsUpdate {
  code: string;
  trending: number;
  valuation: number;
}

export class CoinDict {
  private dict: { [key: string]: AltCoin };

  constructor(coins: AltCoin[]) {
    this.dict = coins.reduce((acc, cur) => ({ ...acc, [cur.code]: cur }), {});
  }

  toList() {
    return Object.values(this.dict);
  }

  toDict() {
    return { ...this.dict };
  }

  updateCoins(updates: CoinsUpdate[]) {
    for (const update of updates) {
      this.dict[update.code].updateMarket(update);
    }
  }

  get(code: string) {
    return this.dict[code];
  }
}
