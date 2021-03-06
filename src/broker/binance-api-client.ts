/* eslint-disable @typescript-eslint/no-this-alias */
import AbortController from 'abort-controller';
import { createHmac } from 'crypto';
import fetch from 'node-fetch';
import { w3cwebsocket } from 'websocket';
import {
  BinanceAPIAccount,
  BinanceAPIOrderResponse,
  BinanceAPIResponseError,
  BinanceBookTicker,
  BinanceCandlestick,
  BinanceCandlesticksIntervals,
  BinanceExchangeInfo,
  BinanceOptions,
  BinanceOrderFlags,
  BinanceSymbolPrice,
} from './interfaces/binance-api.interface';

type WebSocket = w3cwebsocket;

type callbackWithError<T> = ((error: null, data: T) => void) &
  ((error: any) => void);

interface Subscriptions {
  [key: string]: WebSocket;
}

interface BinanceAPIBookTicker {
  u: number; // order book updateId
  s: string; // symbol
  b: string; // best bid price
  B: string; // best bid qty
  a: string; // best ask price
  A: string; // best ask qty
}

interface BinanceAPIRequest {
  timestamp?: number;
  recvWindow?: number;
  signature?: string;
  [key: string]: any;
}

type BinanceAPIRequestInit = RequestInit & { timeout: number };

export const defaultOptions: BinanceOptions = {
  keepAlive: true,
  recvWindow: 5000,
  reconnect: false,
  verbose: true,
  test: false,
  log: (...args) => console.log(...args),
};

export interface BinanceApiClientProps extends BinanceOptions {
  APIKEY: string;
  APISECRET: string;
}

export class BinanceApiClient {
  static base = 'https://api.binance.com/api/';
  static stream = 'wss://stream.binance.com:9443/ws/';
  static combineStream = 'wss://stream.binance.com:9443/stream?streams=';
  static userAgent = 'Mozilla/4.0 (compatible; Node Binance API)';
  static contentType = 'application/x-www-form-urlencoded';

  private options: BinanceOptions & { APIKEY: string; APISECRET: string };
  private info = {
    usedWeight: 0,
    futuresLatency: false,
    lastRequest: -1,
    lastURL: '',
    statusCode: 0,
    orderCount1s: 0,
    orderCount1m: 0,
    orderCount1h: 0,
    orderCount1d: 0,
    timeOffset: 0,
  };
  private subscriptions: Subscriptions = {};

  constructor(props: BinanceApiClientProps) {
    this.options = { ...props };
  }

  private queryStringify(q: any) {
    // same as qs.stringify with arrayFormat: repeat
    return Object.keys(q)
      .reduce((res, key) => {
        if (Array.isArray(q[key])) {
          q[key].forEach((v: any) => {
            res.push(key + '=' + encodeURIComponent(v));
          });
        } else if (q[key] !== undefined) {
          res.push(key + '=' + encodeURIComponent(q[key]));
        }
        return res;
      }, [] as string[])
      .join('&');
  }

  /**
   * Called when socket is opened, subscriptions are registered for later reference
   * @param {function} opened_callback - a callback function
   * @return {undefined}
   */
  private handleSocketOpen(ws: WebSocket, cb?: (endpoint: string) => void) {
    const binance = this;
    return () => {
      binance.subscriptions[ws.url] = ws;
      if (typeof cb === 'function') {
        cb(ws.url);
      }
    };
  }

  private handleSocketError(ws: WebSocket) {
    const binance = this;
    return (error: Event | Error) => {
      /* Errors ultimately result in a `close` event.
     see: https://github.com/websockets/ws/blob/828194044bf247af852b31c49e2800d557fedeff/lib/websocket.js#L126 */

      if (error instanceof Error) {
        binance.options.log(
          `WebSocket error: ${ws.url}`,
          error.message,
          error.name,
          error.stack,
        );
      } else {
        binance.options.log(`WebSocket error: ${ws.url}`, error);
      }
    };
  }

  private handleSocketClose(ws: WebSocket, reconnect?: () => void) {
    const binance = this;
    return (reason: CloseEvent) => {
      delete binance.subscriptions[ws.url];

      binance.options.log(
        `WebSocket closed: ${ws.url}`,
        reason.reason,
        reason.code,
      );
      if (binance.options.reconnect && reconnect) {
        binance.options.log('WebSocket reconnecting: ' + ws.url + '...');
        try {
          reconnect();
        } catch (error) {
          binance.options.log('WebSocket reconnect error: ' + error.message);
        }
      }
    };
  }

  private subscribe<T>(
    endpoint: string,
    cb: (data: T) => void,
    reconnect?: () => void,
    openedCb?: (endpoint: string) => void,
  ) {
    const ws = new w3cwebsocket(BinanceApiClient.stream + endpoint);
    const binance = this;

    if (this.options.verbose) {
      this.options.log('Subscribed to ' + endpoint);
    }
    ws.onopen = this.handleSocketOpen(ws, openedCb);
    ws.onerror = this.handleSocketError(ws);
    ws.onclose = this.handleSocketClose(ws, reconnect);
    ws.onmessage = (event: MessageEvent<string>) => {
      try {
        cb(JSON.parse(event.data));
      } catch (error) {
        binance.options.log('Parse error: ' + error.message);
      }
    };
    return ws;
  }

  private subscribeCombined<T>(
    streams: string[],
    cb: (data: T) => void,
    reconnect?: () => void,
    openedCb?: (endpoint: string) => void,
  ) {
    const queryParams = streams.join('/');
    const ws = new w3cwebsocket(BinanceApiClient.combineStream + queryParams);
    if (this.options.verbose) {
      this.options.log(
        'CombinedStream: Subscribed to [' +
          BinanceApiClient.combineStream +
          '] ' +
          queryParams,
      );
    }
    const binance = this;
    ws.onopen = this.handleSocketOpen(ws, openedCb);
    ws.onerror = this.handleSocketError(ws);
    ws.onclose = this.handleSocketClose(ws, reconnect);
    ws.onmessage = (event: MessageEvent<string>) => {
      try {
        cb(JSON.parse(event.data).data);
      } catch (error) {
        binance.options.log('CombinedStreams Parse error: ' + error.message);
      }
    };
    return ws;
  }

  private fBookTickerConvertData(data: BinanceAPIBookTicker) {
    const {
      u: updateId,
      s: symbol,
      b: bestBid,
      B: bestBidQty,
      a: bestAsk,
      A: bestAskQty,
    } = data;

    return {
      updateId,
      symbol,
      bestBid,
      bestBidQty,
      bestAsk,
      bestAskQty,
    } as BinanceBookTicker;
  }

  private requireApiSecret(source = 'requireApiSecret', fatalError = true) {
    if (!this.options.APIKEY) {
      if (fatalError) throw Error(`${source}: Invalid API Key!`);
      return false;
    }
    if (!this.options.APISECRET) {
      if (fatalError) throw Error(`${source}: Invalid API Secret!`);
      return false;
    }
    return true;
  }

  private reqObjPOST(
    data: BinanceAPIRequest = {},
    method = 'POST',
    key: string,
  ): BinanceAPIRequestInit {
    return {
      body: this.queryStringify(data),
      method: method,
      timeout: this.options.recvWindow,
      keepalive: this.options.keepAlive,
      headers: {
        'User-Agent': BinanceApiClient.userAgent,
        'Content-type': BinanceApiClient.contentType,
        'X-MBX-APIKEY': key || '',
      },
    };
  }

  private reqObj(method = 'GET', key: string): BinanceAPIRequestInit {
    return {
      method: method,
      timeout: this.options.recvWindow,
      keepalive: this.options.keepAlive,
      headers: {
        'User-Agent': BinanceApiClient.userAgent,
        'Content-type': BinanceApiClient.contentType,
        'X-MBX-APIKEY': key || '',
      },
    };
  }

  private reqHandler<T>(cb: callbackWithError<T>) {
    return (response: Response) => {
      this.info.lastRequest = new Date().getTime();
      if (response) {
        this.info.statusCode = response.status || 0;
        if (response.url) this.info.lastURL = response.url;
        if (response.headers) {
          this.info.usedWeight = +(
            response.headers.get('x-mbx-used-weight-1m') || 0
          );
          this.info.orderCount1s = +(
            response.headers.get('x-mbx-order-count-1s') || 0
          );
          this.info.orderCount1m = +(
            response.headers.get('x-mbx-order-count-1m') || 0
          );
          this.info.orderCount1h = +(
            response.headers.get('x-mbx-order-count-1h') || 0
          );
          this.info.orderCount1d = +(
            response.headers.get('x-mbx-order-count-1d') || 0
          );
        }
      }
      if (!cb) return;
      if (response && response.status !== 200) {
        return response.json().then(
          (body) => cb({ status: response.status, body }),
          (err) => cb(err),
        );
      }
      return response.json().then(
        (data) => cb(null, data),
        (err) => cb(err),
      );
    };
  }

  private proxyRequest<T>(
    url: string,
    opt: BinanceAPIRequestInit,
    cb: callbackWithError<T>,
  ) {
    const controller = new AbortController();
    const { timeout, ...requestInit } = opt;
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const req = fetch(url, { ...requestInit, signal: controller.signal })
      .finally(() => clearTimeout(timeoutId))
      .then(this.reqHandler(cb), (err) => cb(err));
    return req;
  }

  private signedRequest<T>(
    url: string,
    data: BinanceAPIRequest = {},
    callback: callbackWithError<T>,
    method = 'GET',
    noDataInSignature = false,
  ) {
    this.requireApiSecret('signedRequest');
    data.timestamp = new Date().getTime();
    data.recvWindow = data.recvWindow ?? this.options.recvWindow;
    const query =
      method === 'POST' && noDataInSignature ? '' : this.queryStringify(data);
    const signature = createHmac('sha256', this.options.APISECRET)
      .update(query)
      .digest('hex');
    if (method === 'POST') {
      data.signature = signature;
      const opt = this.reqObjPOST(data, method, this.options.APIKEY);
      this.proxyRequest(url, opt, callback);
    } else {
      const opt = this.reqObj(method, this.options.APIKEY);
      const completeUrl = url + '?' + query + '&signature=' + signature;
      this.proxyRequest(completeUrl, opt, callback);
    }
  }

  private order = <T extends BinanceAPIResponseError>(
    side: string,
    symbol: string,
    quantity: number,
    price: number,
    flags: BinanceOrderFlags = {},
    callback?: callbackWithError<T>,
  ) => {
    let endpoint = flags.type === 'OCO' ? 'v3/order/oco' : 'v3/order';
    if (this.options.test) endpoint += '/test';
    const opt: BinanceOrderFlags = {
      symbol,
      side,
      type: 'LIMIT',
      quantity,
      ...flags,
    };
    if (opt.type?.includes('LIMIT')) {
      opt.price = price;
      if (opt.type !== 'LIMIT_MAKER') {
        opt.timeInForce = 'GTC';
      }
    }
    if (opt.type === 'OCO') {
      opt.price = price;
      opt.stopLimitTimeInForce = 'GTC';
      delete opt.type;
    }

    /*
     * STOP_LOSS
     * STOP_LOSS_LIMIT
     * TAKE_PROFIT
     * TAKE_PROFIT_LIMIT
     * LIMIT_MAKER
     */
    if (typeof flags.stopPrice !== 'undefined' && opt.type === 'LIMIT') {
      throw Error(
        'stopPrice: Must set "type" to one of the following: STOP_LOSS, STOP_LOSS_LIMIT, TAKE_PROFIT, TAKE_PROFIT_LIMIT',
      );
    }
    this.signedRequest<T>(
      BinanceApiClient.base + endpoint,
      opt,
      (error: any, response?: T) => {
        if (error) {
          this.options.log('Order() error:', error);
        }
        if (!response) {
          if (callback) callback(error);
          else this.options.log('Order() error:', error);
          return;
        }
        if (
          typeof response.msg !== 'undefined' &&
          response.msg === 'Filter failure: MIN_NOTIONAL'
        ) {
          this.options.log(
            'Order quantity too small. See exchangeInfo() for minimum amounts',
          );
        }
        if (callback) callback(error, response);
        else
          this.options.log(
            `${side} (${symbol}, ${quantity}, ${price})`,
            response,
          );
      },
      'POST',
    );
  };

  bookTickers(symbol: string, cb: (data: BinanceBookTicker) => void) {
    const endpoint = `${symbol.toLowerCase()}@bookTicker`;
    const reconnect = () => {
      if (this.options.reconnect) {
        this.bookTickers(symbol, cb);
      }
    };
    const subscription = this.subscribe<BinanceAPIBookTicker>(
      endpoint,
      (data) => cb(this.fBookTickerConvertData(data)),
      reconnect,
    );
    return subscription.url;
  }

  candlesticks(
    symbols: string | string[],
    interval: BinanceCandlesticksIntervals,
    cb: (data: BinanceCandlestick) => void,
  ) {
    const reconnect = () => {
      if (this.options.reconnect) {
        this.candlesticks(symbols, interval, cb);
      }
    };

    let subscription;
    if (Array.isArray(symbols)) {
      const streams = symbols.map(
        (symbol) => symbol.toLowerCase() + '@kline_' + interval,
      );
      subscription = this.subscribeCombined(streams, cb, reconnect);
    } else {
      const symbol = symbols.toLowerCase();
      subscription = this.subscribe(
        symbol + '@kline_' + interval,
        cb,
        reconnect,
      );
    }
    return subscription.url;
  }

  closeWebSockets() {
    Object.values(this.subscriptions).forEach((ws) => {
      ws.onclose = null;
      ws.close();
    });
  }

  closeWebSocket(endpoint: string) {
    if (!this.subscriptions[endpoint]) {
      return;
    }
    const ws = this.subscriptions[endpoint];
    ws.onclose = null;
    ws.close();
  }

  account() {
    return new Promise<BinanceAPIAccount | undefined>((resolve, reject) => {
      const callback = (error: any, response?: BinanceAPIAccount) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      };
      this.signedRequest(
        BinanceApiClient.base + 'v3/account',
        {},
        (error: any, data?: BinanceAPIAccount) => callback(error, data),
      );
    });
  }

  exchangeInfo() {
    const url = BinanceApiClient.base + 'v3/exchangeInfo';
    const opt: BinanceAPIRequestInit = {
      timeout: this.options.recvWindow,
      method: 'GET',
    };
    return new Promise<BinanceExchangeInfo>((resolve, reject) => {
      this.proxyRequest(url, opt, (error: any, data?: BinanceExchangeInfo) => {
        if (error) return reject(error);
        return resolve(data);
      });
    });
  }

  averagePrice(symbol: string) {
    const url = BinanceApiClient.base + 'v3/avgPrice?symbol=' + symbol;
    const opt = {
      timeout: this.options.recvWindow,
    };
    return new Promise<number>((resolve, reject) => {
      this.proxyRequest(url, opt, (error: any, data?: { price: string }) => {
        if (error) return reject(error);
        return resolve(Number.parseFloat(data.price));
      });
    });
  }

  price(symbol: string) {
    const url = BinanceApiClient.base + 'v3/ticker/price?symbol=' + symbol;
    const opt = {
      timeout: this.options.recvWindow,
    };
    return new Promise<BinanceSymbolPrice>((resolve, reject) => {
      this.proxyRequest(url, opt, (error: any, data?: BinanceSymbolPrice) => {
        if (error) return reject(error);
        return resolve(data as BinanceSymbolPrice);
      });
    });
  }

  prices() {
    const url = BinanceApiClient.base + 'v3/ticker/price';
    const opt = {
      timeout: this.options.recvWindow,
    };
    return new Promise<Array<BinanceSymbolPrice>>((resolve, reject) => {
      this.proxyRequest(
        url,
        opt,
        (error: any, data?: Array<BinanceSymbolPrice>) => {
          if (error) return reject(error);
          return resolve(data as Array<BinanceSymbolPrice>);
        },
      );
    });
  }

  buy(
    symbol: string,
    quantity: number,
    price: number,
    flags: BinanceOrderFlags = {},
  ) {
    return new Promise<
      BinanceAPIOrderResponse | BinanceAPIResponseError | undefined
    >((resolve, reject) => {
      const callback = (
        error: any,
        response?: BinanceAPIOrderResponse | BinanceAPIResponseError,
      ) => (error ? reject(error) : resolve(response));
      this.order('BUY', symbol, quantity, price, flags, callback);
    });
  }

  sell(
    symbol: string,
    quantity: number,
    price: number,
    flags: BinanceOrderFlags = {},
  ) {
    return new Promise<
      BinanceAPIOrderResponse | BinanceAPIResponseError | undefined
    >((resolve, reject) => {
      const callback = (
        error: any,
        response?: BinanceAPIOrderResponse | BinanceAPIResponseError,
      ) => (error ? reject(error) : resolve(response));
      this.order('SELL', symbol, quantity, price, flags, callback);
    });
  }

  marketBuy(
    symbol: string,
    quantity: number,
    flags: BinanceOrderFlags = { type: 'MARKET' },
  ) {
    flags.type = flags.type ?? 'MARKET';

    return new Promise<
      BinanceAPIOrderResponse | BinanceAPIResponseError | undefined
    >((resolve, reject) => {
      const callback = (
        error: any,
        response?: BinanceAPIOrderResponse | BinanceAPIResponseError,
      ) => (error ? reject(error) : resolve(response));
      this.order('BUY', symbol, quantity, 0, flags, callback);
    });
  }

  marketSell(
    symbol: string,
    quantity: number,
    flags: BinanceOrderFlags = { type: 'MARKET' },
  ) {
    flags.type = flags.type ?? 'MARKET';

    return new Promise<
      BinanceAPIOrderResponse | BinanceAPIResponseError | undefined
    >((resolve, reject) => {
      const callback = (
        error: any,
        response?: BinanceAPIOrderResponse | BinanceAPIResponseError,
      ) => (error ? reject(error) : resolve(response));
      this.order('SELL', symbol, quantity, 0, flags, callback);
    });
  }

  orderStatus(symbol: string, orderId: number) {
    const opt = { symbol, orderId };
    return new Promise<
      BinanceAPIOrderResponse | BinanceAPIResponseError | undefined
    >((resolve, reject) => {
      const callback = (
        error: any,
        response?: BinanceAPIOrderResponse | BinanceAPIResponseError,
      ) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      };
      this.signedRequest(
        BinanceApiClient.base + 'v3/order',
        opt,
        (error: any, data?: BinanceAPIOrderResponse) => callback(error, data),
      );
    });
  }
}
