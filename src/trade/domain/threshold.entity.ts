import { CoinDict } from './coin-dict.entity';
import { AltCoin } from './coin.entity';

export type ratioDict = Map<AltCoin, Map<AltCoin, number>>;

export type ratios = { [key: string]: { [key: string]: number } };

export interface ThresholdProps {
  ratios: ratios;
  coins: CoinDict;
}

export class Threshold {
  private _ratios: ratioDict;
  private growthFactor = 1.3;

  constructor(props: ThresholdProps) {
    this.initRatioDict(props.coins, props.ratios);
  }

  get ratios() {
    return this._ratios;
  }

  findBestTrade(coin: AltCoin, fee: number): [AltCoin, number] {
    const coinRatios = this._ratios.get(coin);
    let bestTrade: [AltCoin, number] = [coin, 0];
    coinRatios.forEach((ratio, vsCoin) => {
      const feeFactor =
        1 - this.growthFactor * (coin.hasPair(vsCoin) ? fee : fee * 2);
      const tradeValue = (coin.ratio(vsCoin) * feeFactor) / ratio;
      bestTrade = tradeValue > bestTrade[1] ? [vsCoin, tradeValue] : bestTrade;
    });
    return bestTrade;
  }

  private initRatioDict(coins: CoinDict, ratios: ratios) {
    this._ratios = new Map();
    for (const code in ratios) {
      const coin = coins.get(code);
      this._ratios.set(
        coin,
        new Map<AltCoin, number>(
          Object.entries(ratios[code]).map(([vsCode, vsRatio]) => [
            coins.get(vsCode),
            vsRatio,
          ]),
        ),
      );
    }
  }
}
