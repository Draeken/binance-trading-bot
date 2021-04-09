import { Module, Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SharedModule } from 'src/shared/shared.module';
import { BinanceApiClient, defaultOptions } from './binance-api-client';
import { BrokerService } from './broker.service';
import { BinanceOptions } from './interfaces/binance-api.interface';

const EXCHANGE_PLATFORM = 'EXCHANGEPLATFORM';
export const EXCHANGE_OPTIONS = 'BINANCE_OPTIONS';

const exchangePlatformFactory: Provider = {
  provide: EXCHANGE_PLATFORM,
  useFactory: (options: BinanceOptions, config: ConfigService) => {
    const apiAccess = {
      APIKEY: config.get<string>('APIKEY'),
      APISECRET: config.get<string>('APISECRET'),
    };
    return new BinanceApiClient({ ...options, ...apiAccess });
  },
  inject: [EXCHANGE_OPTIONS, ConfigService],
};

@Module({
  imports: [ConfigModule, SharedModule],
  providers: [
    {
      provide: EXCHANGE_OPTIONS,
      useValue: defaultOptions,
    },
    exchangePlatformFactory,
    BrokerService,
  ],
  exports: [BrokerService],
})
export class BrokerModule {}
