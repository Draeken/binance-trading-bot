import { Inject, Injectable } from '@nestjs/common';
import { CoinValueFilter } from 'src/trade/domain/coin.entity';
import {
  TradeBaseQuoteAmount,
  TradeStatus,
  TradeUpdateProps,
} from 'src/trade/domain/trade.entity';
import { Candlestick } from 'src/trade/interfaces/candlestick.interface';
import { BinanceApiClient } from './binance-api-client';
import {
  prettifyKlines,
  statusToEnum,
  stepToPrecision,
} from './binance.orm-mapper';
import { EXCHANGE_PLATFORM } from './broker.module';
import {
  BinanceAPIOrderResponse,
  BinanceAPIResponseError,
  BinanceBookTicker,
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
    cb: (data: Candlestick) => void,
  ) {
    return this.client.candlesticks(symbols, interval, (data) =>
      cb(prettifyKlines(data)),
    );
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
    return this.client
      .price(symbol)
      .then((res) => Number.parseFloat(res.price));
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
    return this.client
      .buy(symbol, quantity, price, flags)
      .then(throwIfResponseError)
      .then(orderResponseToTradeInit);
  }

  sell(
    symbol: string,
    quantity: number,
    price: number,
    flags?: BinanceOrderFlags,
  ) {
    return this.client
      .sell(symbol, quantity, price, flags)
      .then(throwIfResponseError)
      .then(orderResponseToTradeInit);
  }

  marketBuy(symbol: string, quantity: number, flags?: BinanceOrderFlags) {
    return this.client.marketBuy(symbol, quantity, flags);
  }

  marketSell(symbol: string, quantity: number, flags?: BinanceOrderFlags) {
    return this.client.marketSell(symbol, quantity, flags);
  }

  orderStatus(symbol: string, orderId: number) {
    return this.client
      .orderStatus(symbol, orderId)
      .then(throwIfResponseError)
      .then(orderResponseToTradeInit);
  }

  private setAllPairs(info: BinanceExchangeInfo) {
    this.pairs = new Set(info.symbols.map((s) => s.symbol));
  }
}

const throwIfResponseError = <T>(res: T | BinanceAPIResponseError): T => {
  if ((res as BinanceAPIResponseError).code != null) {
    throw new Error((res as BinanceAPIResponseError).msg);
  }
  return res as T;
};

const orderResponseToTradeInit = (
  res: BinanceAPIOrderResponse,
): TradeUpdateProps => {
  const { orderId: id, status: rawStatus } = res;
  const status = statusToEnum(rawStatus);
  const amount: TradeBaseQuoteAmount =
    status === TradeStatus.FILLED
      ? orderResponseToTradeAmount(res)
      : {
          base: 0,
          quote: 0,
        };
  return { id, status, amount };
};

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
