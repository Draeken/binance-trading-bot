import { Asset } from './asset.value-object';
import { CoinDict } from './coin-dict.entity';
import { AltCoin } from './coin.entity';

export type ratioDict = Map<AltCoin, Map<AltCoin, number>>;

export type ratios = { [key: string]: { [key: string]: number } };

export interface RatiosUpdate {
  fromTo: number;
  toFrom: number;
}

export interface ThresholdProps {
  ratios: ratios;
  coins: CoinDict;
}

export class Threshold {
  private _ratios: ratioDict;
  private growthFactor = 0.85; // + 15%

  constructor(props: ThresholdProps) {
    this.initRatioDict(props.coins, props.ratios);
  }

  get ratios() {
    return this._ratios;
  }

  findBestTrade(
    coin: AltCoin,
    fee: number,
    excludedAssets: Asset[],
  ): [AltCoin, number] {
    const coinRatios = this._ratios.get(coin);
    let bestTrade: [AltCoin, number] = [coin, 0];
    coinRatios.forEach((ratio, vsCoin) => {
      if (
        vsCoin === coin ||
        excludedAssets.some((asset) => asset.coin === vsCoin)
      ) {
        return;
      }
      const feeFactor = 1 - (coin.hasPair(vsCoin) ? fee : fee * 2);
      const tradeValue =
        (coin.ratio(vsCoin) * feeFactor * this.growthFactor) / ratio;
      bestTrade = tradeValue > bestTrade[1] ? [vsCoin, tradeValue] : bestTrade;
    });
    return bestTrade;
  }

  updateRatios(
    from: AltCoin,
    to: AltCoin,
    executedPrices?: { from: number; to: number },
  ) {
    const fromPrice = executedPrices ? executedPrices.from : from.valuation;
    const toPrice = executedPrices ? executedPrices.to : to.valuation;
    for (const [coin, vsRatioMap] of this._ratios.entries()) {
      if (coin === to) {
        vsRatioMap.set(from, toPrice / fromPrice);
        continue;
      }
      vsRatioMap.set(to, coin.valuation / toPrice);
    }
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
