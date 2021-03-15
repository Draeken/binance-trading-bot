import { AltCoin } from './coin.entity';

export type ratioDict = {
  [key: string]: [AltCoin, { [key: string]: [AltCoin, number] }];
};

export type ratios = { [key: string]: { [key: string]: string } };

export interface ThresholdProps {
  ratios: ratios;
  coins: AltCoin[];
}

export class Threshold {
  private ratios: ratioDict;
  private growthFactor = 1.3;

  constructor({ coins, ratios }: ThresholdProps) {
    this.ratios = Object.entries(ratios).reduce((acc, [coinCode, curDict]) => {
      const dict = Object.entries(curDict).reduce(
        (acc, [coinCode, ratioStr]) => {
          const ratio = Number.parseFloat(ratioStr);
          const coin = coins.find((c) => c.code === coinCode);
          return { ...acc, [coinCode]: [coin, ratio] };
        },
        {},
      );
      const coin = coins.find((c) => c.code === coinCode);
      return { ...acc, [coinCode]: [coin, dict] };
    }, {} as ratioDict);
  }

  findBestTrade(coin: AltCoin, fee: number): [AltCoin, number] {
    const coinRatios = this.ratios[coin.code][1];
    return Object.values(coinRatios).reduce(
      (acc, [curCoin, ratio]) => {
        const feeFactor =
          1 - this.growthFactor * (coin.hasPair(curCoin) ? fee : fee * 2);
        const tradeValue = (coin.ratio(curCoin) * feeFactor) / ratio;
        return tradeValue > acc[1] ? [curCoin, tradeValue] : acc;
      },
      [coin, 0],
    );
  }
}
