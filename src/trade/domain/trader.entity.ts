import { InvalidProps } from 'src/exceptions';
import { Asset, AssetProps } from './asset.value-object';
import { AltCoin, Coin } from './coin.entity';
import { Operation } from './operation.entity';
import { Threshold, ThresholdProps } from './threshold.entity';

export interface TraderProps {
  assets: AssetProps[];
  threshold: ThresholdProps;
}

interface TradeEvaluation {
  asset: Asset;
  target: AltCoin;
  ratioGrowth: number;
}

export class Trader {
  private readonly fee = 0.001;
  private readonly maxTradeFactor = 0.5;
  private readonly maxRelativeQuantity = 0.5;
  private _assets: Asset[] = [];
  private _bridgeAsset: Asset;
  private firstEvaluation = true;
  private excludedCoins: Coin[] = [];
  private threshold: Threshold;
  private operations: Operation[] = [];

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
        // this.assetRelativeQuantities.set(asset, 0);
      }
    }
    this.threshold = new Threshold(props.threshold);
  }

  evaluateMarket() {
    if (this.firstEvaluation) {
      this.updateExcludedAssets();
      this.firstEvaluation = false;
    }
    const bestTrades = this._assets
      .filter(
        (asset) =>
          this.operations.every((op) => asset.coin.code !== op.fromCoin.code) &&
          asset.isTradable(this.maxTradeFactor),
      )
      .map((asset) => ({
        asset,
        trade: this.threshold.findBestTrade(
          asset.coin as AltCoin,
          this.fee,
          this.excludedCoins,
        ),
      }))
      .filter((t) => t.trade[1] > 1);
    if (bestTrades.length === 0) {
      return;
    }
    const bestTrade = bestTrades.reduce((acc, cur) =>
      acc.trade[1] > cur.trade[1] ? acc : cur,
    );
    return {
      asset: bestTrade.asset,
      target: bestTrade.trade[0],
      ratioGrowth: bestTrade.trade[1],
    };
  }

  addOperation(trade: TradeEvaluation, operation: Operation) {
    this.operations.push(operation);
    operation.amount = this.computeAmount(
      trade.asset.balance,
      trade.ratioGrowth,
    );
    operation.setCoins(trade.asset.coin as AltCoin, trade.target);
    operation.addFromBalanceCB = (amount) => {
      trade.asset.balance += amount;
    };
    operation.onFinishCB = (targetBalance: number) => {
      const i = this.operations.findIndex((o) => o === operation);
      this.operations.splice(i, 1);

      if (Number.isNaN(targetBalance)) {
        return;
      }
      const targetCoin = operation.toCoin;
      let targetAsset = this._assets.find((a) => a.coin === targetCoin);
      if (!targetAsset) {
        targetAsset = new Asset({ coin: targetCoin, balance: targetBalance });
        this._assets.push(targetAsset);
      } else {
        targetAsset.balance = targetBalance;
      }
      this.updateExcludedAssets();
      if (operation.isDirectPair) {
        this.threshold.updateRatios(operation.fromCoin, operation.toCoin);
      } else {
        this.threshold.updateRatios(
          operation.fromCoin,
          operation.toCoin,
          operation.prices,
        );
      }
    };
    operation.start();
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

  private updateExcludedAssets() {
    const totalValuation = this._assets.reduce(
      (acc, cur) => acc + cur.valuation,
      0,
    );
    const excludedAssets: Coin[] = [];
    for (const asset of this._assets) {
      if (asset.valuation / totalValuation >= this.maxRelativeQuantity) {
        excludedAssets.push(asset.coin);
      }
    }
    this.excludedCoins = excludedAssets;
  }

  private computeAmount(balance: number, ratioGrowth: number) {
    let amountFactor = this.maxTradeFactor * 0.5;
    if (ratioGrowth > 1.15) {
      amountFactor = this.maxTradeFactor * 0.75;
    }
    if (ratioGrowth > 1.3) {
      amountFactor = this.maxTradeFactor;
    }
    return balance * amountFactor;
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
