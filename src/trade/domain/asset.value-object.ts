import { InvalidProps } from 'src/exceptions';
import { Coin } from './coin.entity';

export interface AssetProps {
  coin: Coin;
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

  private validate() {
    if (this.coin == null) {
      throw new InvalidProps<AssetProps>('coin not defined', 'coin');
    }
    if (this.balance == NaN) {
      throw new InvalidProps<AssetProps>('balance not a number', 'balance');
    }
  }
}
