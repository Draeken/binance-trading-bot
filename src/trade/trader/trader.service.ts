import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import {
  tap,
  groupBy,
  map,
  zipAll,
  mergeMap,
  bufferCount,
} from 'rxjs/operators';
import { BinanceApiService } from 'src/binance/binance-api/binance-api.service';
import { prettifyKlines } from 'src/binance/binance.orm-mapper';
import { BinanceCandlestick } from 'src/binance/interfaces/binance-api.interface';
import { AccountantService } from '../accountant/accountant.service';
import { Candlestick } from '../interfaces/candlestick.interface';

@Injectable()
export class TraderService implements OnApplicationBootstrap {
  private rawStreamSubject$ = new Subject<BinanceCandlestick>();
  private candlestick$: Observable<Candlestick[]>;

  constructor(
    private binanceApi: BinanceApiService,
    private accountant: AccountantService,
  ) {}

  onApplicationBootstrap() {
    const size = this.accountant.coinBridgeList.length;
    this.binanceApi.candlesticks(
      this.accountant.coinBridgeList,
      '1m',
      (klines) => this.rawStreamSubject$.next(klines),
    );
    this.candlestick$ = this.rawStreamSubject$.pipe(
      map((k) => prettifyKlines(k)),
      bufferCount(size, size),
    );
    this.candlestick$.subscribe((vals) =>
      console.log('new set of candles', vals),
    );
  }
}
