import {
  Inject,
  Injectable,
  Logger,
  LoggerService,
  OnApplicationBootstrap,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { interval, Subject, Subscription, zip } from 'rxjs';
import { filter, map, scan, withLatestFrom } from 'rxjs/operators';
import { BrokerService } from 'src/broker/broker.service';
import { CoinDict, CoinsUpdate } from '../domain/coin-dict.entity';
import { AltCoin, Bridge } from '../domain/coin.entity';
import { Operation } from '../domain/operation.entity';
import { Trade, TradeStatus, TradeUpdateProps } from '../domain/trade.entity';
import { Trader } from '../domain/trader.entity';
import { Candlestick } from '../interfaces/candlestick.interface';
import { TradeOptions } from '../interfaces/trade-options.interface';
import { RepositoryService } from '../repository/repository.service';

interface TradeSubjectAction {
  action: 'ADD' | 'REMOVE';
  trade: Trade;
}

@Injectable()
export class TraderService
  implements OnModuleInit, OnApplicationBootstrap, OnModuleDestroy {
  static readonly ongoingTradePoolingIntervalMS = 3000;
  private ongoingTradeSubject: Subject<TradeSubjectAction> = new Subject();
  private ongoingTrade: Subscription;

  private rawCandleSubjects: {
    [key: string]: Subject<Candlestick>;
  };
  private candlestickSub: Subscription;
  private bridge: Bridge;
  private trader: Trader;
  private supportedCoins: CoinDict;

  constructor(
    @Inject(Logger) private readonly logger: LoggerService,
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

  onApplicationBootstrap() {
    this.startTickers();
  }

  async onModuleDestroy() {
    return this.repo.saveTrader(this.trader);
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
    ).subscribe((vals) => {
      this.updateCoins(
        vals.map((val) => {
          const close = val.close;
          const open = val.open;
          return {
            code: val.coin.slice(0, -this.bridge.code.length),
            valuation: close,
            trending: close - open,
          };
        }),
      );
    });
  }

  stopTickers() {
    this.broker.closeWebSockets();
    this.candlestickSub.unsubscribe();
  }

  saveState() {
    this.repo.saveTrader(this.trader);
  }

  private coinList() {
    return this.supportedCoins.toList();
  }

  private altCoinToMarket(coin: AltCoin) {
    return coin.code + this.bridge.code;
  }

  private updateCoins(coinsUpdate: CoinsUpdate[]) {
    this.logger.verbose({ message: `update coins with`, coinsUpdate });
    this.supportedCoins.updateCoins(coinsUpdate);
    const trade = this.trader.evaluateMarket();
    if (!trade) {
      return;
    }
    this.logger.verbose({
      message: `new trade: ${trade.asset.coin.code} to ${trade.target.code}`,
      trade,
    });
    this.trader.addOperation(
      new Operation({
        ...trade,
        bridgeAsset: this.trader.bridgeAsset,
        onTrade: this.executeTrade.bind(this),
      }),
    );
  }

  private executeTrade(trade: Trade) {
    const { type, base, quote } = trade.operation;
    const marketName = base.code + quote.code;
    this.logger.verbose({ message: `execute ${type} trade on: ${marketName}` });
    this.broker
      .price(marketName)
      .then((price) => {
        if (type === 'SELL') {
          const quantity = base.checkQuantity(trade.amount);
          return this.broker.sell(marketName, quantity, price, {
            type: 'LIMIT',
          });
        } else {
          const quantity = base.checkQuantity(trade.amount / price);
          return this.broker.buy(marketName, quantity, price, {
            type: 'LIMIT',
          });
        }
      })
      .catch((e) => {
        this.logger.error({ message: 'Error while executing trade', e });
        return {
          amount: { base: 0, quote: 0 },
          id: -1,
          price: -1,
          status: TradeStatus.CANCELED,
        } as TradeUpdateProps;
      })
      .then((res) => {
        trade.updateAfterInit(res);
        if (res.status === TradeStatus.CANCELED) {
          return;
        }
        if (res.status !== TradeStatus.FILLED) {
          this.logger.verbose({
            message: `add ongoing trade: ${trade.marketName} - ${trade.orderId}`,
          });
          this.ongoingTradeSubject.next({ action: 'ADD', trade });
        }
      });
  }

  private updateTrades(trades: Set<Trade>) {
    trades.forEach((trade) => {
      this.logger.verbose({
        message: `ask order status for trade: ${trade.marketName} - ${trade.orderId}`,
      });
      this.broker.orderStatus(trade.marketName, trade.orderId).then((res) => {
        if (res.status === TradeStatus.FILLED) {
          this.logger.verbose({
            message: `remove filled trade: ${trade.marketName} - ${trade.orderId}`,
          });
          this.ongoingTradeSubject.next({ action: 'REMOVE', trade });
        }
        trade.update(res);
      });
    });
  }

  private initOngoingTradeUpdater() {
    const tradeSet$ = this.ongoingTradeSubject.pipe(
      scan((tradeSet, { action, trade }) => {
        if (action === 'ADD') {
          const res = new Set(tradeSet);
          res.add(trade);
          return res;
        } else if (action === 'REMOVE') {
          const res = new Set(tradeSet);
          res.delete(trade);
          return res;
        }
      }, new Set<Trade>()),
    );
    this.ongoingTrade = interval(TraderService.ongoingTradePoolingIntervalMS)
      .pipe(
        withLatestFrom(tradeSet$),
        map(([_, trades]) => trades),
        filter((trades) => trades.size > 0),
      )
      .subscribe(this.updateTrades.bind(this));
  }
}
