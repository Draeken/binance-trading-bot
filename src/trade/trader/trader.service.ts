import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { interval, Subject, Subscription, zip } from 'rxjs';
import { filter, map, withLatestFrom } from 'rxjs/operators';
import { BrokerService } from 'src/broker/broker.service';
import { CoinDict, CoinsUpdate } from '../domain/coin-dict.entity';
import { AltCoin, Bridge } from '../domain/coin.entity';
import { Operation } from '../domain/operation.entity';
import { Trade, TradeStatus } from '../domain/trade.entity';
import { Trader } from '../domain/trader.entity';
import { Candlestick } from '../interfaces/candlestick.interface';
import { TradeOptions } from '../interfaces/trade-options.interface';
import { RepositoryService } from '../repository/repository.service';

@Injectable()
export class TraderService implements OnModuleInit {
  private ongoingTradeSubject: Subject<Set<Trade>> = new Subject();
  private ongoingTrade: Subscription;

  private rawCandleSubjects: {
    [key: string]: Subject<Candlestick>;
  };
  private candlestickSub: Subscription;
  private bridge: Bridge;
  private trader: Trader;
  private supportedCoins: CoinDict;

  constructor(
    @Inject('TRADE_OPTIONS') tradeOptions: TradeOptions,
    private broker: BrokerService,
    private repo: RepositoryService,
  ) {
    this.bridge = new Bridge(tradeOptions.bridge);
    this.repo.bridgeCoin = this.bridge;
    this.initOngoingTradeUpdater();
  }

  async onModuleInit() {
    return this.repo
      .loadSupportedCoins()
      .then((coins) => {
        this.supportedCoins = new CoinDict(coins);
        return this.supportedCoins;
      })
      .then((coinDict) => this.repo.loadCoinInfos(coinDict))
      .then((coins) => this.repo.loadTrader(coins))
      .then((traderProps) => (this.trader = new Trader(traderProps)));
  }

  startTickers() {
    const marketList = this.coinList().map((c) => this.altCoinToMarket(c));
    this.rawCandleSubjects = marketList.reduce(
      (acc, c) => ({
        ...acc,
        [c]: new Subject<Candlestick>(),
      }),
      {},
    );
    this.broker.candlesticks(marketList, '1m', (candle) => {
      this.rawCandleSubjects[candle.coin].next(candle);
    });
    this.candlestickSub = zip(
      ...Object.values(this.rawCandleSubjects),
    ).subscribe((vals) =>
      this.updateCoins(
        vals.map((val) => {
          const close = val.close;
          const open = val.open;
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
    this.broker.closeWebSockets();
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
        bridgeAsset: this.trader.bridgeAsset,
        onTrade: this.executeTrade,
      }),
    );
  }

  private executeTrade(trade: Trade) {
    const { type, base, quote } = trade.operation;
    const marketName = base.code + quote.code;
    this.broker
      .price(marketName)
      .then((price) => {
        if (type === 'SELL') {
          return this.broker.sell(marketName, trade.amount, price, {
            type: 'LIMIT',
          });
        } else {
          const quantity = base.checkQuantity(Math.floor(trade.amount / price));
          return this.broker.buy(marketName, quantity, price, {
            type: 'LIMIT',
          });
        }
      })
      .then((res) => {
        trade.updateAfterInit(res);
        if (res.status !== TradeStatus.FILLED) {
        }
      });
  }

  private updateTrades(trades: Set<Trade>) {
    trades.forEach((trade) => {
      this.broker.orderStatus(trade.marketName, trade.orderId).then((res) => {
        trade.update(res);
      });
    });
  }

  private initOngoingTradeUpdater() {
    this.ongoingTrade = interval(1000)
      .pipe(
        withLatestFrom(this.ongoingTradeSubject),
        map((v) => v[1]),
        filter((v) => v.size > 0),
      )
      .subscribe(this.updateTrades);
  }
}
