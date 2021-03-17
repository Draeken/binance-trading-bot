import { InvalidProps } from 'src/exceptions';
import { Asset, AssetProps } from './asset.value-object';
import { AltCoin } from './coin.entity';
import { Operation } from './operation.entity';
import { Threshold, ThresholdProps } from './threshold.entity';

export interface TraderProps {
  assets: AssetProps[];
  threshold: ThresholdProps;
}

export class Trader {
  private assets: Asset[];
  private threshold: Threshold;
  private operations: Operation[];

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
      .filter(
        (asset) =>
          !asset.isBridge &&
          this.operations.every((op) => asset.coin.code !== op.assetCode),
      )
      .map((asset) => ({
        asset,
        trade: this.threshold.findBestTrade(asset.coin as AltCoin, 0.001),
      }))
      .filter((t) => t.trade[1] > 1);
    const bestTrade = bestTrades.reduce(
      (acc, cur) => (acc.trade[1] > cur.trade[1] ? acc : cur),
      undefined,
    );
    if (!bestTrade) {
      return;
    }
    return {
      asset: bestTrade.asset,
      target: bestTrade.trade[0],
      ratioGrowth: bestTrade.trade[1],
    };
  }

  addOperation(operation: Operation) {
    this.operations.push(operation);
  }
}
