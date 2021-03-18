import { Asset } from './asset.value-object';
import { AltCoin } from './coin.entity';
import { Trade, TradeFromToAmount } from './trade.entity';

export interface OperationProps {
  asset: Asset;
  target: AltCoin;
  bridgeAsset: Asset;
  ratioGrowth: number;
  onTrade: (trade: Trade) => void;
}

export class Operation {
  private asset: Asset;
  private target: AltCoin;
  private bridgeAsset: Asset;
  private onTrade: (trade: Trade) => void;
  private onFinish: (op: Operation, targetBalance: number) => void;
  private firstTrade: Trade;
  private secondTrade: Trade;
  private amount: number;

  constructor(props: OperationProps) {
    this.asset = props.asset;
    this.target = props.target;
    this.bridgeAsset = props.bridgeAsset;
    this.onTrade = props.onTrade;
    this.amount = this.computeAmount(props.ratioGrowth);
  }

  start() {
    if (this.asset.pairWith(this.target)) {
      this.firstTrade = new Trade(
        this.asset.coin,
        this.target,
        this.amount,
        this.handleLastTrade(this.asset),
      );
    } else {
      this.firstTrade = new Trade(
        this.asset.coin,
        this.bridgeAsset.coin,
        this.amount,
        (tradeAmount) => this.handleFirstTradeFilled(tradeAmount),
      );
    }
    this.onTrade(this.firstTrade);
  }

  set onFinishCB(cb: (op: Operation, targetBalance: number) => void) {
    this.onFinish = cb;
  }

  get assetCode() {
    return this.asset.coin.code;
  }

  get targetCoin() {
    return this.target;
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

  private handleFirstTradeFilled(tradeAmount?: TradeFromToAmount) {
    if (tradeAmount) {
      this.asset.balance += tradeAmount.from;
      this.bridgeAsset.balance += tradeAmount.to;
      this.secondTrade = new Trade(
        this.bridgeAsset.coin,
        this.target,
        this.bridgeAsset.balance,
        this.handleLastTrade(this.bridgeAsset),
      );
      this.onTrade(this.secondTrade);
    }
  }

  private handleLastTrade(fromAsset: Asset) {
    return (tradeAmount?: TradeFromToAmount) => {
      if (tradeAmount) {
        fromAsset.balance += tradeAmount.from;
        this.onFinish(this, tradeAmount.to);
      }
    };
  }
}
