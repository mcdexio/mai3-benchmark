# mai3-benchmark

1. git clone git@github.com:mcdexio/mai3-benchmark.git
2. git checkout dep
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
1. yarn demo:initialize --force=true
   1. will depend on arbitrum/packages/arb-bridge-eth/bridge_eth_address.json
2. yarn demo:deploy (it will failed)
   1. TODO(champFu): update docker-compose
3. reference mai3-benchmark/docker-compose-testnet-template.yml to update mai3-benchmark/arbitrum/docker-compose
4. docker-compose up
5. rollupOwn call rollup admin（rollupAddress)'s updateWhitelistConsumers
   1. "whitelist's address"
   2. 0x0000000000000000000000000000000000000000
   3. ["inboxAddress"]
6. call depositEth (inboxAddress)
