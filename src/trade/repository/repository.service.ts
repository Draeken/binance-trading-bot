import { promises as fs } from 'fs';
import { Inject, Injectable } from '@nestjs/common';
import { BinanceApiService } from 'src/binance/binance-api/binance-api.service';
import { pricesListToDict, ratio } from 'src/binance/binance.orm-mapper';
import { TradeOptions } from '../interfaces/trade-options.interface';
import { AltCoin, Bridge } from '../domain/coin.entity';

@Injectable()
export class RepositoryService {
  private readonly ratioCoinsTablePath = './ratio_coins_table.json';
  private readonly supportedListCoins = './supported_list_coins.json';
  private _prices: { [key: string]: string };
  private bridge: Bridge;

  constructor(
    @Inject('TRADE_OPTIONS') tradeOptions: TradeOptions,
    private binanceApi: BinanceApiService,
  ) {
    this.bridge = new Bridge(tradeOptions.bridge);
  }

  loadSupportedCoins() {
    return fs
      .readFile(this.supportedListCoins, {
        encoding: 'utf-8',
      })
      .then((buffer) => JSON.parse(buffer))
      .then((list: string[]) => list.map((code) => new AltCoin({ code })))
      .then((coins: AltCoin[]) => coins.map(this.addPairs));
  }

  loadRatioCoinsTable(supportedCoinList: AltCoin[]) {
    return fs
      .readFile(this.ratioCoinsTablePath, {
        encoding: 'utf-8',
      })
      .then((buffer) => JSON.parse(buffer))
      .catch((_) =>
        this.initializeRatioCoinsTable(supportedCoinList.map((c) => c.code)),
      );
  }

  private addPairs(coin: AltCoin, i: number, list: AltCoin[]): AltCoin {
    coin.addPair(this.bridge);
    const allPairs = Object.values(this._prices);
    for (let index = i; index < list.length; ++index) {
      if (
        allPairs.some(
          (code) =>
            code === coin.code + list[index].code ||
            code === list[index].code + coin.code,
        )
      ) {
        coin.addPair(list[i]);
        list[i].addPair(coin);
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
