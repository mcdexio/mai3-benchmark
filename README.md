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
## build arbitrum
1. yarn demo:initialize --force=true
2. yarn demo:deploy (it will failed)
3. reference mai3-benchmark/docker-compose-testnet-template.yml to update mai3-benchmark/arbitrum/docker-compose
4. docker-compose up
