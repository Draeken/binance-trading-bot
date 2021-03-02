import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { defaultOptions } from './binance/binance-api/binance-api.service';
import { BinanceModule } from './binance/binance.module';
import { TradeModule } from './trade/trade.module';

@Module({
  imports: [
    BinanceModule.register(defaultOptions),
    ConfigModule.forRoot(),
    TradeModule.register({ bridge: 'USDT', brokerCount: 1 }),
  ],
  exports: [BinanceModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
