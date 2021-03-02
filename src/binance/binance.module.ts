import { DynamicModule, Global, HttpModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  BinanceApiService,
  BINANCE_OPTIONS,
} from './binance-api/binance-api.service';
import { BinanceOptions } from './interfaces/binance-api.interface';

@Module({})
export class BinanceModule {
  static register(options: BinanceOptions): DynamicModule {
    return {
      module: BinanceModule,
      global: true,
      imports: [ConfigModule],
      providers: [
        { provide: BINANCE_OPTIONS, useValue: options },
        BinanceApiService,
      ],
      exports: [BinanceApiService],
    };
  }
}
