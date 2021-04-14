import { Asset } from './asset.value-object';
import { AltCoin } from './coin.entity';
import { Trade, TradeFromToAmount } from './trade.entity';

export interface OperationProps {
  bridgeAsset: Asset;
  onTrade: (trade: Trade) => void;
}

export class Operation {
  private from: AltCoin;
  private target: AltCoin;
  private bridgeAsset: Asset;
  private onTrade: (trade: Trade) => void;
  private onFinish: (targetBalance: number) => void;
  private addFromBalance: (amount: number) => void;
  private firstTrade: Trade;
  private secondTrade: Trade;
  private _amount: number;
  private fromPrice: number;
  private toPrice: number;
  private _isDirectPair = false;

  constructor(props: OperationProps) {
    this.bridgeAsset = props.bridgeAsset;
    this.onTrade = props.onTrade;
  }

  setCoins(from: AltCoin, target: AltCoin) {
    this.from = from;
    this.target = target;
  }

  set addFromBalanceCB(cb: (amount: number) => void) {
    this.addFromBalance = cb;
  }

  start() {
    if (this.from.hasPair(this.target)) {
      this._isDirectPair = true;
      this.firstTrade = new Trade(
        this.from,
        this.target,
        this._amount,
        (tradeAmount: TradeFromToAmount) => {
          this.toPrice = tradeAmount.price;
          this.addFromBalance(tradeAmount.from);
          this.onFinish(tradeAmount.to);
        },
        () => this.onFinish(NaN),
      );
    } else {
      this.firstTrade = new Trade(
        this.from,
        this.bridgeAsset.coin,
        this._amount,
        (tradeAmount) => this.handleFirstTradeFilled(tradeAmount),
        () => this.onFinish(NaN),
      );
    }
    this.onTrade(this.firstTrade);
  }

  set onFinishCB(cb: (targetBalance: number) => void) {
    this.onFinish = cb;
  }

  get fromCoin() {
    return this.from;
  }

  get prices() {
    return { from: this.fromPrice, to: this.toPrice };
  }

  get isDirectPair() {
    return this._isDirectPair;
  }

  get toCoin() {
    return this.target;
  }

  set amount(amount: number) {
    this._amount = amount;
  }

  private handleFirstTradeFilled(tradeAmount: TradeFromToAmount) {
    this.addFromBalance(tradeAmount.from);
    this.bridgeAsset.balance += tradeAmount.to;
    this.fromPrice = tradeAmount.price;
    this.secondTrade = new Trade(
      this.bridgeAsset.coin,
      this.target,
      tradeAmount.to,
      (tradeAmount: TradeFromToAmount) => {
        this.toPrice = tradeAmount.price;
        this.bridgeAsset.balance += tradeAmount.from;
        this.onFinish(tradeAmount.to);
      },
      () => this.onFinish(NaN),
    );
    this.onTrade(this.secondTrade);
  }
}
