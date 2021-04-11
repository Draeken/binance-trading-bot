import { Inject, Injectable, Logger, LoggerService } from '@nestjs/common';
import { promises as fs } from 'fs';
import { ratio } from 'src/broker/binance.orm-mapper';
import { BrokerService } from 'src/broker/broker.service';
import { AssetProps } from '../domain/asset.value-object';
import { CoinDict } from '../domain/coin-dict.entity';
import { AltCoin, Bridge, Coin, CoinValueFilter } from '../domain/coin.entity';
import { ratios } from '../domain/threshold.entity';
import { Trader, TraderProps } from '../domain/trader.entity';
import { TradeOptions } from '../interfaces/trade-options.interface';

interface CoinInfoRaw {
  [key: string]: {
    filters: { price: CoinValueFilter; quantity: CoinValueFilter };
    pairs: Array<{ coin: string; quote: string; base: string }>;
  };
}

interface AssetRaw {
  coin: string;
  balance: number;
}

@Injectable()
export class RepositoryService {
  private readonly assetBalancesPath = './asset_balances.json';
  private readonly ratioCoinsTablePath = './ratio_coins_table.json';
  private readonly coinInfosPath = './coin_infos.json';
  private readonly supportedCoinListPath = './supported_list_coins.json';
  private _prices: { [key: string]: string };
  private bridge: Bridge;

  constructor(
    @Inject(Logger) private readonly logger: LoggerService,
    @Inject('TRADE_OPTIONS') tradeOptions: TradeOptions,
    private binanceApi: BrokerService,
  ) {}

  set bridgeCoin(bridge: Bridge) {
    this.bridge = bridge;
  }

  loadSupportedCoins() {
    return this.readFile(this.supportedCoinListPath)
      .then((buffer) => {
        this.logger.verbose(
          {
            message: 'read supported coin list from file',
            buffer,
          },
          'repository.service',
        );
        return JSON.parse(buffer);
      })
      .catch((reason) => {
        this.logger.error({
          message: "couldn't read coin list from file",
          reason,
        });
        return [];
      })
      .then((list: string[]) => list.map((code) => new AltCoin({ code })));
  }

  loadCoinInfos(coins: CoinDict) {
    return this.readFile(this.coinInfosPath)
      .then((buffer) => {
        this.logger.verbose({ message: 'read coin infos from file', buffer });
        return JSON.parse(buffer);
      })
      .then((dict: CoinInfoRaw) => {
        const missingInfo: AltCoin[] = [];
        coins.toList().forEach((coin) => {
          const coinInfo = dict[coin.code];
          if (coinInfo) {
            coin.updateFilters({
              price: coinInfo.filters.price,
              quantity: coinInfo.filters.quantity,
            });
            coinInfo.pairs.forEach((pair) => {
              coin.addPair(coins.get(pair.coin), {
                base: coins.get(pair.base),
                quote: coins.get(pair.quote),
              });
            });
          } else {
            this.logger.verbose({
              message: `no saved info for coin ${coin.code}`,
            });
            missingInfo.push(coin);
          }
        });
        return missingInfo;
      })
      .catch((reason) => {
        this.logger.error({
          message: "couldn't read coin infos from file",
          reason,
        });
        return coins.toList();
      })
      .then((missingInfoCoins) => {
        if (missingInfoCoins.length === 0) {
          return;
        }
        const coinsMarket = missingInfoCoins.map(
          (coin) => coin.code + this.bridge.code,
        );

        return this.binanceApi
          .exchangeInfo(...coinsMarket)
          .then(async (infos) => {
            const allPairs = await this.binanceApi.allPairs();
            missingInfoCoins.forEach((coin, i) => {
              const coinMarket = coin.code + this.bridge.code;
              const coinFilters = infos[coinMarket];
              this.logger.verbose({
                message: `update filters for ${coin.code}`,
                coinFilters,
              });
              coin.updateFilters(coinFilters);
              addPairs(coin, i, missingInfoCoins, allPairs);
            });
          })
          .then(() => this.saveCoinInfos(coins));
      })
      .then(() => coins);
  }

  loadTrader(supportedCoinList: CoinDict): Promise<TraderProps> {
    return Promise.all([
      this.loadCoinsRatio(supportedCoinList.toList()),
      this.loadAssets(supportedCoinList),
    ]).then(
      (v) =>
        ({
          threshold: { ratios: v[0], coins: supportedCoinList },
          assets: v[1],
        } as TraderProps),
    );
  }

  saveTrader(trader: Trader) {
    const assets: AssetRaw[] = trader.assets.map((asset) => ({
      coin: asset.coin.code,
      balance: asset.balance,
    }));
    const thresholdRes: ratios = {};
    for (const [coin, vsCoins] of trader.ratios) {
      const vsCoinsObj: { [key: string]: number } = {};
      for (const [vsCoin, ratio] of vsCoins) {
        vsCoinsObj[vsCoin.code] = ratio;
      }
      thresholdRes[coin.code] = vsCoinsObj;
    }
    // may save trader's ongoing operations
    return Promise.all([
      this.saveAssets(assets),
      this.saveRatios(thresholdRes),
    ]);
  }

  private readFile(path: string) {
    return fs.readFile(path, { encoding: 'utf-8' });
  }

  private saveCoinInfos(coins: CoinDict) {
    const dict = coins.toDict();
    const dictToSave: CoinInfoRaw = {};
    for (const code in dict) {
      dictToSave[code] = {
        filters: dict[code].filters,
        pairs: dict[code].allPairs().map(({ base, quote, code }) => ({
          coin: code,
          base: base.code,
          quote: quote.code,
        })),
      };
    }
    this.logger.verbose({
      message: `save coin infos on file`,
      data: dictToSave,
    });
    return fs
      .writeFile(this.coinInfosPath, JSON.stringify(dictToSave))
      .catch((reason) => {
        this.logger.error({
          message: "couldn't write coin infos on file",
          reason,
        });
      });
  }

  private loadCoinsRatio(supportedCoinList: AltCoin[]): Promise<ratios> {
    return this.readFile(this.ratioCoinsTablePath)
      .then((buffer) => {
        this.logger.verbose({ message: 'read coins ratio from file', buffer });
        return JSON.parse(buffer);
      })
      .catch((_) =>
        this.initializeRatioCoinsTable(supportedCoinList.map((c) => c.code)),
      );
  }

  private loadAssets(supportedCoinList: CoinDict): Promise<AssetProps[]> {
    return this.readFile(this.assetBalancesPath)
      .then((buffer) => {
        this.logger.verbose({ message: 'read assets from file', buffer });
        return JSON.parse(buffer);
      })
      .then((data: AssetRaw[]) =>
        data.map(
          ({ coin, balance }) =>
            ({
              coin: this.getCoinFromCode(coin, supportedCoinList),
              balance,
            } as AssetProps),
        ),
      )
      .catch((reason) => {
        this.logger.error({
          message: "couldn't read assets from file",
          reason,
        });
        return this.loadAssetsFromBroker(supportedCoinList);
      });
  }

  private loadAssetsFromBroker(
    supportedCoinList: CoinDict,
  ): Promise<AssetProps[]> {
    return this.binanceApi.account().then((v) => {
      const assetProps = v.balances.map((balance) => {
        const coin = this.getCoinFromCode(balance.asset, supportedCoinList);
        return {
          balance: Number.parseFloat(balance.free),
          coin,
        };
      });
      if (assetProps.every((asset) => asset.coin !== this.bridge)) {
        assetProps.push({ balance: 0, coin: this.bridge });
      }
      return assetProps;
    });
  }

  private getCoinFromCode(code: string, coinDict: CoinDict): AltCoin | Bridge {
    let coin: AltCoin | Bridge = coinDict.get(code);
    if (!coin) {
      if (code === this.bridge.code) {
        coin = this.bridge;
      } else {
        this.logger.verbose({
          message: `coin: ${code} not in supported coin list`,
          list: coinDict.toList(),
        });
      }
    }
    return coin;
  }

  private get prices() {
    if (this._prices) {
      return Promise.resolve(this._prices);
    }
    return this.binanceApi.prices().then((prices) => {
      this._prices = prices;
      return prices;
    });
  }

  private initializeRatioCoinsTable(supportedCoinList: string[]) {
    return this.prices
      .then((prices) => {
        return supportedCoinList.reduce((curA, coinA) => {
          return {
            ...curA,
            [coinA]: supportedCoinList.reduce((curB, coinB) => {
              if (coinA === coinB) return curB;
              return {
                ...curB,
                [coinB]: ratio(
                  prices[coinA + this.bridge.code],
                  prices[coinB + this.bridge.code],
                ),
              };
            }, {}),
          };
        }, {});
      })
      .then(this.saveRatios);
  }

  private saveAssets = (assets) => {
    return fs
      .writeFile(this.assetBalancesPath, JSON.stringify(assets))
      .then(() => assets);
  };

  private saveRatios = (ratios: ratios) => {
    return fs
      .writeFile(this.ratioCoinsTablePath, JSON.stringify(ratios))
      .then(() => ratios);
  };
}

const addPairs = (
  coin: AltCoin,
  startIndex: number,
  list: AltCoin[],
  symbolSet: Set<string>,
): AltCoin => {
  for (let searchIndex = startIndex; searchIndex < list.length; ++searchIndex) {
    let base: Coin;
    let quote: Coin;

    if (symbolSet.has(coin.code + list[searchIndex].code)) {
      base = coin;
      quote = list[searchIndex];
    } else if (symbolSet.has(list[searchIndex].code + coin.code)) {
      quote = coin;
      base = list[searchIndex];
    }

    if (base != undefined) {
      coin.addPair(list[searchIndex], { base, quote });
      list[searchIndex].addPair(coin, { base, quote });
    }
  }
  return coin;
};
