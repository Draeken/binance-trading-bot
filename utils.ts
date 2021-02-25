import { BinanceSymbolPrice } from './binanceApi.ts';

const bigNum = 10 ** 10;

export const pricesListToObj = (prices: Array<BinanceSymbolPrice>): { [key: string]: string } =>
  prices.reduce((cur, acc) => ({ ...cur, [acc.symbol]: acc.price }), {});

export const ratio = (priceA: string, priceB: string) => (Number.parseFloat(priceA) * bigNum) / (Number.parseFloat(priceB) * bigNum);
