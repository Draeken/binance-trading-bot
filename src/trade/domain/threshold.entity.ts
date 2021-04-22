import { CoinDict } from './coin-dict.entity';
import { AltCoin, Coin } from './coin.entity';

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
    excludedCoins: Coin[],
  ): [AltCoin, number] {
    const coinRatios = this._ratios.get(coin);
    let bestTrade: [AltCoin, number] = [coin, 0];
    coinRatios.forEach((ratio, vsCoin) => {
      if (
        vsCoin === coin ||
        excludedCoins.some((excludedCoin) => excludedCoin === vsCoin)
      ) {
        return;
      }
      const feegrowthFactor =
        (1 - (coin.hasPair(vsCoin) ? fee : fee * 2)) * this.growthFactor;
      const tradeValue = (coin.ratio(vsCoin) * feegrowthFactor) / ratio;
      bestTrade = tradeValue > bestTrade[1] ? [vsCoin, tradeValue] : bestTrade;
    });
    this.logTargetValuation(fee, coin, bestTrade);
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

  private logTargetValuation(
    fee: number,
    coin: AltCoin,
    [vsCoin, tradeVal]: [AltCoin, number],
  ) {
    const growthFactor =
      (1 - (coin.hasPair(vsCoin) ? fee : fee * 2)) * this.growthFactor;
    const savedRatio = this._ratios.get(coin).get(vsCoin);
    const targetVal = coin.valuation * (growthFactor / savedRatio);
    console.log(
      `trade val: ${tradeVal}. To make a trade from ${coin.code} to ${
        vsCoin.code
      }, valuation must go from ${
        vsCoin.valuation
      } to below ${targetVal}, ratios: ${coin.ratio(vsCoin)} -- ${savedRatio}`,
    );
  }
}
