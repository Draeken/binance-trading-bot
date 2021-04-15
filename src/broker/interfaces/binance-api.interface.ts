export interface BinanceOptions {
  keepAlive: boolean;
  recvWindow: number;
  reconnect: boolean;
  verbose: boolean;
  test: boolean;
  log: (...s: any[]) => void;
}

export interface BinanceAPIResponseError {
  code: number;
  msg: string;
}

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

export interface FilterSymbolPrice {
  filterType: 'PRICE_FILTER';
  minPrice: string;
  maxPrice: string;
  tickSize: string;
}

export interface FilterSymbolLotSize {
  filterType: 'LOT_SIZE';
  minQty: string;
  maxQty: string;
  stepSize: string;
}

export interface FilterSymbolMinNotional {
  filterType: 'MIN_NOTIONAL';
  minNotional: string;
  applyToMarket: true;
  avgPriceMins: number;
}

export interface BinanceSymbolInfo {
  symbol: string;
  status: string;
  baseAsset: string;
  baseAssetPrecision: number;
  quoteAsset: string;
  quoteAssetPrecision: number;
  baseCommissionPrecision: number;
  quoteCommissionPrecision: number;
  icebergAllowed: boolean;
  ocoAllowed: boolean;
  quoteOrderQtyMarketAllowed: boolean;
  isSpotTradingAllowed: boolean;
  isMarginTradingAllowed: boolean;
  filters: Array<
    FilterSymbolPrice | FilterSymbolLotSize | FilterSymbolMinNotional
  >;
}

export interface BinanceExchangeInfo {
  timezone: string;
  serverTime: number;
  symbols: BinanceSymbolInfo[];
}

export interface BinanceAPIOrderResponse {
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

export interface BinanceOrderFlags {
  price?: number;
  quantity?: number;
  type?: 'LIMIT' | 'MARKET' | 'STOP_LOSS' | 'LIMIT_MAKER' | 'OCO';
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

export type BinanceCandlesticksIntervals =
  | '1m'
  | '3m'
  | '5m'
  | '15m'
  | '30m'
  | '1h'
  | '2h'
  | '4h'
  | '6h'
  | '8h'
  | '12h'
  | '1d'
  | '3d'
  | '1w'
  | '1M';

export interface BinanceAPIAccount {
  makerCommission: boolean;
  takerCommission: boolean;
  buyerCommission: boolean;
  sellerCommission: boolean;
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  updateTime: number;
  accountType: 'SPOT';
  balances: Array<{ asset: string; free: string; locked: string }>;
}
