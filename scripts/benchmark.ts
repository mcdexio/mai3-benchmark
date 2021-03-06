const hre = require("hardhat");
const ethers = hre.ethers;
const assert = require("assert");

import { DeploymentOptions } from "./deployer/deployer";
import { restorableEnviron } from "./deployer/environ";
import { ensureFinished, printError } from "./deployer/utils";
import BigNumber from "bignumber.js";

const ENV: DeploymentOptions = {
  network: hre.network.name,
  artifactDirectory: "./artifacts/contracts",
  addressOverride: {},
};

function toWei(n) {
  return hre.ethers.utils.parseEther(n);
}

const COUNT = 100;
const vaultFeeRate = toWei("0.00015");
const vault = "0x81183C9C61bdf79DB7330BBcda47Be30c0a85064";
const USE_TARGET_LEVERAGE = 0x8000000;
const NONE = "0x0000000000000000000000000000000000000000";
const BATCH_SIZE = 10;
const USDC_PER_TRADER = new BigNumber("1000").shiftedBy(6);
const ETH_PER_TRADER = new BigNumber("1").shiftedBy(18);
const TRADER_LEVERAGE = new BigNumber("25").shiftedBy(18);
const POSITION_LEVERAGE = new BigNumber("25").shiftedBy(18);
let masterAcc;
let traders = [];
let mockUSDCContract;
let disperseContract;
let latestLiquidityPoolContract;
let poolGetterContract;
let oracleContract;

async function distribute(count: number, ethers) {
  let totalUSDC = USDC_PER_TRADER.times(count);
  let totalETH = ETH_PER_TRADER.times(count);
  await ensureFinished(
    mockUSDCContract.mint(masterAcc.address, totalUSDC.toFixed())
  );
  await ensureFinished(
    mockUSDCContract
      .connect(masterAcc)
      .approve(disperseContract.address, totalUSDC.toFixed())
  );
  // create traders
  for (let i = 0; i < count; i++) {
    // need to connect to provider
    const newWallet = ethers.Wallet.createRandom().connect(ethers.provider);
    console.log("trader " + i + " address " + newWallet.address);
    traders.push(newWallet);
  }
  const startTime = Date.now();
  console.log("Start distribute time: " + startTime);
  for (let i = 0; i < traders.length; i += BATCH_SIZE) {
    const batch = traders.slice(i, i + BATCH_SIZE);
    totalUSDC = USDC_PER_TRADER.times(BATCH_SIZE);
    totalETH = ETH_PER_TRADER.times(BATCH_SIZE);
    // USDC: distribute 1000 usdc to traders
    await ensureFinished(
      disperseContract.connect(masterAcc).disperseToken(
        mockUSDCContract.address,
        batch.map((x) => x.address),
        batch.map((x) => USDC_PER_TRADER.toFixed())
      )
    );
    // ETH: distribute 1 eth to traders
    await ensureFinished(
      disperseContract.connect(masterAcc).disperseEther(
        batch.map((x) => x.address),
        batch.map((x) => ETH_PER_TRADER.toFixed()),
        { value: totalETH.toFixed() }
      )
    );
  }

  const endTime = Date.now();
  console.log(
    "End distribute time " +
      endTime +
      " spend time " +
      (endTime - startTime) / 1000 +
      "s"
  );
}

async function setup(ethers, deployer, accounts) {
  console.log("start setup");
  masterAcc = accounts[0];
  // symbolService
  const symbolService = await ensureFinished(deployer.deploy("SymbolService"));
  await ensureFinished(symbolService.initialize(10000));
  console.log("Done deploy SymbolService");

  // PoolCreator
  const poolCreatorContract = await ensureFinished(deployer.deploy("PoolCreator"));
  console.log("Done deploy PoolCreator");
  await ensureFinished(
    poolCreatorContract.initialize(
      deployer.addressOf("SymbolService"),
      vault,
      vaultFeeRate
    )
  );
  const poolCreatorUpgradeAdmin = await poolCreatorContract.callStatic.upgradeAdmin();
  await ensureFinished(symbolService.addWhitelistedFactory(poolCreatorContract.address));

  // LiquidityPool
  const liquidityPool = await deployer.deploy("LiquidityPool");
  const governor = await deployer.deploy("LpGovernor");
  console.log("Done deploy liquidityPool, governor");
  await ensureFinished(
    poolCreatorContract.addVersion(
      liquidityPool.address,
      governor.address,
      0,
      "initial version"
    )
  );

  // deploy mock erc20 (align eth 18 decimal)
  mockUSDCContract = await deployer.deploy(
    "CustomERC20",
    "MockUSDC",
    "MockUSDC",
    6
  );
  console.log("Done deploy mockUSDCContract");
  await ensureFinished(
    poolCreatorContract.createLiquidityPool(
      mockUSDCContract.address,
      6,
      Math.floor(Date.now() / 1000),
      ethers.utils.defaultAbiCoder.encode(
        ["bool", "int256"],
        [false, toWei("10000000")]
      )
    )
  );

  // deploy oracle
  oracleContract = await deployer.deploy("OracleAdaptor", "USD", "ETH");
  console.log("Done deploy oracleAdaptor");
  let now = Math.floor(Date.now() / 1000);
  await ensureFinished(oracleContract.setIndexPrice(toWei("100"), now));
  await ensureFinished(oracleContract.setMarkPrice(toWei("100"), now));

  // createPerpetual
  const n = await poolCreatorContract.getLiquidityPoolCount();
  const allLiquidityPools = await poolCreatorContract.listLiquidityPools(
    0,
    n.toString()
  );
  latestLiquidityPoolContract = await deployer.getContractAt(
    "LiquidityPool",
    allLiquidityPools[allLiquidityPools.length - 1]
  );
  console.log("LiquidityPool " + latestLiquidityPoolContract.address);
  await ensureFinished(
    latestLiquidityPoolContract.createPerpetual(
      oracleContract.address,
      [
        toWei("0.04"),
        toWei("0.03"),
        toWei("0.001"),
        toWei("0.001"),
        toWei("0.2"),
        toWei("0.02"),
        toWei("0"),
        toWei("0.5"),
        toWei("5"),
      ],
      [
        toWei("0.01"),
        toWei("0.1"),
        toWei("0.06"),
        toWei("0"),
        toWei("5"),
        toWei("0.05"),
        toWei("0.01"),
        toWei("0"),
      ],
      [
        toWei("0"),
        toWei("0"),
        toWei("0"),
        toWei("0"),
        toWei("0"),
        toWei("0"),
        toWei("0"),
        toWei("0"),
      ],
      [
        toWei("0.1"),
        toWei("0.2"),
        toWei("0.2"),
        toWei("0.5"),
        toWei("10"),
        toWei("0.99"),
        toWei("1"),
        toWei("1"),
      ]
    )
  );
  await ensureFinished(latestLiquidityPoolContract.runLiquidityPool());
  console.log("Done create perpetual");
  await ensureFinished(mockUSDCContract.mint(masterAcc.address, "25000000" + "000000"));
  await ensureFinished(
    mockUSDCContract
      .connect(masterAcc)
      .approve(latestLiquidityPoolContract.address, "25000000" + "000000")
  );
  await ensureFinished(
    latestLiquidityPoolContract
      .connect(masterAcc)
      .addLiquidity(toWei("25000000"))
  );
  console.log("Done add liquidity");

  // disperse
  disperseContract = await ensureFinished(deployer.deploy("Disperse"));
  console.log("Done deploy disperseContract");
}

async function tradeBenchmark(deployer) {
  const startTime = Date.now();
  console.log("Start trader time:", startTime);
  const ops = async (x) => {
    return latestLiquidityPoolContract
      .connect(x)
      .trade(
        0,
        x.address,
        POSITION_LEVERAGE.toFixed(),
        toWei("110"),
        Math.floor(Date.now() / 1000) + 999999,
        NONE,
        USE_TARGET_LEVERAGE,
        // { gaslimit: 4e6 }
      );
  };
  const txs = await Promise.all(traders.map((trader) => ops(trader)));
  const end1Time = Date.now();

  console.log(
    `End Sent Trade time: ${end1Time},`,
    `Spend: ${(end1Time-startTime)/1000}s,`,
    `Tps: ${traders.length / (end1Time-startTime)*1000} of ${traders.length} traders.`,
  );
  const receipts = await Promise.all(txs.map((x) => x.wait()));
  const end2Time = Date.now();
  console.log(
    `End Trade time: ${end2Time},`,
    `Spend: ${(end2Time-startTime)/1000}s,`,
    `Tps: ${traders.length / (end2Time-startTime)*1000} of ${traders.length} traders.`,
  );
  for (let receipt of receipts) {
    if (receipt.status !== 1) {
      throw new Error("receipt error:" + receipt);
    }
  }

  poolGetterContract = await deployer.getContractAt(
    "Getter",
    latestLiquidityPoolContract.address
  );
  for (let trader of traders) {
    const { cash, margin, position, isMaintenanceMarginSafe } = await poolGetterContract.callStatic.getMarginAccount(0, trader.address);
    assert.equal(cash.toString(), '-2400' + '000000000000000000') // - 25*100(pos*price) + 25*100*0.04
    assert.equal(margin.toString(), '100' + '000000000000000000') // 25*100*0.04 (pos*price*leverage)
    assert.equal(isMaintenanceMarginSafe, true);
    assert.equal(
      position,
      POSITION_LEVERAGE.toFixed(),
      `trader ${trader.address}'s position ${position}`
    );
  }
}

async function preTrade() {
  let beginTime = Date.now();
  console.log("Begin preTrade");
  const txOps = async (trader) => {
    await ensureFinished(
      mockUSDCContract
        .connect(trader)
        .approve(latestLiquidityPoolContract.address, USDC_PER_TRADER.toFixed())
    );
    await ensureFinished(
      latestLiquidityPoolContract
        .connect(trader)
        .setTargetLeverage(0, trader.address, TRADER_LEVERAGE.toFixed())
    );
  };
  const txs = traders.map((x) => txOps(x));
  await Promise.all(txs);
  let endTime = Date.now();
  console.log(
    "End preTrade " +
      endTime +
      " spend time " +
      (endTime - beginTime) / 1000 +
      "s"
  );
}

async function liquidateBenchmark() {
  let now = Math.floor(Date.now() / 1000);
  // -2400 (cash) + p*25 (pos*leverage) < p*25*0.03 => 98.9690721649
  await ensureFinished(oracleContract.setIndexPrice(toWei("98.95"), now));
  await ensureFinished(oracleContract.setMarkPrice(toWei("98.95"), now));
  await ensureFinished(latestLiquidityPoolContract.connect(masterAcc).addAMMKeeper(0,  masterAcc.address))
  for (let i = 0; i < traders.length; i++) {
    await ensureFinished(latestLiquidityPoolContract.connect(masterAcc).addAMMKeeper(0,  traders[i].address))
  }
  await ensureFinished(latestLiquidityPoolContract.forceToSyncState()) // liquidityPool sync

  for (let trader of traders) {
    const {isMaintenanceMarginSafe} = await poolGetterContract.callStatic.getMarginAccount(0, trader.address);
    assert.equal(isMaintenanceMarginSafe, false); // because price is too low
  }

  const startTime = Date.now();
  console.log("Start liquidate time:", startTime);
  const waits = []
  // trader i is liquidated by i+1
  for (let i = 0; i < traders.length; i += 1) {
    if (i + 1 == traders.length) {
      waits.push(latestLiquidityPoolContract.connect(masterAcc).liquidateByAMM(0, traders[i].address))
    } else {
      waits.push(latestLiquidityPoolContract.connect(traders[i+1]).liquidateByAMM(0, traders[i].address))
    }
  }
  const txs = await Promise.all(waits)
  const end1Time = Date.now();
  console.log(
    `End Sent liquidate time: ${end1Time},`,
    `Spend: ${(end1Time-startTime)/1000}s,`,
    `Tps: ${traders.length / (end1Time-startTime)*1000} of ${traders.length} traders.`,
  );
  const receipts = await Promise.all(txs.map(x => x.wait()));
  const end2Time = Date.now();
  console.log(
    `End liquidate time: ${end2Time},`,
    `Spend: ${(end2Time-startTime)/1000}s,`,
    `Tps: ${traders.length / (end2Time-startTime)*1000} of ${traders.length} traders.`,
  )
  for (let receipt of receipts) {
    if (receipt.status !== 1) {
      throw new Error("receipt error:" + receipt);
    }
  }
  for (let trader of traders) {
    const {isMaintenanceMarginSafe} = await poolGetterContract.getMarginAccount(0, trader.address);
    assert.equal(isMaintenanceMarginSafe, true); // didn't bankrupt
  }
}

async function main(ethers, deployer, accounts) {
  await setup(ethers, deployer, accounts);
  await distribute(COUNT, ethers);
  await preTrade();
  await tradeBenchmark(deployer);
  await liquidateBenchmark()
}

ethers
  .getSigners()
  .then((accounts) => restorableEnviron(ethers, ENV, main, accounts))
  .then(() => process.exit(0))
  .catch((error) => {
    printError(error);
    process.exit(1);
  });
