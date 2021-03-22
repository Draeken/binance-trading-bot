import { Inject, Injectable } from '@nestjs/common';
import { CoinValueFilter } from 'src/trade/domain/coin.entity';
import { BinanceApiClient } from './binance-api-client';
import { stepToPrecision } from './binance.orm-mapper';
import { EXCHANGE_PLATFORM } from './broker.module';
import {
  BinanceBookTicker,
  BinanceCandlestick,
  BinanceCandlesticksIntervals,
  BinanceExchangeInfo,
  BinanceOrderFlags,
  BinanceSymbolInfo,
  FilterSymbolLotSize,
  FilterSymbolPrice,
} from './interfaces/binance-api.interface';

@Injectable()
export class BrokerService {
  private client: BinanceApiClient;
  private pairs = new Set<string>();

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

  allPairs() {
    if (this.pairs.size > 0) {
      return Promise.resolve(this.pairs);
    }
    return this.client.exchangeInfo().then((info) => {
      this.setAllPairs(info);
      return this.pairs;
    });
  }

  exchangeInfo(...pairs: string[]) {
    const symbolInfoToFilters = (info: BinanceSymbolInfo) => {
      const coinFilterPrice = info.filters.find(
        (f) => f.filterType === 'PRICE_FILTER',
      ) as FilterSymbolPrice;
      const coinFilterQuantity = info.filters.find(
        (f) => f.filterType === 'LOT_SIZE',
      ) as FilterSymbolLotSize;
      return {
        price: {
          min: Number.parseFloat(coinFilterPrice.minPrice),
          max: Number.parseFloat(coinFilterPrice.maxPrice),
          precision: stepToPrecision(coinFilterPrice.tickSize),
        },
        quantity: {
          min: Number.parseFloat(coinFilterQuantity.minQty),
          max: Number.parseFloat(coinFilterQuantity.maxQty),
          precision: stepToPrecision(coinFilterQuantity.stepSize),
        },
      };
    };
    return this.client
      .exchangeInfo()
      .then((infos) => {
        this.setAllPairs(infos);
        return infos;
      })
      .then((infos) =>
        infos.symbols.reduce(
          (acc, cur) => ({ ...acc, [cur.symbol]: cur }),
          {} as { [key: string]: BinanceSymbolInfo },
        ),
      )
      .then((dict) =>
        pairs.reduce(
          (acc, cur) => ({ ...acc, [cur]: symbolInfoToFilters(dict[cur]) }),
          {} as {
            [key: string]: {
              price: CoinValueFilter;
              quantity: CoinValueFilter;
            };
          },
        ),
      );
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

  private setAllPairs(info: BinanceExchangeInfo) {
    this.pairs = new Set(info.symbols.map((s) => s.symbol));
  }
}
