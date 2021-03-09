import { Injectable } from '@nestjs/common';
import { Observable, Subject, zip } from 'rxjs';
import { BinanceApiService } from 'src/binance/binance-api/binance-api.service';
import { prettifyKlines } from 'src/binance/binance.orm-mapper';
import { AccountantService } from '../accountant/accountant.service';
import { Candlestick } from '../interfaces/candlestick.interface';

@Injectable()
export class TraderService {
  private rawCandleSubjects: {
    [key: string]: Subject<Candlestick>;
  };
  private candlestick$: Observable<Candlestick[]>;

  constructor(
    private binanceApi: BinanceApiService,
    private accountant: AccountantService,
  ) {}

  startTickers() {
    this.rawCandleSubjects = this.accountant.coinBridgeList.reduce(
      (acc, c) => ({
        ...acc,
        [c]: new Subject<Candlestick>(),
      }),
      {},
    );
    this.binanceApi.candlesticks(
      this.accountant.coinBridgeList,
      '1m',
      (klines) => {
        const candle = prettifyKlines(klines);
        this.rawCandleSubjects[candle.coin].next(candle);
      },
    );
    this.candlestick$ = zip(...Object.values(this.rawCandleSubjects));
    this.candlestick$.subscribe((vals) =>
      console.log('new set of candles', vals),
    );
  }

  stopTickers() {
    this.binanceApi.closeWebSockets();
  }
}
