import { Injectable, OnModuleInit } from '@nestjs/common';
import { AltCoin } from '../domain/coin.entity';
import { RepositoryService } from '../repository/repository.service';

@Injectable()
export class AccountantService implements OnModuleInit {
  private bridge: string;

  private ratioCoinsTable;
  private supportedCoinList: AltCoin[];

  constructor(private repo: RepositoryService) {}

  async onModuleInit() {
    return this.repo
      .loadSupportedCoins()
      .then((coins) => {
        this.supportedCoinList = coins;
        return coins;
      })
      .then((coins) => this.repo.loadRatioCoinsTable(coins))
      .then((ratio) => this.ratioCoinsTable(ratio));
  }

  get coinList() {
    return [...this.supportedCoinList];
  }

  get coinBridgeList() {
    return this.supportedCoinList.map((c) => c + this.bridge);
  }
}
