import { TradeStatus } from 'src/trade/domain/trade.entity';
import { Candlestick } from 'src/trade/interfaces/candlestick.interface';
import {
  BinanceCandlestick,
  BinanceSymbolPrice,
} from './interfaces/binance-api.interface';

export const pricesListToDict = (
  prices: Array<BinanceSymbolPrice>,
): { [key: string]: string } =>
  prices.reduce((cur, acc) => ({ ...cur, [acc.symbol]: acc.price }), {});

const bigNum = 10 ** 10;

export const ratio = (priceA: string, priceB: string) =>
  (Number.parseFloat(priceA) * bigNum) / (Number.parseFloat(priceB) * bigNum);

export const prettifyKlines = (e: BinanceCandlestick): Candlestick => ({
  timestamp: e.E,
  coin: e.s,
  open: Number.parseFloat(e.k.o),
  close: Number.parseFloat(e.k.c),
  high: Number.parseFloat(e.k.h),
  low: Number.parseFloat(e.k.l),
});

export const statusToEnum = (string): TradeStatus => {
  switch (string) {
    case 'CANCELED':
      return TradeStatus.CANCELED;
    case 'EXPIRED':
      return TradeStatus.EXPIRED;
    case 'FILLED':
      return TradeStatus.FILLED;
    case 'NEW':
      return TradeStatus.NEW;
    case 'PARTIALLY_FILLED':
      return TradeStatus.PARTIALLY_FILLED;
    case 'PENDING_CANCEL':
      return TradeStatus.PENDING_CANCEL;
    case 'REJECTED':
      return TradeStatus.REJECTED;
  }
};

export const stepToPrecision = (step: string) => {
  const indexOfOne = step.indexOf('1');
  if (indexOfOne === 0) {
    return 1 - step.indexOf('.');
  }
  return indexOfOne - 1;
};
