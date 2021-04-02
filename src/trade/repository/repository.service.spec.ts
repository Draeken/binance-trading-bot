import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BrokerService } from 'src/broker/broker.service';
import { TradeOptions } from '../interfaces/trade-options.interface';
import { RepositoryService } from './repository.service';

const mockedBrokerService = {};

describe('RepositoryService', () => {
  let service: RepositoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        Logger,
        {
          provide: 'TRADE_OPTIONS',
          useValue: { bridge: 'USDT', brokerCount: 1 } as TradeOptions,
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

  it('', async () => {
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
});
