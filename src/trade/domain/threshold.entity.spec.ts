import { CoinDict } from './coin-dict.entity';
import { AltCoin } from './coin.entity';
import { Threshold } from './threshold.entity';

describe('threshold.entity', () => {
  it('should find best trade', () => {
    const coinA = new AltCoin({ code: 'A' });
    const coinB = new AltCoin({ code: 'B' });
    const coinC = new AltCoin({ code: 'C' });
    const altCoins = [coinA, coinB, coinC];
    const coins = new CoinDict(altCoins);
    const ratios = {
      A: {
        B: 1,
        C: 1,
      },
      B: {
        A: 1,
        C: 1,
      },
      C: {
        A: 1,
        B: 1,
      },
    };
    coinA.updateMarket({ trending: 0, valuation: 1 });
    coinB.updateMarket({ trending: -0.5, valuation: 0.5 });
    coinC.updateMarket({ trending: 1, valuation: 2 });

    const threshold = new Threshold({ coins, ratios });
    const coinABestTrade = threshold.findBestTrade(coinA, 0, []);
    expect(coinABestTrade[0].code).toBe('B');
    expect(coinABestTrade[1]).toBeGreaterThan(1);
    const coinBBestTrade = threshold.findBestTrade(coinB, 0, []);
    expect(coinBBestTrade[0].code).toBe('A');
    expect(coinBBestTrade[1]).toBeLessThan(1);
    const coinCBestTrade = threshold.findBestTrade(coinC, 0, []);
    expect(coinCBestTrade[0].code).toBe('B');
    expect(coinCBestTrade[1]).toBeGreaterThan(1);

    expect(coinCBestTrade[1]).toBeGreaterThan(coinABestTrade[1]);

    const coinABestTradeWithFees = threshold.findBestTrade(coinA, 0.1, []);
    expect(coinABestTradeWithFees[0].code).toBe('B');
    expect(coinABestTradeWithFees[1]).toBeLessThan(coinABestTrade[1]);
  });

  it('should find best find excluding given assets', () => {
    const coinA = new AltCoin({ code: 'A' });
    const coinB = new AltCoin({ code: 'B' });
    const coinC = new AltCoin({ code: 'C' });
    const altCoins = [coinA, coinB, coinC];
    const coins = new CoinDict(altCoins);
    const ratios = {
      A: {
        B: 1,
        C: 1,
      },
      B: {
        A: 1,
        C: 1,
      },
      C: {
        A: 1,
        B: 1,
      },
    };
    coinA.updateMarket({ trending: 0, valuation: 1 });
    coinB.updateMarket({ trending: -0.5, valuation: 0.5 });
    coinC.updateMarket({ trending: 1, valuation: 2 });

    const threshold = new Threshold({ coins, ratios });
    const coinABestTrade = threshold.findBestTrade(coinC, 0, [coinB]);
    expect(coinABestTrade[0].code).toBe('A');
  });

  it('should updates ratios', async () => {
    const coinA = new AltCoin({ code: 'A' });
    const coinB = new AltCoin({ code: 'B' });
    const coinC = new AltCoin({ code: 'C' });
    const altCoins = [coinA, coinB, coinC];
    const coins = new CoinDict(altCoins);
    const ratios = {
      A: {
        B: 1,
        C: 1,
      },
      B: {
        A: 1,
        C: 1,
      },
      C: {
        A: 1,
        B: 1,
      },
    };
    coinA.updateMarket({ trending: 0, valuation: 1 });
    coinB.updateMarket({ trending: -0.5, valuation: 0.5 });
    coinC.updateMarket({ trending: 1, valuation: 2 });

    const threshold = new Threshold({ coins, ratios });

    threshold.updateRatios(coinC, coinB);
    expect(threshold.ratios.get(coinC).get(coinB)).toBe(4);
    expect(threshold.ratios.get(coinC).get(coinA)).toBe(1);
    expect(threshold.ratios.get(coinA).get(coinB)).toBe(2);
    expect(threshold.ratios.get(coinA).get(coinC)).toBe(1);
    expect(threshold.ratios.get(coinB).get(coinA)).toBe(1);
    expect(threshold.ratios.get(coinB).get(coinC)).toBe(0.25);
  });

  it('should updates ratios with given prices', async () => {
    const coinA = new AltCoin({ code: 'A' });
    const coinB = new AltCoin({ code: 'B' });
    const coinC = new AltCoin({ code: 'C' });
    const altCoins = [coinA, coinB, coinC];
    const coins = new CoinDict(altCoins);
    const ratios = {
      A: {
        B: 1,
        C: 1,
      },
      B: {
        A: 1,
        C: 1,
      },
      C: {
        A: 1,
        B: 1,
      },
    };
    coinA.updateMarket({ trending: 0, valuation: 1 });
    coinB.updateMarket({ trending: -0.5, valuation: 0.5 });
    coinC.updateMarket({ trending: 1, valuation: 2 });

    const threshold = new Threshold({ coins, ratios });
    const from = 4;
    const to = 0.25;

    threshold.updateRatios(coinC, coinB, { from, to });
    expect(threshold.ratios.get(coinC).get(coinB)).toBe(8);
    expect(threshold.ratios.get(coinC).get(coinA)).toBe(1);
    expect(threshold.ratios.get(coinA).get(coinB)).toBe(4);
    expect(threshold.ratios.get(coinA).get(coinC)).toBe(1);
    expect(threshold.ratios.get(coinB).get(coinA)).toBe(1);
    expect(threshold.ratios.get(coinB).get(coinC)).toBe(0.0625);
  });
});
