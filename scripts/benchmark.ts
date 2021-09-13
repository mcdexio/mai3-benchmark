const hre = require("hardhat")
const ethers = hre.ethers

import { DeploymentOptions } from './deployer/deployer'
import {restorableEnviron} from "./deployer/environ";
import {ensureFinished, printError} from "./deployer/utils";

const ENV: DeploymentOptions = {
  network: hre.network.name,
  artifactDirectory: './artifacts/contracts',
  addressOverride: {},
}

async function main(ethers, deployer, accounts) {

}

ethers.getSigners()
  .then(accounts => restorableEnviron(ethers, ENV, main, accounts))
  .then(() => process.exit(0))
  .catch(error => {
    printError(error);
    process.exit(1);
  });