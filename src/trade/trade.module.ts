import { DynamicModule, Module } from '@nestjs/common';
import { BrokerModule } from 'src/broker/broker.module';
import { SharedModule } from 'src/shared/shared.module';
import { TradeOptions } from './interfaces/trade-options.interface';
import { RepositoryService } from './repository/repository.service';
import { TradeController } from './trade.controller';
import { TraderService } from './trader/trader.service';

export const TRADE_OPTIONS = 'TRADE_OPTIONS';

@Module({
  imports: [BrokerModule],
  controllers: [TradeController],
  providers: [RepositoryService],
})
export class TradeModule {
  static register(options: TradeOptions): DynamicModule {
    return {
      module: TradeModule,
      imports: [SharedModule],
      providers: [
        { provide: 'TRADE_OPTIONS', useValue: options },
        TraderService,
      ],
    };
  }
}
