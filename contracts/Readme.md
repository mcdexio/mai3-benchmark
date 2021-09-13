# Overview

[TOC]

Logically, the Mai Protocol V3 is mainly composed of five parts: Pool Creator, Liquidity Pool, Perpetual, AMM and Governor.

![mai3-arch](asset/mai3-arch.png)



## Main Components

### PoolCreator

Contracts of pool creator is located in `contracts/factory`.

Pool Creator manages the liquidity pools.

Every liquidity pool will be created by the trader who wants to be the operator through `createLiquidityPool` or `createLiquidityPoolWith` in the deployed `PoolCreator` contract.

Since the design of MCDEX v3 is totally follow the rule of 'Permissionless', the pool creator does not directly manage the implementation (contract) of liquidity pools, but supplies different implementations for operators to create with.

Pool creator also manages global variables for all created liquidity pools.

### LiquidityPool

Contracts of liquidity pool is located in `contracts/LiquidityPool.sol`.

In MCDEX v3, a single liquidity pools is able to provide liquidity for multiple perpetuals using the same collateral with liquidity pool. This is so called 'shared liquidity pool'.

By default, all the trades will happened between trader and liquidity pool, which means the liquidity pool (AMM) will act as counterparties to the traders.

Liquidity provider who wants to earn trading fees can add or remove liquidity to the pool. Unlike traders, liquidity providers do not hold position directly and not have margin accounts.

Liquidity provider will receive share tokens in return which is used in voting system.

### Perpetual

Contracts of perpetual is located in `contracts/Perpetual.sol`.

A perpetual, like a market, defines the rule of trade and stores the status of market and the data of traders.

Every trader to trade in the perpetual have a margin account to store personal information. Trader can deposit to or withdraw from the margin account, then trade in the perpetual.

*\*To avoid call overhead between different contract, the perpetual and liquidity pool are just different data storage in the same contract. Therefor, we use a tuple of liquidity pool address and index of data storage in liquidity pool to uniquely identify a perpetual.*

### AMM

Contracts of AMM is located in `contracts/module/AMMModule.sol`.

The AMM is the counterparty of the traders. One liquidity pool has one AMM.

It offers the trading price when trading and determines the funding rate. AMM also calculates how many share tokens to mint when adding liquidity and how many collateral to return when removing liquidity.

### Governor

Contracts of governance is located in `contracts/governance`.

Each liquidity pool has a unique governor to manage itself, performing administrator operations such as updating parameters, close perpetual, update perpetual and so on.

A governor is driven by a self-contained voting system. Liquidity providers is able to create proposal or cast vote on proposals. Only a succeeded proposal can be applied.



## Source Code Structure

- **broker** A relay to execute pre-signed transactions;
- **factory** Implement of `PoolCreator`;
- **governance**  Implement of `Governance`

- **interface** Interfaces of contracts, external or internal;
- **l2adapter** Special methods to serve different eth-like L2 network; (removed)
- **libraries** Library contracts;
- **module** To avoid oversize of main contract, all the logics (perpetual, liquidity pool, AMM, trade and margin account) are splitted into libraries;
- **oracle** Code of oracle used in perpetual;
- **reader** Tool to read status of liquidity pool;

- **symbolService** A service for querying id of perpetuals;
- **thirdparty** Some utilities or code from third-party, but may contains changes due to new version of solidity;

Files under **contracts** directory contains all the entrances of method. They contains no logic but calls to the real logical contracts.



## State of Perpetual

There are 5 states for the perpetual.

```
enum PerpetualState { INVALID, INITIALIZING, NORMAL, EMERGENCY, CLEARED }
```

### INVALID

This is actually not a state but a flag to indicates the existence of a perpetual.

### INITIALIZING

This state will only present during the liquidity pool is under initializing. Once the pool is created and initialized, the perpetual will turn to `NORMAL` and should never go back to `INITIALIZING`.

### NORMAL

This is the common state of a working perpetual.

Operations available in `NORMAL` state:

- deposit
  Deposit collaterals into margin account;

- withdraw
  Withdraw collaterals from margin account;

- trade / brokerTrade

  Trade positions;

- liquidateByAMM
  Liquidate unsafe positions, AMM will take liquidated positions if possible;

- liquidateByTrader
  Liquidate unsafe positions. Sender will take liquidated positions if possible;

### EMERGENCY

Once the emergency conditions are met, unrecoverable loss in trading or a proposal to close perpetual is succeeded, the perpetual will be set into `EMERGENCY` to prevent further loss.

In `EMERGENCY` state, trade can do nothing but to call `clear` method to count total margins to settle.

So the only operation can be perform during `EMERGENCY` is `clear`.

### CLEARED

When all the accounts of a perpetual `EMERGENCY` is 'cleared', the perpetual goes into `CLEARED` state.

Trader who has margin left in margin account is able to retrieve their margin balance back.

A cleared perpetual will not release the storage event after no fund in it.



## Actors

There are several actors (or roles) in MCDEX v3 system, a ethereum address may play multiple roles in the system.

### Trader

Trader who has a margin account in perpetual (expect deposit), is the main user of trading system.

A trader is able to:

- deposit
- withdraw
- trade / brokerTrade
- liquidateByTrader

### LiquidityProvider

Liquidity providers do not need to have a margin account to provide liquidity.

They take risks to act counterparty of traders, earning from trading and funding fee.

A liquidity provider is able to:

- addLiquidity
- removeLiquidity
- castVote
- propose (only when operator is absent)

### Opeartor

Operator is the 'administrator' of liquidity pool (also the perpetuals belong to the pool).

A operator is able to:

- checkIn
- updatePerpetualRiskParameter
- transferOperator
- revokeOperator

### Anyone

Anyone can donate collateral to insurance fund to make liquidity pool safer

- donateInsuranceFund
  Donate insurance fund to recovery bankrupted margin account;

