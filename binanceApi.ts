import { hmac } from 'https://denopkg.com/chiefbiiko/hmac/mod.ts';

export interface BinanceOptions {
  APIKEY: string;
  APISECRET: string;
  keepAlive: boolean;
  recvWindow: number;
  reconnect: boolean;
  verbose: boolean;
  test: boolean;
  log: (...s: any[]) => void;
}

type callbackWithError<T> = ((error: null, data: T) => void) & ((error: any) => void);

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

interface BinanceAPIAccount {
  makerCommission: boolean;
  takerCommission: boolean;
  buyerCommission: boolean;
  sellerCommission: boolean;
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  updateTime: number;
  accountType: 'SPOT';
  balances: Array<{ asset: string; free: number; locked: number }>;
}

interface BinanceAPIRequest {
  timestamp?: number;
  recvWindow?: number;
  signature?: string;
  [key: string]: any;
}

interface BinanceAPIResponseError {
  code: number;
  msg: string;
}

interface BinanceOrderFlags {
  price?: number;
  quantity?: number;
  type?: string;
  stopLimitPrice?: number;
  listClientOrderId?: number;
  limitClientOrderId?: number;
  stopClientOrderId?: number;
  stopLimitTimeInForce?: string;
  timeInForce?: string;
  newOrderRespType?: number;
  newClientOrderId?: number;
  icebergQty?: number;
  stopPrice?: number;
  side?: string;
  symbol?: string;
}

interface BinanceAPIOrderResponse {
  symbol: string;
  orderId: number;
  orderListId: number; //Unless OCO, value will be -1
  clientOrderId: string;
  transactTime: number;
  price: string;
  origQty: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  status: string;
  timeInForce: string;
  type: string;
  side: string;
}

type BinanceAPIRequestInit = RequestInit & { timeout: number };

type BinanceCandlesticksIntervals = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '6h' | '8h' | '12h' | '1d' | '3d' | '1w' | '1M';

export interface BinanceBookTicker {
  updateId: number; // order book updateId,
  symbol: string; // symbol,
  bestBid: string; // best bid price,
  bestBidQty: string; // best bid qty,
  bestAsk: string; // best ask price,
  bestAskQty: string; // best ask qty,
}

export interface BinanceSymbolPrice {
  symbol: string;
  price: string;
}

export interface BinanceCandlestick {
  e: string;
  E: number; // Event time
  s: string;
  k: {
    t: number; // Kline start time
    T: number; // Kline close time
    s: string;
    i: string;
    f: number; // First trade ID
    L: number; // Last trade ID
    o: string;
    c: string;
    h: string;
    l: string;
    v: string;
    n: number; // Number of trades
    x: false; // Is this kline closed?
    q: string;
    V: string;
    Q: string;
    B: string;
  };
}

export const defaultOptions: BinanceOptions = {
  APIKEY: '',
  APISECRET: '',
  keepAlive: true,
  recvWindow: 5000,
  reconnect: false,
  verbose: true,
  test: true,
  log: (...args) => console.log(...args),
};

export class Binance {
  static base = 'https://api.binance.com/api/';
  static stream = 'wss://stream.binance.com:9443/ws/';
  static combineStream = 'wss://stream.binance.com:9443/stream?streams=';
  static userAgent = 'Mozilla/4.0 (compatible; Node Binance API)';
  static contentType = 'application/x-www-form-urlencoded';

  private options;
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

  constructor(userOptions: BinanceOptions) {
    this.options = userOptions;
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
    return (error: Event | ErrorEvent) => {
      /* Errors ultimately result in a `close` event.
     see: https://github.com/websockets/ws/blob/828194044bf247af852b31c49e2800d557fedeff/lib/websocket.js#L126 */

      if (error instanceof ErrorEvent) {
        binance.options.log(`WebSocket error: ${ws.url}`, error.message, error.error);
      } else {
        binance.options.log(`WebSocket error: ${ws.url}`, error);
      }
    };
  }

  private handleSocketClose(ws: WebSocket, reconnect?: () => void) {
    const binance = this;
    return (reason: CloseEvent) => {
      delete binance.subscriptions[ws.url];

      binance.options.log(`WebSocket closed: ${ws.url}`, reason.reason, reason.code);
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

  private subscribe<T>(endpoint: string, cb: (data: T) => void, reconnect?: () => void, openedCb?: (endpoint: string) => void) {
    const ws = new WebSocket(Binance.stream + endpoint);
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

  private subscribeCombined<T>(streams: string[], cb: (data: T) => void, reconnect?: () => void, openedCb?: (endpoint: string) => void) {
    const queryParams = streams.join('/');
    const ws = new WebSocket(Binance.combineStream + queryParams);
    if (this.options.verbose) {
      this.options.log('CombinedStream: Subscribed to [' + Binance.combineStream + '] ' + queryParams);
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
    const { u: updateId, s: symbol, b: bestBid, B: bestBidQty, a: bestAsk, A: bestAskQty } = data;

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

  private reqObjPOST(data: BinanceAPIRequest = {}, method = 'POST', key: string): BinanceAPIRequestInit {
    return {
      body: this.queryStringify(data),
      method: method,
      timeout: this.options.recvWindow,
      keepalive: this.options.keepAlive,
      headers: {
        'User-Agent': Binance.userAgent,
        'Content-type': Binance.contentType,
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
        'User-Agent': Binance.userAgent,
        'Content-type': Binance.contentType,
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
          this.info.usedWeight = +(response.headers.get('x-mbx-used-weight-1m') || 0);
          this.info.orderCount1s = +(response.headers.get('x-mbx-order-count-1s') || 0);
          this.info.orderCount1m = +(response.headers.get('x-mbx-order-count-1m') || 0);
          this.info.orderCount1h = +(response.headers.get('x-mbx-order-count-1h') || 0);
          this.info.orderCount1d = +(response.headers.get('x-mbx-order-count-1d') || 0);
        }
      }
      if (!cb) return;
      if (response && response.status !== 200) return cb(response);
      return response.json().then(
        (data) => cb(null, data),
        (err) => cb(err)
      );
    };
  }

  private proxyRequest<T>(url: string, opt: BinanceAPIRequestInit, cb: callbackWithError<T>) {
    const controller = new AbortController();
    const { timeout, ...requestInit } = opt;
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const req = fetch(url, { ...requestInit, signal: controller.signal })
      .finally(() => clearTimeout(timeoutId))
      .then(this.reqHandler(cb), (err) => cb(err));
    return req;
  }

  private signedRequest<T>(url: string, data: BinanceAPIRequest = {}, callback: callbackWithError<T>, method = 'GET', noDataInSignature = false) {
    this.requireApiSecret('signedRequest');
    data.timestamp = new Date().getTime();
    data.recvWindow = data.recvWindow ?? this.options.recvWindow;
    const query = method === 'POST' && noDataInSignature ? '' : this.queryStringify(data);
    const signature = hmac('sha256', this.options.APISECRET, query, 'utf8', 'hex') as string;
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
    callback?: callbackWithError<T>
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
      throw Error('stopPrice: Must set "type" to one of the following: STOP_LOSS, STOP_LOSS_LIMIT, TAKE_PROFIT, TAKE_PROFIT_LIMIT');
    }
    this.signedRequest<T>(
      Binance.base + endpoint,
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
        if (typeof response.msg !== 'undefined' && response.msg === 'Filter failure: MIN_NOTIONAL') {
          this.options.log('Order quantity too small. See exchangeInfo() for minimum amounts');
        }
        if (callback) callback(error, response);
        else this.options.log(`${side} (${symbol}, ${quantity}, ${price})`, response);
      },
      'POST'
    );
  };

  bookTickers(symbol: string, cb: (data: BinanceBookTicker) => void) {
    const endpoint = `${symbol.toLowerCase()}@bookTicker`;
    const reconnect = () => {
      if (this.options.reconnect) {
        this.bookTickers(symbol, cb);
      }
    };
    const subscription = this.subscribe<BinanceAPIBookTicker>(endpoint, (data) => cb(this.fBookTickerConvertData(data)), reconnect);
    return subscription.url;
  }

  candlesticks(symbols: string | string[], interval: BinanceCandlesticksIntervals, cb: (data: BinanceCandlestick) => void) {
    const reconnect = () => {
      if (this.options.reconnect) {
        this.candlesticks(symbols, interval, cb);
      }
    };

    let subscription;
    if (Array.isArray(symbols)) {
      const streams = symbols.map((symbol) => symbol.toLowerCase() + '@kline_' + interval);
      subscription = this.subscribeCombined(streams, cb, reconnect);
    } else {
      const symbol = symbols.toLowerCase();
      subscription = this.subscribe(symbol + '@kline_' + interval, cb, reconnect);
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
      this.signedRequest(Binance.base + 'v3/account', {}, (error: any, data?: BinanceAPIAccount) => callback(error, data));
    });
  }

  price(symbol: string) {
    const url = Binance.base + 'v3/ticker/price?symbol=' + symbol;
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
    const url = Binance.base + 'v3/ticker/price';
    const opt = {
      timeout: this.options.recvWindow,
    };
    return new Promise<Array<BinanceSymbolPrice>>((resolve, reject) => {
      this.proxyRequest(url, opt, (error: any, data?: Array<BinanceSymbolPrice>) => {
        if (error) return reject(error);
        return resolve(data as Array<BinanceSymbolPrice>);
      });
    });
  }

  buy(symbol: string, quantity: number, price: number, flags: BinanceOrderFlags = {}) {
    return new Promise<BinanceAPIOrderResponse | BinanceAPIResponseError | undefined>((resolve, reject) => {
      const callback = (error: any, response?: BinanceAPIOrderResponse | BinanceAPIResponseError) => (error ? reject(error) : resolve(response));
      this.order('BUY', symbol, quantity, price, flags, callback);
    });
  }

  sell(symbol: string, quantity: number, price: number, flags: BinanceOrderFlags = {}) {
    return new Promise<BinanceAPIOrderResponse | BinanceAPIResponseError | undefined>((resolve, reject) => {
      const callback = (error: any, response?: BinanceAPIOrderResponse | BinanceAPIResponseError) => (error ? reject(error) : resolve(response));
      this.order('SELL', symbol, quantity, price, flags, callback);
    });
  }

  marketBuy(symbol: string, quantity: number, flags: BinanceOrderFlags = { type: 'MARKET' }) {
    flags.type = flags.type ?? 'MARKET';

    return new Promise<BinanceAPIOrderResponse | BinanceAPIResponseError | undefined>((resolve, reject) => {
      const callback = (error: any, response?: BinanceAPIOrderResponse | BinanceAPIResponseError) => (error ? reject(error) : resolve(response));
      this.order('BUY', symbol, quantity, 0, flags, callback);
    });
  }

  marketSell(symbol: string, quantity: number, flags: BinanceOrderFlags = { type: 'MARKET' }) {
    flags.type = flags.type ?? 'MARKET';

    return new Promise<BinanceAPIOrderResponse | BinanceAPIResponseError | undefined>((resolve, reject) => {
      const callback = (error: any, response?: BinanceAPIOrderResponse | BinanceAPIResponseError) => (error ? reject(error) : resolve(response));
      this.order('SELL', symbol, quantity, 0, flags, callback);
    });
  }
}
