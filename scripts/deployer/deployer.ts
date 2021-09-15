import * as fs from "fs";
const chalk = require("chalk");

import { retrieveLinkReferences } from "./linkReferenceParser";

export interface DeploymentOptions {
  network: string;
  artifactDirectory: string;
  addressOverride: { [key: string]: string };
}

export interface DeploymentRecord {
  type: string;
  name: string;
  address: string;
  dependencies: {};
}

export class Deployer {
  public SAVE_PREFIX = "./deployments/";
  public SAVE_POSTFIX = ".deployment.js";

  public ethers: any;
  public options: DeploymentOptions;
  public linkReferences = {};
  public deployedContracts = {};
  public signer = null;

  public beforeDeployed = null;
  public afterDeployed = null;

  constructor(ethers, options: DeploymentOptions) {
    this.ethers = ethers;
    this.options = options;
  }

  public async initialize(...args) {
    this.linkReferences = await retrieveLinkReferences(this.options.artifactDirectory);
    this.load();
    for (var contractName in this.options.addressOverride) {
      this.deployedContracts[contractName] = {
        type: "preset",
        name: contractName,
        address: this.options.addressOverride[contractName],
      };
    }
  }

  public async finalize(...args) {
    this.save();
  }

  public async load() {
    try {
      const savedProgress = JSON.parse(fs.readFileSync(this.SAVE_PREFIX + this.options.network + this.SAVE_POSTFIX, "utf-8"));
      this.deployedContracts = savedProgress;
    } catch (err) {
      this._log("[DEPLOYER] save not found");
    }
  }

  public async save() {
    fs.writeFileSync(this.SAVE_PREFIX + this.options.network + this.SAVE_POSTFIX, JSON.stringify(this.deployedContracts, null, 2));
  }

  public async deploy(contractName: string, ...args): Promise<any> {
    const { deployed, receipt } = await this._deploy(contractName, ...args);
    this.deployedContracts[contractName] = {
      type: "plain",
      name: contractName,
      address: deployed.address,
      deployedAt: receipt.blockNumber,
    };
    this._logDeployment(contractName, deployed);
    return deployed;
  }

  public async deployAs(contractName: string, aliasName: string, ...args): Promise<any> {
    const { deployed, receipt } = await this._deploy(contractName, ...args);
    this.deployedContracts[aliasName] = {
      type: "plain",
      name: aliasName,
      address: deployed.address,
      deployedAt: receipt.blockNumber,
    };
    this._logDeployment(aliasName, deployed);
    return deployed;
  }

  public async deployWith(signer: any, contractName: string, ...args): Promise<any> {
    const { deployed, receipt } = await this._deployWith(signer, contractName, ...args);
    this.deployedContracts[contractName] = {
      type: "plain",
      name: contractName,
      address: deployed.address,
      deployedAt: receipt.blockNumber,
    };
    this._logDeployment(contractName, deployed);
    return deployed;
  }

  public async deployWithAs(signer: any, contractName: string, aliasName: string, ...args): Promise<any> {
    const { deployed, receipt } = await this._deployWith(signer, contractName, ...args);
    this.deployedContracts[aliasName] = {
      type: "plain",
      name: aliasName,
      address: deployed.address,
      deployedAt: receipt.blockNumber,
    };
    this._logDeployment(aliasName, deployed);
    return deployed;
  }

  public async deployOrSkip(contractName: string, ...args): Promise<any> {
    if (contractName in this.deployedContracts) {
      return this.getDeployedContract(contractName);
    }
    return await this.deploy(contractName, ...args);
  }

  public async deployAsUpgradeable(contractName: string, admin: string): Promise<any> {
    let implementation;
    {
      const { deployed } = await this._deploy(contractName);
      implementation = deployed;
    }
    const { deployed, receipt } = await this._deploy("TransparentUpgradeableProxy", implementation.address, admin, "0x");
    this.deployedContracts[contractName] = {
      type: "upgradeable",
      name: contractName,
      address: deployed.address,
      dependencies: { admin, implementation: implementation.address },
      deployedAt: receipt.blockNumber,
    };
    this._logDeployment(contractName, deployed, `(implementation[${implementation.address}] admin[${admin}]`);
    return deployed;
  }

  public async getDeployedContract(contractName: string): Promise<any> {
    if (!(contractName in this.deployedContracts)) {
      throw `${contractName} has not yet been deployed`;
    }
    return this.getContractAt(contractName, this.deployedContracts[contractName].address);
  }

  public async getContractAt(contractName: string, address: string): Promise<any> {
    const factory = await this._getFactory(contractName);
    const deployed = await factory.attach(address)
    this._logDeployment(contractName, deployed)
    if (contractName in this.deployedContracts) {
      const name = `${contractName}_${address}`
      this.deployedContracts[name] = {
        type: "plain",
        name: contractName,
        address: deployed.address,
      };
    } else {
      // not in deployedContract, just save
      this.deployedContracts[contractName] = {
        type: "plain",
        name: contractName,
        address: deployed.address,
      };
    }
    return deployed;
  }

  public async getFactory(contractName: string): Promise<any> {
    return await this._getFactory(contractName);
  }

  public addressOf(contractName: string) {
    return this.deployedContracts[contractName].address;
  }

  public async getImplementation(address: string) {
    const storagePosition = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
    return await this.ethers.provider.getStorageAt(address, storagePosition);
  }

  public async getBeacon(address: string) {
    const storagePosition = "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50";
    return await this.ethers.provider.getStorageAt(address, storagePosition);
  }

  public async getAdminOfUpgradableContract(address: string) {
    const storagePosition = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
    return await this.ethers.provider.getStorageAt(address, storagePosition);
  }

  private async _deploy(contractName: string, ...args): Promise<any> {
    return this._deployWith(null, contractName, ...args);
  }

  private async _deployWith(signer, contractName: string, ...args): Promise<any> {
    const factory = await this._getFactory(contractName);
    if (this.beforeDeployed != null) {
      await this.beforeDeployed(contractName, factory, ...args);
    }
    let deployed;
    if (signer == null) {
      deployed = await factory.deploy(...args);
    } else {
      deployed = await factory.connect(signer).deploy(...args);
    }
    const receipt = await deployed.deployTransaction.wait();
    if (this.afterDeployed != null) {
      await this.afterDeployed(contractName, deployed, ...args);
    }
    return { deployed, receipt };
  }

  private async _getFactory(contractName: string): Promise<any> {
    let links = {};
    if (contractName in this.linkReferences) {
      for (let i = 0, j = this.linkReferences[contractName].length; i < j; i++) {
        const linkedContractName = this.linkReferences[contractName][i];
        if (linkedContractName in this.deployedContracts) {
          links[linkedContractName] = this.deployedContracts[linkedContractName].address;
        } else {
          const deployed = await this.deploy(linkedContractName);
          links[linkedContractName] = deployed.address;
        }
      }
    }
    return await this.ethers.getContractFactory(contractName, { libraries: links });
  }

  private _log(...message) {
    console.log(chalk.underline.bgBlue("Deployer =>"), ...message);
  }

  private _logDeployment(contractName, deployed, message = null) {
    this._log(`${contractName} has been deployed to ${deployed.address} ${message == null ? "" : message}`);
  }
}
