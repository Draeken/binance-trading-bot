import { Injectable, OnModuleInit } from '@nestjs/common';
import { CoinDict, CoinsUpdate } from '../domain/coin-dict.entity';
import { Trader } from '../domain/trader.entity';
import { RepositoryService } from '../repository/repository.service';

@Injectable()
export class AccountantService implements OnModuleInit {
  private trader: Trader;
  private supportedCoins: CoinDict;

  constructor(private repo: RepositoryService) {}

  async onModuleInit() {
    return this.repo
      .loadSupportedCoins()
      .then((coins) => {
        this.supportedCoins = new CoinDict(coins);
        return coins;
      })
      .then((coins) => this.repo.loadTrader(coins))
      .then((traderProps) => (this.trader = new Trader(traderProps)));
  }

  get coinList() {
    return this.supportedCoins.toList();
  }

  updateCoins(coinsUpdate: CoinsUpdate[]) {
    this.supportedCoins.updateCoins(coinsUpdate);
    this.trader.evaluateMarket();
  }
}
