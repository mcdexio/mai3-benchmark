# mai3-benchmark

1. git clone git@github.com:mcdexio/mai3-benchmark.git
2. cd mai3-benchmark
3. git submodule update --init --recursive

# arbitrum
1. cd arbitrum
2. yarn
3. yarn build
## build geth
1. yarn docker:build:geth
2. yarn docker:geth
   1. will create bridge_eth_addresses.json under arbitrum/packages/arb-bridge-eth
## build arbitrum
1. yarn demo:initialize [--force=true]
   1. will depend on arbitrum/packages/arb-bridge-eth/bridge_eth_address.json
2. yarn demo:deploy
## Remove whitelist
1. yarn remove-whitelist
   1. rollupOwn call rollup admin（rollupAddress)'s updateWhitelistConsumers
      1. "whitelist's address" # get address from inbox
      2. 0x0000000000000000000000000000000000000000
      3. ["inboxAddress"]
## Deposit
1. npx hardhat --network local_development deposit inbox_address private_key dest_address amount(wei)
