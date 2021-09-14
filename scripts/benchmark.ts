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

const vaultFeeRate = toWei("0.001");
const vault = "0x81183C9C61bdf79DB7330BBcda47Be30c0a85064"
const USE_TARGET_LEVERAGE = 0x8000000;
const NONE = "0x0000000000000000000000000000000000000000";
let masterAcc;
let traders = [];
let mockUSDCContract;
let disperseContract;
let latestLiquidityPoolContract;
let poolCreatorContract;

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
  // ETH: distribute 1 eth to traders
  await disperseContract.connect(masterAcc).disperseEther(
    traders.map(X => X.address),
    traders.map(X => toWei("1")), // 1 eth
    {value: toWei(count.toString())}
  )
  // USDC: distribute 100 usdc to traders
  await disperseContract.connect(masterAcc).disperseToken(
    mockUSDCContract.address,
    traders.map(X => X.address),
    traders.map(X => toWei("10000"))
  )
  const endTime = Date.now()
  console.log("Done distribute end " + endTime + " spend time " + (endTime-startTime)/1000)
  const tx = async (trader) => {
    await mockUSDCContract.connect(trader).approve(latestLiquidityPoolContract.address, toWei("100000"))
    await latestLiquidityPoolContract.connect(trader).setTargetLeverage(0, trader.address, toWei("10"))
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
  poolCreatorContract = await deployer.getDeployedContract("PoolCreator")
  console.log("Done deploy PoolCreator")
  await ensureFinished(poolCreatorContract.initialize(
    deployer.addressOf("SymbolService"),
    vault,
    vaultFeeRate
  ))
  await ensureFinished(symbolService.addWhitelistedFactory(poolCreatorContract.address))

  // LiquidityPool
  const liquidityPool = await deployer.deploy("LiquidityPool")
  const governor = await deployer.deploy("LpGovernor")
  console.log("Done deploy liquidityPool, governor")
  await ensureFinished(poolCreatorContract.addVersion(liquidityPool.address, governor.address, 0, "initial version"))

  // deploy mock erc20
  mockUSDCContract = await deployer.deploy("CustomERC20", "MockUSDC", "MockUSDC", 18)
  console.log("Done deploy mockUSDCContract")
  await ensureFinished(poolCreatorContract.createLiquidityPool(
    mockUSDCContract.address,
    18,
    Math.floor(Date.now() / 1000),
    ethers.utils.defaultAbiCoder.encode(["bool", "int256"], [false, toWei("1000000")])
  ))

  // deploy oracle
  const oracle = await deployer.deploy("OracleAdaptor", "USD", "ETH")
  console.log("Done deploy oracleAdaptor")
  let now = Math.floor(Date.now() / 1000);
  await ensureFinished(oracle.setIndexPrice(toWei("500"), now))
  await ensureFinished(oracle.setMarkPrice(toWei("500"), now))

  // createPerpetual
  const n = await poolCreatorContract.getLiquidityPoolCount();
  const allLiquidityPools = await poolCreatorContract.listLiquidityPools(0, n.toString());
  latestLiquidityPoolContract = await deployer.getContractAt("LiquidityPool", allLiquidityPools[allLiquidityPools.length - 1]);
  console.log("LiquidityPool " + latestLiquidityPoolContract.address)
  await ensureFinished(latestLiquidityPoolContract.createPerpetual(
    oracle.address,
    [toWei("0.1"), toWei("0.05"), toWei("0.001"), toWei("0.001"), toWei("0.2"), toWei("0.02"), toWei("0"), toWei("0.5"), toWei("5")],
    [toWei("0.01"), toWei("0.1"), toWei("0.06"), toWei("0"), toWei("5"), toWei("0.05"), toWei("0.01"), toWei("0")],
    [toWei("0"), toWei("0"), toWei("0"), toWei("0"), toWei("0"), toWei("0"), toWei("0"), toWei("0")],
    [toWei("0.1"), toWei("0.2"), toWei("0.2"), toWei("0.5"), toWei("10"), toWei("0.99"), toWei("1"), toWei("1")]
  ))
  await ensureFinished(latestLiquidityPoolContract.runLiquidityPool())
  console.log("Done create perpetual")
  await ensureFinished(mockUSDCContract.mint(masterAcc.address, toWei("10000000")))
  await ensureFinished(mockUSDCContract.connect(masterAcc).approve(latestLiquidityPoolContract.address, toWei("10000000")))

  // disperse (
  await deployer.deploy("Disperse")
  disperseContract = await deployer.getDeployedContract("Disperse")
  await ensureFinished(mockUSDCContract.connect(masterAcc).approve(disperseContract.address, toWei("10000000")))
  console.log("Done deploy disperseContract")
  await distribute(1,ethers)

  await ensureFinished(latestLiquidityPoolContract.connect(masterAcc).addLiquidity("1000"))
  console.log("Done add liquidity")
}

async function benchmark(deployer) {
  console.log("trader0 add " + traders[0].address)
  // await deployer.deploy("Reader", poolCreatorContract.address)
  // const reader = await deployer.getDeployedContract("Reader")
  // const info = await reader.callStatic.getMarginAccount(0, traders[0].address)
  // console.log(info)
  const startTime = Date.now()
  console.log("start trader " + startTime)
  // const txs = traders.map(x => latestLiquidityPoolContract.connect(x).deposit(0, x.address, toWei("600")))
  // await Promise.all(txs)
  let now = Math.floor(Date.now() / 1000);
  const txs1 = traders.map(x => latestLiquidityPoolContract.connect(x).trade(0, x.address, 1, toWei("600"), now + 999999, NONE, USE_TARGET_LEVERAGE))
  await Promise.all(txs1)
  const end1Time = Date.now()
  console.log("Done trade end1 " + end1Time + " spend time " + (end1Time-startTime)/1000)
  const end2Time = Date.now()
  console.log("Done trade end2 " + end2Time + " spend time " + (end2Time-startTime)/1000)
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
