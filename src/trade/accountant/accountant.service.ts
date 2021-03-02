import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { promises as fs } from 'fs';
import { BinanceApiService } from 'src/binance/binance-api/binance-api.service';
import { pricesListToDict, ratio } from 'src/binance/binance.orm-mapper';
import { TradeOptions } from '../interfaces/trade-options.interface';
import { TRADE_OPTIONS } from '../trade.module';

@Injectable()
export class AccountantService implements OnModuleInit {
  private brokerCount: number;
  private bridge: string;
  private readonly ratioCoinsTablePath = './ratio_coins_table.json';
  private ratioCoinsTable;
  private supportedCoinList = [
    'XLM',
    'TRX',
    'ICX',
    'EOS',
    'IOTA',
    'ONT',
    'ADA',
    'XMR',
    'DASH',
    'NEO',
    'ATOM',
    'VET',
    'BAT',
    'BTT',
    'ALGO',
  ];

  constructor(
    @Inject('TRADE_OPTIONS') tradeOptions: TradeOptions,
    private binanceApi: BinanceApiService,
  ) {
    this.brokerCount = tradeOptions.brokerCount;
    this.bridge = tradeOptions.bridge;
  }

  async onModuleInit() {
    this.ratioCoinsTable = await this.loadRatioCoinsTable();
  }

  get coinList() {
    return [...this.supportedCoinList];
  }

  get coinBridgeList() {
    return this.supportedCoinList.map((c) => c + this.bridge);
  }

  private loadRatioCoinsTable() {
    return fs
      .readFile(this.ratioCoinsTablePath, {
        encoding: 'utf-8',
      })
      .then((buffer) => JSON.parse(buffer))
      .catch((_) => this.initializeRatioCoinsTable());
  }

  private initializeRatioCoinsTable() {
    return this.binanceApi
      .prices()
      .then(pricesListToDict)
      .then((prices) => {
        return this.supportedCoinList.reduce((curA, coinA) => {
          return {
            ...curA,
            [coinA]: this.supportedCoinList.reduce((curB, coinB) => {
              if (coinA === coinB) return curB;
              return {
                ...curB,
                [coinB]: ratio(
                  prices[coinA + this.bridge],
                  prices[coinB + this.bridge],
                ),
              };
            }, {}),
          };
        }, {});
      })
      .then((ratioTable) => [...Array(this.brokerCount)].map((_) => ratioTable))
      .then((ratioTable) =>
        fs
          .writeFile(this.ratioCoinsTablePath, JSON.stringify(ratioTable))
          .then(() => ratioTable),
      );
  }
}
