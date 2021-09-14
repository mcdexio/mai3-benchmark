import {expect} from "chai";

const hre = require("hardhat")
const ethers = hre.ethers

import { DeploymentOptions } from './deployer/deployer'
import {readOnlyEnviron } from "./deployer/environ";
import {printError} from "./deployer/utils";
import {
  toWei,
  createContract
} from "./utils"

const USE_TARGET_LEVERAGE = 0x8000000;
const NONE = "0x0000000000000000000000000000000000000000";

const ENV: DeploymentOptions = {
  network: hre.network.name,
  artifactDirectory: './artifacts/contracts',
  addressOverride: {},
}

async function distribute(count: number, ethers, master) {
  // distribute 1 eth to 1000 accounts
  const wallets = []
  const waits = []
  for (let i = 0; i < count; i++) {
    // need to connect to provider
    const newWallet = ethers.Wallet.createRandom().connect(ethers.provider)
    const tx = {
      to: newWallet.address,
      value: ethers.utils.parseEther('1'),
    }
    const send = await master.sendTransaction(tx)
    wallets.push(newWallet)
    waits.push(send.wait())
  }
  await Promise.all(waits)
  console.log("Done distribute")
  return wallets
}

async function main(ethers, deployer, accounts) {
  const vault = "0x81183C9C61bdf79DB7330BBcda47Be30c0a85064"
  const masterAddress = await accounts[0].address
  // distribute ETH to others
  const wallets = await distribute(10, ethers, accounts[0])

  // deploy contract & setup
  const ctk = await createContract("CustomERC20", ["collateral", "CTK", 18]);
  const oracle = await createContract("OracleAdaptor", ["ctk", "ctk"]);
  let now = Math.floor(Date.now() / 1000);
  await oracle.setMarkPrice(toWei("100"), now);
  await oracle.setIndexPrice(toWei("100"), now);
  const AMMModule = await createContract("AMMModule");
  const CollateralModule = await createContract("CollateralModule")
  const PerpetualModule = await createContract("PerpetualModule");
  const OrderModule = await createContract("OrderModule");
  const LiquidityPoolModule = await createContract("LiquidityPoolModule", [], { CollateralModule, AMMModule, PerpetualModule });
  const MockAMMModule = await createContract("MockAMMModule");
  const TradeModule = await createContract("TradeModule", [], { AMMModule: MockAMMModule, LiquidityPoolModule });
  const testTrade = await createContract("TestTrade", [], {
    PerpetualModule,
    CollateralModule,
    LiquidityPoolModule,
    OrderModule,
    TradeModule,
  });
  await testTrade.createPerpetual(
    oracle.address,
    // imr         mmr            operatorfr       lpfr             rebate      penalty         keeper      insur       oi
    [toWei("0.1"), toWei("0.05"), toWei("0.0001"), toWei("0.0007"), toWei("0"), toWei("0.005"), toWei("1"), toWei("0"), toWei("1")],
    [toWei("0.01"), toWei("0.1"), toWei("0.06"), toWei("0"), toWei("5"), toWei("0.2"), toWei("0.01"), toWei("1")],
  )
  await testTrade.setOperator(masterAddress)
  await testTrade.setVault(vault, toWei("0.0002"))
  await testTrade.setCollateralToken(ctk.address, 18);
  await ctk.mint(testTrade.address, toWei("10000000000"));
  const mocker = await createContract("MockAMMPriceEntries");
  await testTrade.setGovernor(mocker.address);
  await testTrade.setState(0, 2); // set PerpetualState to normal

  // post leverage
  await testTrade.updatePrice(now);
  await mocker.setPrice(toWei("100"));
  await ctk.connect(wallets[0]).approve(testTrade.address, toWei("10"))
  const wallet0Address = await wallets[0].address
  await ctk.mint(wallet0Address, toWei("4"));
  await testTrade.setTotalCollateral(0, toWei("1000"));
  // 25x leverage
  await testTrade.setTargetLeverage(0, wallet0Address, toWei("25"));
  await testTrade.setMarginAccount(0, testTrade.address, toWei("10000"), toWei("0"));
  var { cash, position } = await testTrade.getMarginAccount(0, wallet0Address);

  // await testTrade.connect(wallets[0]).trade(0, wallet0Address, toWei("25"), toWei("100"), NONE, USE_TARGET_LEVERAGE);
  // var { cash, position } = await testTrade.getMarginAccount(0, wallet0Address)
  // console.log(cash.toString())
  // console.log(position.toString())

  // Synchronize func to triage liquidateByAmm
}

ethers.getSigners()
  .then(accounts => readOnlyEnviron(ethers, ENV, main, accounts))
  .then(() => process.exit(0))
  .catch(error => {
    printError(error);
    process.exit(1);
  });