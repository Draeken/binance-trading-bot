import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Subject, Subscription, zip } from 'rxjs';
import { BinanceApiService } from 'src/binance/binance-api/binance-api.service';
import { prettifyKlines, statusToEnum } from 'src/binance/binance.orm-mapper';
import {
  BinanceAPIOrderResponse,
  BinanceAPIResponseError,
} from 'src/binance/interfaces/binance-api.interface';
import { CoinDict, CoinsUpdate } from '../domain/coin-dict.entity';
import { AltCoin, Bridge } from '../domain/coin.entity';
import { Operation } from '../domain/operation.entity';
import {
  Trade,
  TradeBaseQuoteAmount,
  TradeStatus,
} from '../domain/trade.entity';
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
        return this.supportedCoins;
      })
      .then((coinDict) => this.repo.loadCoinInfos(coinDict))
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
        bridgeAsset: this.trader.bridgeAsset,
        onTrade: this.executeTrade,
      }),
    );
  }

  private executeTrade(trade: Trade) {
    const { type, base, quote } = trade.operation;
    const marketName = base.code + quote.code;
    this.binanceApi
      .price(marketName)
      .then((res) => {
        const price = Number.parseFloat(res.price);
        if (type === 'SELL') {
          return this.binanceApi.sell(marketName, trade.amount, price, {
            type: 'LIMIT',
          });
        } else {
          const quantity = base.checkQuantity(Math.floor(trade.amount / price));
          // update balance
          return this.binanceApi.buy(marketName, quantity, price, {
            type: 'LIMIT',
          });
        }
      })
      .then((res) => {
        if ((res as BinanceAPIResponseError).code != null) {
          throw new Error((res as BinanceAPIResponseError).msg);
        }
        const { orderId, status: rawStatus } = res as BinanceAPIOrderResponse;
        const status = statusToEnum(rawStatus);
        const tradeAmount: TradeBaseQuoteAmount =
          status === TradeStatus.FILLED
            ? orderResponseToTradeAmount(res as BinanceAPIOrderResponse)
            : {
                base: 0,
                quote: 0,
              };
        trade.updateAfterInit(orderId, statusToEnum(status), tradeAmount);
      });
  }
}

const orderResponseToTradeAmount = (
  response: BinanceAPIOrderResponse,
): TradeBaseQuoteAmount => {
  const price = Number.parseFloat(response.price);
  const executedQty = Number.parseFloat(response.executedQty);
  if (
    price == NaN ||
    executedQty == NaN ||
    ['SELL', 'BUY'].every((side) => side !== response.side)
  ) {
    throw new Error(
      `invalid api order response ${price} - ${executedQty} - ${response.side}`,
    );
  }
  const base = response.side === 'SELL' ? -executedQty : executedQty;
  const quote =
    response.side === 'SELL' ? executedQty * price : -executedQty * price;
  return {
    base,
    quote,
  };
};
