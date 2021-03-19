import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BrokerModule } from './broker/broker.module';
import { TradeModule } from './trade/trade.module';

@Module({
  imports: [
    BrokerModule,
    ConfigModule.forRoot(),
    TradeModule.register({ bridge: 'USDT', brokerCount: 1 }),
  ],
  exports: [BrokerModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
