import { Coin } from './coin.entity';

export class Trade {
  private createdAt: number;
  private lastUpdateAt: number;
  private status: string;
  private id: string;

  constructor(private from: Coin, private to: Coin, private amount: number) {
    this.createdAt = Date.now();
    this.lastUpdateAt = Date.now();
  }

  get isFromBridge() {
    return this.from.isBridge;
  }
}
