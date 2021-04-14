import { Asset } from './asset.value-object';
import { AltCoin, Bridge } from './coin.entity';
import { Operation } from './operation.entity';
import { Trade, TradeStatus } from './trade.entity';

const bridgeCoin = new Bridge('bridge');

describe('operation.entity', () => {
  it('should handle direct pair trade', () => {
    const bridgeAsset = new Asset({ balance: 0, coin: bridgeCoin });
    const from = new AltCoin({ code: 'from' });
    const to = new AltCoin({ code: 'to' });
    from.addPair(to, { base: from, quote: to });
    const onTrade = jest.fn((_trade: Trade) => {
      expect(_trade.marketName).toBe('fromto');
      expect(_trade.operation.type).toBe('SELL');
      expect(_trade.operation.base).toBe(from);
      expect(_trade.operation.quote).toBe(to);
      expect(_trade.amount).toBe(10);
      _trade.updateAfterInit({
        amount: { base: -10, quote: 20 },
        id: 1,
        price: 1,
        status: TradeStatus.FILLED,
      });
    });

    const operation = new Operation({ bridgeAsset, onTrade });
    operation.amount = 10;
    operation.setCoins(from, to);
    const addFromBalanceCB = jest.fn((amount: number) => {
      expect(amount).toBe(-10);
    });
    operation.addFromBalanceCB = addFromBalanceCB;
    const onFinishCB = jest.fn((targetBalance) => {
      expect(targetBalance).toBe(20);
    });
    operation.onFinishCB = onFinishCB;

    operation.start();
    expect(onTrade).toHaveBeenCalledTimes(1);
    expect(addFromBalanceCB).toHaveBeenCalledTimes(1);
    expect(onFinishCB).toHaveBeenCalledTimes(1);
  });

  it('should handle direct pair trade (inversed base/quote', () => {
    const bridgeAsset = new Asset({ balance: 0, coin: bridgeCoin });
    const from = new AltCoin({ code: 'from' });
    const to = new AltCoin({ code: 'to' });
    from.addPair(to, { base: to, quote: from });
    const onTrade = jest.fn((_trade: Trade) => {
      expect(_trade.marketName).toBe('tofrom');
      expect(_trade.operation.type).toBe('BUY');
      expect(_trade.operation.base).toBe(to);
      expect(_trade.operation.quote).toBe(from);
      expect(_trade.amount).toBe(10);
      _trade.updateAfterInit({
        amount: { base: 20, quote: -10 },
        id: 1,
        price: 1,
        status: TradeStatus.FILLED,
      });
    });

    const operation = new Operation({ bridgeAsset, onTrade });
    operation.amount = 10;
    operation.setCoins(from, to);
    const addFromBalanceCB = jest.fn((amount: number) => {
      expect(amount).toBe(-10);
    });
    operation.addFromBalanceCB = addFromBalanceCB;
    const onFinishCB = jest.fn((targetBalance) => {
      expect(targetBalance).toBe(20);
    });
    operation.onFinishCB = onFinishCB;

    operation.start();
    expect(onTrade).toHaveBeenCalledTimes(1);
    expect(addFromBalanceCB).toHaveBeenCalledTimes(1);
    expect(onFinishCB).toHaveBeenCalledTimes(1);
  });

  it('should handle trade with bridge', () => {
    const bridgeAsset = new Asset({ balance: 0, coin: bridgeCoin });
    const from = new AltCoin({ code: 'from' });
    const to = new AltCoin({ code: 'to' });
    let firstTrade = true;
    const onTrade = jest.fn((_trade: Trade) => {
      if (firstTrade) {
        expect(_trade.marketName).toBe('frombridge');
        expect(_trade.operation.type).toBe('SELL');
        expect(_trade.operation.base).toBe(from);
        expect(_trade.operation.quote).toBe(bridgeCoin);
        expect(_trade.amount).toBe(10);
        firstTrade = false;
        _trade.updateAfterInit({
          amount: { base: -10, quote: 15 },
          id: 1,
          price: 1,
          status: TradeStatus.FILLED,
        });
      } else {
        expect(_trade.marketName).toBe('tobridge');
        expect(_trade.operation.type).toBe('BUY');
        expect(_trade.operation.base).toBe(to);
        expect(_trade.operation.quote).toBe(bridgeCoin);
        expect(_trade.amount).toBe(15);
        _trade.updateAfterInit({
          amount: { base: 20, quote: -15 },
          id: 1,
          price: 1,
          status: TradeStatus.FILLED,
        });
      }
    });

    const operation = new Operation({ bridgeAsset, onTrade });
    operation.amount = 10;
    operation.setCoins(from, to);
    const addFromBalanceCB = jest.fn((amount: number) => {
      expect(amount).toBe(-10);
    });
    operation.addFromBalanceCB = addFromBalanceCB;
    const onFinishCB = jest.fn((targetBalance) => {
      expect(targetBalance).toBe(20);
    });
    operation.onFinishCB = onFinishCB;

    operation.start();
    expect(onTrade).toHaveBeenCalledTimes(2);
    expect(addFromBalanceCB).toHaveBeenCalledTimes(1);
    expect(onFinishCB).toHaveBeenCalledTimes(1);
  });
});
