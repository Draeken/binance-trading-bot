import { Asset } from './asset.value-object';
import { AltCoin, Bridge } from './coin.entity';
import { Trade } from './trade.entity';

export interface OperationProps {
  asset: Asset;
  target: AltCoin;
  bridge: Bridge;
  ratioGrowth: number;
  onTrade: (trade: Trade) => void;
}

export class Operation {
  private asset: Asset;
  private target: AltCoin;
  private bridge: Bridge;
  private onTrade: (trade: Trade) => void;
  private firstTrade: Trade;
  private secondTrade: Trade;
  private amount: number;

  constructor(props: OperationProps) {
    this.asset = props.asset;
    this.target = props.target;
    this.bridge = props.bridge;
    this.onTrade = props.onTrade;
    this.amount = this.computeAmount(props.ratioGrowth);
  }

  start() {
    if (this.asset.pairWith(this.target)) {
      this.firstTrade = new Trade(this.asset.coin, this.target, this.amount);
    } else {
      this.firstTrade = new Trade(this.asset.coin, this.bridge, this.amount);
    }
    this.onTrade(this.firstTrade);
  }

  get assetCode() {
    return this.asset.coin.code;
  }

  private computeAmount(ratioGrowth: number) {
    let amountFactor = 0.25;
    if (ratioGrowth > 1.15) {
      amountFactor = 0.35;
    }
    if (ratioGrowth > 1.3) {
      amountFactor = 0.5;
    }
    return this.asset.balance * amountFactor;
  }
}
