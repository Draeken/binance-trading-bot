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
  private _assets: Asset[] = [];
  private _bridgeAsset: Asset;
  private threshold: Threshold;
  private operations: Operation[];

  constructor(props: TraderProps) {
    for (const assetProps of props.assets) {
      const asset = createAsset(assetProps);
      if (asset == null) {
        continue;
      }
      if (asset.isBridge) {
        this._bridgeAsset = asset;
      } else {
        this._assets.push(asset);
      }
    }
    this._assets = props.assets
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
    const bestTrades = this._assets
      .filter((asset) =>
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
    operation.onFinishCB = (op: Operation, targetBalance: number) => {
      const i = this.operations.findIndex((o) => o === op);
      this.operations.splice(i, 1);
      const targetCoin = op.targetCoin;
      const targetAsset =
        this._assets.find((a) => a.coin === targetCoin) ??
        new Asset({ coin: targetCoin, balance: targetBalance });
      targetAsset.balance = targetBalance;
    };
  }

  get ratios() {
    return this.threshold.ratios;
  }

  get assets() {
    const mapAsset = (asset: Asset) => ({
      coin: asset.coin,
      balance: asset.balance,
    });
    return [...this._assets.map(mapAsset), mapAsset(this.bridgeAsset)];
  }

  get bridgeAsset() {
    return this._bridgeAsset;
  }
}

const createAsset = (props: AssetProps) => {
  try {
    return new Asset(props);
  } catch (e) {
    if (
      !(e instanceof InvalidProps) ||
      (e as InvalidProps<AssetProps>).prop !== 'coin'
    ) {
      throw e;
    }
  }
};
