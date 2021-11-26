import {restorableEnviron} from "./deployer/environ";
import {ensureFinished, printError, sleep} from "./deployer/utils";
import {DeploymentOptions} from "./deployer/deployer";
import BigNumber from "bignumber.js";
const fs = require("fs");
const hre = require("hardhat");
const hreEthers = hre.ethers;
const NONE = "0x0000000000000000000000000000000000000000";
import {ethers as ethersJS} from "ethers";

const gasPriceABI = [{"inputs":[],"name":"getPricesInWei","outputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}]

const ENV: DeploymentOptions = {
  network: hre.network.name,
  artifactDirectory: "./artifacts/contracts",
  addressOverride: {},
};

function write(text) {
  fs.writeFileSync("document.txt",
    text,
    {
      encoding: "utf8",
      flag: "a+",
      mode: 0o666
    });
}

function toWei(n) {
  return hre.ethers.utils.parseEther(n);
}

const USDC_PER_TRADER = new BigNumber("1000").shiftedBy(6);
const ETH_PER_TRADER = new BigNumber("0.1").shiftedBy(18);

const COUNT = 2;
let traders = [];
const BATCH_SIZE = 10;
let disperseContract;
let liquidityPoolContract;
let USDCContract;
let masterAcc;
let gasPriceReader;
const USDCAddress = "0x09b98f8b2395d076514037ff7d39a091a536206c"

async function setup(ethers, deployer, accounts) {
  console.log("start setup");
  masterAcc = accounts[0];

  gasPriceReader = new ethersJS.Contract('0x000000000000000000000000000000000000006C', gasPriceABI, ethers.provider)

  USDCContract = await deployer.getContractAt("CustomERC20", USDCAddress);

  liquidityPoolContract = await deployer.getContractAt(
    "LiquidityPool", "0xc32a2dfee97e2babc90a2b5e6aef41e789ef2e13"
  );
  disperseContract = await ensureFinished(deployer.deploy("Disperse"));
  console.log("Done deploy disperseContract");
}

async function distribute(count: number, ethers) {
  let totalUSDC = USDC_PER_TRADER.times(count);
  let totalETH = ETH_PER_TRADER.times(count);
  await ensureFinished(
    USDCContract
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
        USDCContract.address,
        batch.map((x) => x.address),
        batch.map((x) => USDC_PER_TRADER.toFixed())
      )
    );
    console.log("disperse usdc")
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

async function preTrade() {
  let beginTime = Date.now();
  console.log("Begin preTrade");
  const txOps = async (trader) => {
    await ensureFinished(
      USDCContract
        .connect(trader)
        .approve(liquidityPoolContract.address, USDC_PER_TRADER.toFixed())
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

async function tradeBenchmark() {
  const startTime = Date.now();
  const pos = Math.random() * 0.2 - 0.1
  const posBig = new BigNumber(pos).shiftedBy(18);

  const ops = async (x) => {
    const [ perL2Tx, perL1CalldataUnit, perStorageCell, perArbGasBase, perArbGasCongestion, perArbGasTotal ] = await gasPriceReader.callStatic.getPricesInWei()
    const gasPrice = await hreEthers.provider.getGasPrice() // { BigNumber: "69697580701" }
    let text = `gasPrice ${gasPrice}` + ` perArbGasTotal ${perArbGasTotal}` + ` perArbGasCongestion ${perArbGasCongestion}\n`
    write(text)
    return liquidityPoolContract
      .connect(x)
      .trade(
        0,
        x.address,
        posBig.toFixed(),
        toWei("5000"),
        Math.floor(Date.now() / 1000) + 999999,
        NONE,
        0x40000000+12800,
      );
  };
  const txs = await Promise.all(traders.map((trader) => ops(trader)));
  const end1Time = Date.now();

  let text =
    `End Sent Trade time: ${end1Time}, ` +
    `Spend: ${(end1Time-startTime)/1000}s, ` +
    `Tps: ${traders.length / (end1Time-startTime)*1000} of ${traders.length} traders.\n`;
  write(text)

  const receipts = await Promise.all(txs.map((x) => x.wait()));
  const end2Time = Date.now();
  text =
    `End Trade time: ${end2Time}, ` +
    `Spend: ${(end2Time-startTime)/1000}s, ` +
    `Tps: ${traders.length / (end2Time-startTime)*1000} of ${traders.length} traders.\n`;
  write(text)
  for (let receipt of receipts) {
    if (receipt.status !== 1) {
      throw new Error("receipt error:" + receipt);
    }
    let text = `receipt from: ${receipt.from}` + ` tx hash: ${receipt.transactionHash}` + ` block hash: ${receipt.blockHash}\n`
    write(text)
  }
}

async function main(ethers, deployer, accounts) {
  console.log("stress testing")
  await setup(ethers, deployer, accounts);
  await distribute(COUNT, ethers);
  await preTrade();
  let dateTime = new Date().getSeconds()
  while (dateTime < dateTime + 300) {
    await tradeBenchmark()
  }
}

hreEthers
  .getSigners()
  .then((accounts) => restorableEnviron(hreEthers, ENV, main, accounts))
  .then(() => process.exit(0))
  .catch((error) => {
    printError(error);
    process.exit(1);
  });
