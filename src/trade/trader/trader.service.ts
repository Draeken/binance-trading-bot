import { Inject, Injectable } from '@nestjs/common';
import { Subject, Subscription, zip } from 'rxjs';
import { BinanceApiService } from 'src/binance/binance-api/binance-api.service';
import { prettifyKlines } from 'src/binance/binance.orm-mapper';
import { AccountantService } from '../accountant/accountant.service';
import { AltCoin } from '../domain/coin.entity';
import { Candlestick } from '../interfaces/candlestick.interface';
import { TradeOptions } from '../interfaces/trade-options.interface';

@Injectable()
export class TraderService {
  private rawCandleSubjects: {
    [key: string]: Subject<Candlestick>;
  };
  private candlestickSub: Subscription;
  private bridge: string;

  constructor(
    @Inject('TRADE_OPTIONS') tradeOptions: TradeOptions,
    private binanceApi: BinanceApiService,
    private accountant: AccountantService,
  ) {
    this.bridge = tradeOptions.bridge;
  }

  startTickers() {
    this.rawCandleSubjects = this.accountant.coinList.reduce(
      (acc, c) => ({
        ...acc,
        [this.altCoinToMarket(c)]: new Subject<Candlestick>(),
      }),
      {},
    );
    this.binanceApi.candlesticks(
      this.accountant.coinList.map(this.altCoinToMarket),
      '1m',
      (klines) => {
        const candle = prettifyKlines(klines);
        this.rawCandleSubjects[candle.coin].next(candle);
      },
    );
    this.candlestickSub = zip(
      ...Object.values(this.rawCandleSubjects),
    ).subscribe((vals) =>
      this.accountant.updateCoins(
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

  private altCoinToMarket(coin: AltCoin) {
    return coin.code + this.bridge;
  }
}
