import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { TradeModule } from './trade/trade.module';
import { SharedModule } from './shared/shared.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TradeModule.register({ bridge: 'USDT', brokerCount: 1 }),
    SharedModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
