import { Binance, defaultOptions } from './binanceApi.ts';
import { credentials } from './.credentials.ts';
import { pricesListToObj, ratio } from './utils.ts';

const ratioCoinsTablePath = './ratio_coins_table.json';
const bridge = 'USDT';
const supportedCoinList = ['XLM', 'TRX', 'ICX', 'EOS', 'IOTA', 'ONT', 'ADA', 'XMR', 'DASH', 'NEO', 'ATOM', 'VET', 'BAT', 'BTT', 'ALGO'];
const brokerCount = 1;
let ratioCoinsTable = [];

const binance = new Binance({ ...defaultOptions, APIKEY: credentials.APIKEY, APISECRET: credentials.APISECRET });

const initializeRatioCoinsTable = () => {
  return binance
    .prices()
    .then(pricesListToObj)
    .then((prices) => {
      return supportedCoinList.reduce((curA, coinA) => {
        return {
          ...curA,
          [coinA]: supportedCoinList.reduce((curB, coinB) => {
            if (coinA === coinB) return curB;
            return { ...curB, [coinB]: ratio(prices[coinA + bridge], prices[coinB + bridge]) };
          }, {}),
        };
      }, {});
    })
    .then((ratioTable) => Deno.writeTextFile(ratioCoinsTablePath, JSON.stringify(ratioTable)));
};

const loadRatioCoinsTable = () => {
  try {
    const table = Deno.readTextFileSync(ratioCoinsTablePath);
    ratioCoinsTable = JSON.parse(table);
  } catch (e) {
    initializeRatioCoinsTable();
    //ratioCoinsTable = [...Array(brokerCount)].map(_ => )
  }
};

const main = () => {
  loadRatioCoinsTable();
};

main();
