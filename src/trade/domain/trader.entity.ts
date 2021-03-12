import { InvalidProps } from 'src/exceptions';
import { Asset, AssetProps } from './asset.value-object';
import { AltCoin } from './coin.entity';
import { Threshold, ThresholdProps } from './threshold.entity';

export interface TraderProps {
  assets: AssetProps[];
  threshold: ThresholdProps;
}

export class Trader {
  private assets: Asset[];
  private threshold: Threshold;

  constructor(props: TraderProps) {
    this.assets = props.assets
      .map((a) => {
        try {
          return new Asset(a);
        } catch (e) {
          if (
            !(e instanceof InvalidProps) ||
            (e as InvalidProps<AssetProps>).prop !== 'coin'
          ) {
            throw e;
          }
        }
      })
      .filter((a) => a != null);
    this.threshold = new Threshold(props.threshold);
  }

  evaluateMarket() {
    const bestTrades = this.assets
      .filter((asset) => !asset.isBridge)
      .map((asset) => ({
        asset,
        trade: this.threshold.findBestTrade(asset.coin as AltCoin, 0.1),
      }))
      .filter((t) => t.trade[1] > 0);
  }
}
