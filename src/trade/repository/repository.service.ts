import { Inject, Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { pricesListToDict, ratio } from 'src/broker/binance.orm-mapper';
import { BrokerService } from 'src/broker/broker.service';
import { AssetProps } from '../domain/asset.value-object';
import { CoinDict } from '../domain/coin-dict.entity';
import { AltCoin, Bridge, Coin } from '../domain/coin.entity';
import { ratios } from '../domain/threshold.entity';
import { TraderProps } from '../domain/trader.entity';
import { TradeOptions } from '../interfaces/trade-options.interface';

@Injectable()
export class RepositoryService {
  private readonly ratioCoinsTablePath = './ratio_coins_table.json';
  private readonly coinInfosPath = './coin_infos.json';
  private readonly supportedCoinListPath = './supported_list_coins.json';
  private _prices: { [key: string]: string };
  private bridge: Bridge;

  constructor(
    @Inject('TRADE_OPTIONS') tradeOptions: TradeOptions,
    private binanceApi: BrokerService,
  ) {}

  set bridgeCoin(bridge: Bridge) {
    this.bridge = bridge;
  }

  loadSupportedCoins() {
    return fs
      .readFile(this.supportedCoinListPath, {
        encoding: 'utf-8',
      })
      .then((buffer) => JSON.parse(buffer))
      .then((list: string[]) => list.map((code) => new AltCoin({ code })));
  }

  loadCoinInfos(coins: CoinDict) {
    return fs
      .readFile(this.coinInfosPath, { encoding: 'utf-8' })
      .then((buffer) => JSON.parse(buffer))
      .then((dict: any) => {
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
            missingInfo.push(coin);
          }
        });
        return missingInfo;
      })
      .then((missingInfoCoins) => {
        const coinsMarket = missingInfoCoins.map(
          (coin) => coin.code + this.bridge.code,
        );
        this.binanceApi.exchangeInfo(...coinsMarket).then(async (infos) => {
          const allPairs = await this.binanceApi.allPairs();
          missingInfoCoins.forEach((coin, i) => {
            const coinMarket = coin.code + this.bridge.code;
            const coinFilters = infos[coinMarket];
            coin.updateFilters(coinFilters);
            this.addPairs(coin, i, missingInfoCoins, allPairs);
          });
        });
        return coins;
      });
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

  private loadCoinsRatio(supportedCoinList: AltCoin[]): Promise<ratios> {
    return fs
      .readFile(this.ratioCoinsTablePath, {
        encoding: 'utf-8',
      })
      .then((buffer) => JSON.parse(buffer))
      .catch((_) =>
        this.initializeRatioCoinsTable(supportedCoinList.map((c) => c.code)),
      );
  }

  private loadAssets(supportedCoinList: CoinDict): Promise<AssetProps[]> {
    return this.binanceApi.account().then((v) => {
      const assetProps = v.balances.map((balance) => {
        let coin: AltCoin | Bridge = supportedCoinList.get(balance.asset);
        if (!coin) {
          if (balance.asset === this.bridge.code) {
            coin = this.bridge;
          } else {
            console.log(
              'coin ',
              balance.asset,
              ' not found in supported coin list',
              supportedCoinList.toList(),
            );
          }
        }
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

  private addPairs(
    coin: AltCoin,
    i: number,
    list: AltCoin[],
    symbolSet: Set<string>,
  ): AltCoin {
    for (let index = i; index < list.length; ++index) {
      let base: Coin;
      let quote: Coin;

      if (symbolSet.has(coin.code + list[index].code)) {
        base = coin;
        quote = list[index];
      } else if (symbolSet.has(list[index].code + coin.code)) {
        quote = coin;
        base = list[index];
      }

      if (base != undefined) {
        coin.addPair(list[i], { base, quote });
        list[i].addPair(coin, { base, quote });
      }
    }
    return coin;
  }

  private get prices() {
    if (this._prices) {
      return Promise.resolve(this._prices);
    }
    return this.binanceApi
      .prices()
      .then(pricesListToDict)
      .then((prices) => {
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
      .then((ratioTable) =>
        fs
          .writeFile(this.ratioCoinsTablePath, JSON.stringify(ratioTable))
          .then(() => ratioTable),
      );
  }
}
