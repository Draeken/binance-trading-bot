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

  get isBridge() {
    return (this.coin as Bridge).isBridge == true;
  }

  pairWith(coin: AltCoin) {
    return this.coin.isBridge || (this.coin as AltCoin).hasPair(coin);
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
