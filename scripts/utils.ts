const { ethers } = require("hardhat");

var defaultSigner = null

export function toWei(n) { return ethers.utils.parseEther(n) };

export async function createFactory(path, libraries = {}) {
  const parsed = {}
  for (var name in libraries) {
    parsed[name] = libraries[name].address;
  }
  return await ethers.getContractFactory(path, { libraries: parsed })
}

export async function createContract(path, args = [], libraries = {}) {
  const factory = await createFactory(path, libraries);
  if (defaultSigner != null) {
    return await factory.connect(defaultSigner).deploy(...args)
  } else {
    return await factory.deploy(...args);
  }
}