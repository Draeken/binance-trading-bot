import { Controller, Post } from '@nestjs/common';
import { TraderService } from './trader/trader.service';

@Controller('trade')
export class TradeController {
  constructor(private traderService: TraderService) {}

  @Post('start')
  start() {
    this.traderService.startTickers();
  }

  @Post('stop')
  end() {
    this.traderService.stopTickers();
  }
}
