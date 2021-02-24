import { hmac } from 'https://denopkg.com/chiefbiiko/hmac/mod.ts';
import { stringify as queryStringify } from 'https://denolib.com/denolib/qs/mod.ts';

export interface BinanceOptions {
  APIKEY: string;
  APISECRET: string;
  keepAlive: boolean;
  recvWindow: number;
  reconnect: boolean;
  verbose: boolean;
  log: (...s: any[]) => void;
}

type callbackWithError<T> = (error: any, data?: T) => void;

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
}

type BinanceAPIRequestInit = RequestInit & { timeout: number };

export interface BinanceBookTicker {
  updateId: number; // order book updateId,
  symbol: string; // symbol,
  bestBid: string; // best bid price,
  bestBidQty: string; // best bid qty,
  bestAsk: string; // best ask price,
  bestAskQty: string; // best ask qty,
}

export const defaultOptions: BinanceOptions = {
  APIKEY: '',
  APISECRET: '',
  keepAlive: true,
  recvWindow: 5000,
  reconnect: true,
  verbose: true,
  log: (...args) => console.log(...args),
};

export class Binance {
  static base = 'https://api.binance.com/api/';
  static stream = 'wss://stream.binance.com:9443/ws/';
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
    // ws. reconnect = Binance.options.reconnect;
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
      body: queryStringify(data, { arrayFormat: 'repeat' }),
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
    const req = fetch(url, requestInit)
      .finally(() => clearTimeout(timeoutId))
      .then(this.reqHandler(cb), (err) => cb(err));
    return req;
  }

  private signedRequest<T>(url: string, data: BinanceAPIRequest = {}, callback: callbackWithError<T>, method = 'GET', noDataInSignature = false) {
    this.requireApiSecret('signedRequest');
    data.timestamp = new Date().getTime();
    data.recvWindow = data.recvWindow ?? this.options.recvWindow;
    const query = method === 'POST' && noDataInSignature ? '' : queryStringify(data, { arrayFormat: 'repeat' });
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
}
