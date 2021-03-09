import { DynamicModule, Module } from '@nestjs/common';
import { AccountantService } from './accountant/accountant.service';
import { TradeOptions } from './interfaces/trade-options.interface';
import { TradeController } from './trade.controller';
import { TraderService } from './trader/trader.service';
import { RepositoryService } from './repository/repository.service';

export const TRADE_OPTIONS = 'TRADE_OPTIONS';

@Module({
  controllers: [TradeController],
  providers: [RepositoryService],
})
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
