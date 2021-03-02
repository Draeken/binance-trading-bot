export interface BinanceOptions {
  keepAlive: boolean;
  recvWindow: number;
  reconnect: boolean;
  verbose: boolean;
  test: boolean;
  log: (...s: any[]) => void;
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
