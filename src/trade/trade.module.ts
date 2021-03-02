import { DynamicModule, Module } from '@nestjs/common';
import { BinanceModule } from 'src/binance/binance.module';
import { AccountantService } from './accountant/accountant.service';
import { TradeOptions } from './interfaces/trade-options.interface';
import { TraderService } from './trader/trader.service';

export const TRADE_OPTIONS = 'TRADE_OPTIONS';

@Module({})
export class TradeModule {
  static register(options: TradeOptions): DynamicModule {
    return {
      module: TradeModule,
      providers: [
        { provide: 'TRADE_OPTIONS', useValue: options },
        TraderService,
        AccountantService,
      ],
    };
  }
}
