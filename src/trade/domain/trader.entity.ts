import { InvalidProps } from 'src/exceptions';
import { Asset, AssetProps } from './asset.value-object';
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
}
