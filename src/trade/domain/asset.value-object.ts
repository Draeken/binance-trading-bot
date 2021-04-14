import { InvalidProps } from 'src/exceptions';
import { AltCoin, Bridge } from './coin.entity';

export interface AssetProps {
  coin: Bridge | AltCoin;
  balance: number;
}

export class Asset {
  constructor(private props: AssetProps) {
    this.validate();
  }

  get coin() {
    return this.props.coin;
  }

  get balance() {
    return this.props.balance;
  }

  set balance(balance: number) {
    this.props.balance = balance;
  }

  get valuation() {
    return (
      this.props.balance *
      (this.props.coin.isBridge ? 1 : (this.props.coin as AltCoin).valuation)
    );
  }

  get isBridge() {
    return (this.coin as Bridge).isBridge == true;
  }

  pairWith(coin: AltCoin) {
    return this.coin.isBridge || (this.coin as AltCoin).hasPair(coin);
  }

  isTradable(factor: number) {
    return this.coin.isBridge
      ? false
      : this.balance * factor > (this.coin as AltCoin).filters.quantity.min;
  }

  private validate() {
    if (this.coin == null) {
      throw new InvalidProps<AssetProps>('coin not defined', 'coin');
    }
    if (this.balance == NaN) {
      throw new InvalidProps<AssetProps>('balance not a number', 'balance');
    }
  }
}
