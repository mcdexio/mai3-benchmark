const hre = require("hardhat")
const ethers = hre.ethers

import { DeploymentOptions } from './deployer/deployer'
import {readOnlyEnviron, restorableEnviron} from "./deployer/environ";
import {ensureFinished, printError} from "./deployer/utils";

const ENV: DeploymentOptions = {
  network: hre.network.name,
  artifactDirectory: './artifacts/contracts',
  addressOverride: {},
}

function toWei(n) { return hre.ethers.utils.parseEther(n) }

const vaultFeeRate = toWei("0");
const vault = "0x81183C9C61bdf79DB7330BBcda47Be30c0a85064"
const USE_TARGET_LEVERAGE = 0x8000000;
const NONE = "0x0000000000000000000000000000000000000000";
let masterAcc;
let traders = [];
let mockUSDCContract;
let disperseContract;
let latestLiquidityPoolContract;
let traderModuleContract;
let readerContract;

async function distribute(count: number, ethers) {
  const startTime = Date.now()
  console.log("start distribute " +startTime)
  const values = []
  for (let i = 0; i < count; i++) {
    // need to connect to provider
    const newWallet = ethers.Wallet.createRandom().connect(ethers.provider)
    traders.push(newWallet)
    values.push(1)
  }
  // ETH: distribute 1 eth to count of accounts
  await disperseContract.connect(masterAcc).disperseEther(
    traders.map(X => X.address),
    traders.map(X => toWei("1")),
    {value: toWei("10")}
  )
  await disperseContract.connect(masterAcc).disperseToken(
    mockUSDCContract.address,
    traders.map(X => X.address),
    traders.map(X => 100000000)
  )
  const endTime = Date.now()
  console.log("Done distribute end " + endTime + " spend time " + (endTime-startTime)/1000)
  const tx = async (trader) => {
    await mockUSDCContract.connect(trader).approve(latestLiquidityPoolContract.address, "100" + "000000")
    await latestLiquidityPoolContract.connect(trader).setTargetLeverage(0, trader.address, toWei("25"))
  }
  const txs = traders.map(x => tx(x))
  await Promise.all(txs)
}

async function setup(ethers, deployer, accounts) {
  console.log("start setup")
  masterAcc = accounts[0]
  // symbolService
  await deployer.deploy("SymbolService")
  const symbolService = await deployer.getDeployedContract("SymbolService")
  await ensureFinished(symbolService.initialize(10000))
  console.log("Done deploy SymbolService")

  // PoolCreator
  await deployer.deploy("PoolCreator")
  const poolCreator = await deployer.getDeployedContract("PoolCreator")
  console.log("Done deploy PoolCreator")
  await ensureFinished(poolCreator.initialize(
    deployer.addressOf("SymbolService"),
    vault,
    vaultFeeRate
  ))
  await ensureFinished(symbolService.addWhitelistedFactory(poolCreator.address))

  // LiquidityPool
  const liquidityPool = await deployer.deploy("LiquidityPool")
  const governor = await deployer.deploy("LpGovernor")
  console.log("Done deploy liquidityPool, governor")
  await ensureFinished(poolCreator.addVersion(liquidityPool.address, governor.address, 0, "initial version"))

  // deploy mock erc20
  mockUSDCContract = await deployer.deploy("CustomERC20", "MockUSDC", "MockUSDC", 6)
  console.log("Done deploy mockUSDCContract")
  await ensureFinished(poolCreator.createLiquidityPool(
    mockUSDCContract.address,
    6,
    Math.floor(Date.now() / 1000),
    ethers.utils.defaultAbiCoder.encode(["bool", "int256"], [false, toWei("10000000")])
  ))

  // deploy oracle
  const oracle = await deployer.deploy("OracleAdaptor", "USD", "ETH")
  console.log("Done deploy oracleAdaptor")
  let now = Math.floor(Date.now() / 1000);
  await ensureFinished(oracle.setIndexPrice(toWei("100"), now))
  await ensureFinished(oracle.setMarkPrice(toWei("100"), now))

  // createPerpetual
  const n = await poolCreator.getLiquidityPoolCount();
  const allLiquidityPools = await poolCreator.listLiquidityPools(0, n.toString());
  latestLiquidityPoolContract = await deployer.getContractAt("LiquidityPool", allLiquidityPools[allLiquidityPools.length - 1]);
  await ensureFinished(latestLiquidityPoolContract.createPerpetual(
    oracle.address,
    // imr          mmr            operatorfr        lpfr              rebate        penalty        keeper       insur         oi
    [toWei("0.04"), toWei("0.03"), toWei("0.00010"), toWei("0.00055"), toWei("0.2"), toWei("0.01"), toWei("10"), toWei("0.5"), toWei("3")],
    // alpha           beta1            beta2             frLimit        lev         maxClose       frFactor        defaultLev
    [toWei("0.00075"), toWei("0.0075"), toWei("0.00525"), toWei("0.01"), toWei("1"), toWei("0.05"), toWei("0.005"), toWei("10")],
    [toWei("0"),       toWei("0"),      toWei("0"),       toWei("0"),    toWei("0"), toWei("0"),    toWei("0"),     toWei("0")],
    [toWei("0.1"),     toWei("0.5"),    toWei("0.5"),     toWei("0.1"),  toWei("5"), toWei("1"),    toWei("0.1"),   toWei("10000000")]
  ))
  await ensureFinished(latestLiquidityPoolContract.runLiquidityPool())
  console.log("Done create perpetual")
  await ensureFinished(mockUSDCContract.mint(masterAcc.address, "10000" + "000000"))
  await ensureFinished(mockUSDCContract.connect(masterAcc).approve(latestLiquidityPoolContract.address, "10000" + "000000"))

  // disperse (
  await deployer.deploy("Disperse")
  disperseContract = await deployer.getDeployedContract("Disperse")
  await ensureFinished(mockUSDCContract.connect(masterAcc).approve(disperseContract.address, "10000" + "000000"))
  console.log("Done deploy disperseContract")
  await distribute(10,ethers)

  await ensureFinished(latestLiquidityPoolContract.connect(masterAcc).addLiquidity("1000"+"000000"))
  console.log("Done add liquidity")
}

async function benchmark() {
  const startTime = Date.now()
  console.log("start trader " + startTime)
  const tradeFunc = async (trader) => {
    latestLiquidityPoolContract.connect(trader).trade(0, trader.address, toWei("1"), toWei("100"), NONE, USE_TARGET_LEVERAGE);
  }
  const txs = traders.map(x => tradeFunc(x))
  await Promise.all(txs)
  const endTime = Date.now()
  console.log("Done trade end " + endTime + " spend time " + (endTime-startTime)/1000)
}

async function main(ethers, deployer, accounts) {
  await setup(ethers, deployer, accounts)
  await benchmark(deployer)
}

ethers.getSigners()
  .then(accounts => restorableEnviron(ethers, ENV, main, accounts))
  .then(() => process.exit(0))
  .catch(error => {
    printError(error);
    process.exit(1);
  });
