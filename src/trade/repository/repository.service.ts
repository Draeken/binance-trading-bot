import { Inject, Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { BinanceApiService } from 'src/binance/binance-api/binance-api.service';
import { pricesListToDict, ratio } from 'src/binance/binance.orm-mapper';
import { AssetProps } from '../domain/asset.value-object';
import { AltCoin, Bridge } from '../domain/coin.entity';
import { ratios } from '../domain/threshold.entity';
import { TraderProps } from '../domain/trader.entity';
import { TradeOptions } from '../interfaces/trade-options.interface';

@Injectable()
export class RepositoryService {
  private readonly ratioCoinsTablePath = './ratio_coins_table.json';
  private readonly supportedCoinListPath = './supported_list_coins.json';
  private _prices: { [key: string]: string };
  private bridge: Bridge;

  constructor(
    @Inject('TRADE_OPTIONS') tradeOptions: TradeOptions,
    private binanceApi: BinanceApiService,
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
      .then((list: string[]) => list.map((code) => new AltCoin({ code })))
      .then((coins: AltCoin[]) => coins.map(this.addPairs));
  }

  loadTrader(supportedCoinList: AltCoin[]): Promise<TraderProps> {
    return Promise.all([
      this.loadCoinsRatio(supportedCoinList),
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

  private loadAssets(supportedCoinList: AltCoin[]): Promise<AssetProps[]> {
    return this.binanceApi.account().then((v) => {
      const assetProps = v.balances.map((balance) => {
        let coin: AltCoin | Bridge = supportedCoinList.find(
          (c) => c.code === balance.asset,
        );
        if (!coin) {
          if (balance.asset === this.bridge.code) {
            coin = this.bridge;
          } else {
            console.log(
              'coin ',
              balance.asset,
              ' not found in supported coin list',
              supportedCoinList,
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

  private addPairs(coin: AltCoin, i: number, list: AltCoin[]): AltCoin {
    const allPairs = Object.values(this._prices);
    for (let index = i; index < list.length; ++index) {
      const pairIndex = allPairs.findIndex(
        (code) =>
          code === coin.code + list[index].code ||
          code === list[index].code + coin.code,
      );
      if (pairIndex !== -1) {
        const marketName = allPairs[pairIndex];
        coin.addPair(list[i], marketName);
        list[i].addPair(coin, marketName);
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
