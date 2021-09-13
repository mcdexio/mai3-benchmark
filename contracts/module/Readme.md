# Module

To avoid limitation of contract size, all business logics are implemented here.

## About Fee

### Trade

| Fee          | Belong to          | How to calculate               | Note                          |
|--------------|--------------------|--------------------------------|-------------------------------|
| lp fee       | liquidity provider | tradeValue * lpFeeRate         | may rebate a part to referral |
| operator fee | operator           | tradeValue * operatorFeeRate   | may rebate a part to referral |
| vault fee    | vault              | tradeValue * vaultFeeRate      |                               |

#### What if trader's available margin is not enough to pay fee

Trader is not allowed to open position in this case.

If trader is closing position:

- If `available margin ≤ 0`, all three fees are zero.
- If `0 < available margin < lp fee + operator fee + vault fee`, three fees split available margin proportionally.

#### What if there is a referrer in trade

Referrer will get a part of fee from Lp fee and operator fee. Referrer will **NOT** benefit from vault fee.

```
referral rebate = (lp fee + operator fee) * referral rebate rate

lp fee = lp fee * (1 - referral rebate rate)

operator fee = operator fee * (1 - referral rebate rate)
```

### Liquidate

There is only vault fee in liquidation.

The penalty of liquidation will be prior to the vault fee:

- if margin balance of liquidated account is only enough to cover the penalty, the vault fee will be ignored;
- if margin balance of liquidated account cannot fully cover the vault fee, the vault fee will be claimed as much as possible before all remaining margin drained.