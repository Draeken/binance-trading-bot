import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BrokerService } from 'src/broker/broker.service';
import { CoinDict } from '../domain/coin-dict.entity';
import { AltCoin, Bridge } from '../domain/coin.entity';
import { Trader } from '../domain/trader.entity';
import { TradeOptions } from '../interfaces/trade-options.interface';
import { RepositoryService } from './repository.service';

const mockedBrokerService = {
  exchangeInfo: () => Promise.reject('mock'),
  allPairs: () => Promise.reject('mock'),
  account: () => Promise.reject('mock'),
  prices: () => Promise.reject('mock'),
};

const bridgeCode = 'USDT';
const bridge = new Bridge(bridgeCode);

describe('RepositoryService', () => {
  let service: RepositoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        Logger,
        {
          provide: 'TRADE_OPTIONS',
          useValue: { bridge: bridgeCode, brokerCount: 1 } as TradeOptions,
        },
        {
          provide: BrokerService,
          useValue: mockedBrokerService,
        },
        RepositoryService,
      ],
    }).compile();

    service = module.get<RepositoryService>(RepositoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('loads supported coins', async () => {
    const supportedListCoinsRaw = ['XLM'];
    jest
      .spyOn(service as any, 'readFile')
      .mockImplementation(() =>
        Promise.resolve(JSON.stringify(supportedListCoinsRaw)),
      );
    const altCoins = await service.loadSupportedCoins();
    expect(altCoins).toHaveLength(supportedListCoinsRaw.length);
    expect(altCoins[0].code).toBe('XLM');
    expect(altCoins[0].isBridge).toBeFalsy();
  });

  it('loads all coins info', async () => {
    const coinInfos = {
      XLM: {
        filters: {
          price: {
            min: 0.1,
            max: 10,
            precision: 0.1,
          },
          quantity: {
            min: 0.01,
            max: 0,
            precision: 0.01,
          },
        },
        pairs: [{ coin: 'ADA', quote: 'ADA', base: 'XLM' }],
      },
      ADA: {
        filters: {
          price: {
            min: 0.2,
            max: 20,
            precision: 0.2,
          },
          quantity: {
            min: 0.02,
            max: 0,
            precision: 0.02,
          },
        },
        pairs: [{ coin: 'XLM', quote: 'ADA', base: 'XLM' }],
      },
    };
    const coinXlm = new AltCoin({ code: 'XLM' });
    const coinAda = new AltCoin({ code: 'ADA' });
    const coinDict = new CoinDict([coinXlm, coinAda]);
    jest
      .spyOn(service as any, 'readFile')
      .mockImplementation(() => Promise.resolve(JSON.stringify(coinInfos)));
    const exchangeInfoSpy = jest.spyOn(mockedBrokerService, 'exchangeInfo');
    await service.loadCoinInfos(coinDict);
    expect(coinDict.get('XLM').hasPair(coinAda)).toBeTruthy();
    expect(coinDict.get('ADA').hasPair(coinXlm)).toBeTruthy();
    expect(coinDict.get('XLM').filters.price.max).toBe(10);
    expect(coinDict.get('ADA').filters.price.max).toBe(20);
    expect(exchangeInfoSpy).not.toHaveBeenCalled();
  });

  it('searches for missing coin info', async () => {
    const coinInfos = {
      XLM: {
        filters: {
          price: {
            min: 0.1,
            max: 10,
            precision: 0.1,
          },
          quantity: {
            min: 0.01,
            max: 0,
            precision: 0.01,
          },
        },
        pairs: [],
      },
    };
    const coinBinanceInfo = {
      ['ADA' + bridgeCode]: {
        price: {
          min: 0.2,
          max: 20,
          precision: 0.1,
        },
        quantity: {
          min: 0.02,
          max: 2,
          precision: 0.01,
        },
      },
      ['DASH' + bridgeCode]: {
        price: {
          min: 0.3,
          max: 30,
          precision: 0.1,
        },
        quantity: {
          min: 0.03,
          max: 3,
          precision: 0.01,
        },
      },
    };
    const allPairs = new Set(['ADADASH']);
    const coinXlm = new AltCoin({ code: 'XLM' });
    const coinAda = new AltCoin({ code: 'ADA' });
    const coinDash = new AltCoin({ code: 'DASH' });
    const coinDict = new CoinDict([coinXlm, coinAda, coinDash]);
    jest
      .spyOn(service as any, 'readFile')
      .mockImplementation(() => Promise.resolve(JSON.stringify(coinInfos)));
    const exchangeInfoSpy = jest
      .spyOn(mockedBrokerService as any, 'exchangeInfo')
      .mockImplementation((...coinsMarket) => {
        expect(coinsMarket).toHaveLength(2);
        expect(coinsMarket).toContain('ADA' + bridgeCode);
        expect(coinsMarket).toContain('DASH' + bridgeCode);
        return Promise.resolve(coinBinanceInfo);
      });
    const allPairsSpy = jest
      .spyOn(mockedBrokerService as any, 'allPairs')
      .mockImplementation(() => Promise.resolve(allPairs));
    const saveInfos = jest
      .spyOn(service as any, 'saveCoinInfos')
      .mockImplementation(() => {
        return null;
      });
    service.bridgeCoin = bridge;
    await service.loadCoinInfos(coinDict);
    expect(exchangeInfoSpy).toHaveBeenCalled();
    expect(allPairsSpy).toHaveBeenCalled();
    expect(saveInfos).toHaveBeenCalled();
    expect(coinDict.get('XLM').hasPair(coinAda)).toBeFalsy();
    expect(coinDict.get('ADA').hasPair(coinXlm)).toBeFalsy();
    expect(coinDict.get('XLM').filters.price.max).toBe(10);
    expect(coinDict.get('ADA').filters.price.max).toBe(20);
    expect(coinDict.get('DASH').filters.price.max).toBe(30);
    expect(coinDict.get('ADA').hasPair(coinDash)).toBeTruthy();
    expect(coinDict.get('DASH').hasPair(coinAda)).toBeTruthy();
  });

  it('loads trader props', async () => {
    const coinXlm = new AltCoin({ code: 'XLM' });
    const coinAda = new AltCoin({ code: 'ADA' });
    const supportedCoins = new CoinDict([coinXlm, coinAda]);
    const ratios = {
      XLM: {
        ADA: 2,
      },
      ADA: {
        XLM: 0.5,
      },
    };
    const assetsRaw = [
      { coin: 'XLM', balance: 100.2842 },
      { coin: 'ADA', balance: 0.002842 },
    ];

    jest
      .spyOn(service as any, 'readFile')
      .mockImplementation((path: string) => {
        if (path === './ratio_coins_table.json') {
          return Promise.resolve(JSON.stringify(ratios));
        }
        if (path === './asset_balances.json') {
          return Promise.resolve(JSON.stringify(assetsRaw));
        }
        fail('path unrecognized :' + path);
      });

    const traderProps = await service.loadTrader(supportedCoins);
    expect(traderProps.assets).toHaveLength(2);
    expect(
      traderProps.assets.find((asset) => asset.coin.code === 'XLM').balance,
    ).toBe(assetsRaw[0].balance);
    expect(traderProps.threshold.ratios['XLM']['ADA']).toBe(2);
    expect(traderProps.threshold.coins.get('XLM').isBridge).toBeFalsy();
  });

  it('loads trader props through broker service', async () => {
    const coinXlm = new AltCoin({ code: 'XLM' });
    const coinAda = new AltCoin({ code: 'ADA' });
    const supportedCoins = new CoinDict([coinXlm, coinAda]);
    const prices = {
      ['XLM' + bridgeCode]: '1.000',
      ['ADA' + bridgeCode]: '2.000',
    };
    const assetsBroker = [
      { asset: 'XLM', free: '100.2842' },
      { asset: 'ADA', free: '0.002842' },
      { asset: bridgeCode, free: '1.00000' },
    ];

    jest
      .spyOn(service as any, 'readFile')
      .mockImplementation(() => Promise.reject());
    const saveRatiosSpy = jest
      .spyOn(service as any, 'saveRatios')
      .mockImplementation((ratios: any) => Promise.resolve(ratios));
    jest
      .spyOn(mockedBrokerService as any, 'prices')
      .mockImplementation(() => Promise.resolve(prices));
    jest
      .spyOn(mockedBrokerService as any, 'account')
      .mockImplementation(() => Promise.resolve({ balances: assetsBroker }));

    service.bridgeCoin = bridge;
    const traderProps = await service.loadTrader(supportedCoins);
    expect(saveRatiosSpy).toHaveBeenCalled();
    expect(traderProps.assets).toHaveLength(3);
    expect(
      traderProps.assets.find((asset) => asset.coin.code === bridgeCode)
        .balance,
    ).toBe(1);
    expect(
      traderProps.assets.find((asset) => asset.coin.code === 'XLM').balance,
    ).toBe(100.2842);
    expect(
      traderProps.assets.find((asset) => asset.coin.code === 'ADA').balance,
    ).toBe(0.002842);
    expect(traderProps.threshold.ratios['XLM']['ADA']).toBe(0.5);
    expect(traderProps.threshold.coins.get('XLM').isBridge).toBeFalsy();
  });

  it('saves trader props', async () => {
    const coinXlm = new AltCoin({ code: 'XLM' });
    const coinAda = new AltCoin({ code: 'ADA' });
    const supportedCoins = new CoinDict([coinXlm, coinAda]);
    const ratios = {
      XLM: {
        ADA: 2,
      },
      ADA: {
        XLM: 0.5,
      },
    };
    const trader = new Trader({
      assets: [
        { balance: 1.001, coin: coinXlm },
        { balance: 0.001, coin: coinAda },
        { balance: 1, coin: bridge },
      ],
      threshold: { coins: supportedCoins, ratios },
    });

    service.bridgeCoin = bridge;

    const saveAssetSpy = jest
      .spyOn(service as any, 'saveAssets')
      .mockImplementation(
        (assets: Array<{ balance: number; coin: string }>) => {
          expect(assets).toHaveLength(3);
          expect(assets.find((asset) => asset.coin === 'XLM').balance).toBe(
            1.001,
          );
          expect(assets.find((asset) => asset.coin === 'ADA').balance).toBe(
            0.001,
          );
          expect(
            assets.find((asset) => asset.coin === bridgeCode).balance,
          ).toBe(1);
          return Promise.resolve();
        },
      );
    const saveRatiosSpy = jest
      .spyOn(service as any, 'saveRatios')
      .mockImplementation((ratios) => {
        expect(ratios['XLM']['ADA']).toBe(2);
        expect(ratios['ADA']['XLM']).toBe(0.5);
        return Promise.resolve();
      });

    await service.saveTrader(trader);
    expect(saveAssetSpy).toHaveBeenCalledTimes(1);
    expect(saveRatiosSpy).toHaveBeenCalledTimes(1);
  });
});
