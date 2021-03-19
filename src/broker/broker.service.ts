import { Inject, Injectable } from '@nestjs/common';
import { BinanceApiClient } from './binance-api-client';
import { EXCHANGE_PLATFORM } from './broker.module';
import {
  BinanceBookTicker,
  BinanceCandlestick,
  BinanceCandlesticksIntervals,
  BinanceOrderFlags,
} from './interfaces/binance-api.interface';

@Injectable()
export class BrokerService {
  private client: BinanceApiClient;

  constructor(@Inject(EXCHANGE_PLATFORM) exchangePlatform: BinanceApiClient) {
    this.client = exchangePlatform;
  }

  bookTickers(symbol: string, cb: (data: BinanceBookTicker) => void) {
    return this.client.bookTickers(symbol, cb);
  }

  candlesticks(
    symbols: string | string[],
    interval: BinanceCandlesticksIntervals,
    cb: (data: BinanceCandlestick) => void,
  ) {
    return this.client.candlesticks(symbols, interval, cb);
  }

  closeWebSockets() {
    return this.client.closeWebSockets();
  }

  closeWebSocket(endpoint: string) {
    return this.client.closeWebSocket(endpoint);
  }

  account() {
    return this.client.account();
  }

  exchangeInfo() {
    return this.client.exchangeInfo();
  }

  averagePrice(symbol: string) {
    return this.client.averagePrice(symbol);
  }

  price(symbol: string) {
    return this.client.price(symbol);
  }

  prices() {
    return this.client.prices();
  }

  buy(
    symbol: string,
    quantity: number,
    price: number,
    flags?: BinanceOrderFlags,
  ) {
    return this.client.buy(symbol, quantity, price, flags);
  }

  sell(
    symbol: string,
    quantity: number,
    price: number,
    flags?: BinanceOrderFlags,
  ) {
    return this.client.sell(symbol, quantity, price, flags);
  }

  marketBuy(symbol: string, quantity: number, flags?: BinanceOrderFlags) {
    return this.client.marketBuy(symbol, quantity, flags);
  }

  marketSell(symbol: string, quantity: number, flags?: BinanceOrderFlags) {
    return this.client.marketSell(symbol, quantity, flags);
  }

  orderStatus(symbol: string, orderId: number) {
    return this.client.orderStatus(symbol, orderId);
  }
}
