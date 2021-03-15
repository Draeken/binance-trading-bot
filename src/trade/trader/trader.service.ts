import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Subject, Subscription, zip } from 'rxjs';
import { BinanceApiService } from 'src/binance/binance-api/binance-api.service';
import { prettifyKlines } from 'src/binance/binance.orm-mapper';
import { CoinDict, CoinsUpdate } from '../domain/coin-dict.entity';
import { AltCoin, Bridge } from '../domain/coin.entity';
import { Operation } from '../domain/operation.entity';
import { Trade } from '../domain/trade.entity';
import { Trader } from '../domain/trader.entity';
import { Candlestick } from '../interfaces/candlestick.interface';
import { TradeOptions } from '../interfaces/trade-options.interface';
import { RepositoryService } from '../repository/repository.service';

@Injectable()
export class TraderService implements OnModuleInit {
  private rawCandleSubjects: {
    [key: string]: Subject<Candlestick>;
  };
  private candlestickSub: Subscription;
  private bridge: Bridge;
  private trader: Trader;
  private supportedCoins: CoinDict;

  constructor(
    @Inject('TRADE_OPTIONS') tradeOptions: TradeOptions,
    private binanceApi: BinanceApiService,
    private repo: RepositoryService,
  ) {
    this.bridge = new Bridge(tradeOptions.bridge);
    this.repo.bridgeCoin = this.bridge;
  }

  async onModuleInit() {
    return this.repo
      .loadSupportedCoins()
      .then((coins) => {
        this.supportedCoins = new CoinDict(coins);
        return coins;
      })
      .then((coins) => this.repo.loadTrader(coins))
      .then((traderProps) => (this.trader = new Trader(traderProps)));
  }

  startTickers() {
    this.rawCandleSubjects = this.coinList().reduce(
      (acc, c) => ({
        ...acc,
        [this.altCoinToMarket(c)]: new Subject<Candlestick>(),
      }),
      {},
    );
    this.binanceApi.candlesticks(
      this.coinList().map(this.altCoinToMarket),
      '1m',
      (klines) => {
        const candle = prettifyKlines(klines);
        this.rawCandleSubjects[candle.coin].next(candle);
      },
    );
    this.candlestickSub = zip(
      ...Object.values(this.rawCandleSubjects),
    ).subscribe((vals) =>
      this.updateCoins(
        vals.map((val) => {
          const close = Number.parseFloat(val.close);
          const open = Number.parseFloat(val.open);
          return {
            code: val.coin,
            valuation: close,
            trending: close - open,
          };
        }),
      ),
    );
  }

  stopTickers() {
    this.binanceApi.closeWebSockets();
    this.candlestickSub.unsubscribe();
  }

  private coinList() {
    return this.supportedCoins.toList();
  }

  private altCoinToMarket(coin: AltCoin) {
    return coin.code + this.bridge.code;
  }

  private updateCoins(coinsUpdate: CoinsUpdate[]) {
    this.supportedCoins.updateCoins(coinsUpdate);
    const trade = this.trader.evaluateMarket();
    if (!trade) {
      return;
    }
    this.trader.addOperation(
      new Operation({
        ...trade,
        bridge: this.bridge,
        onTrade: this.executeTrade,
      }),
    );
  }

  private executeTrade(trade: Trade) {
    if (trade.isFromBridge) {
      // buy
    } else {
      // sell
    }
  }
}
