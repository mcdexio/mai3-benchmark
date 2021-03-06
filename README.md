# mai3-benchmark

## Necessary packages
* python3 & pip3
* docker & docker-compose
* node
* yarn

## Quick start
1. git clone git@github.com:mcdexio/mai3-benchmark.git
2. cd mai3-benchmark
3. git submodule update --init --recursive
   1. github connection (two ways to solve)
      1. check your github's ssh connection
      2. change Arbitrum's URL from SSH to HTTP
         1. by `vim .gitmodules` from `git@github.com:champfu-mcdex/arbitrum.git` to `https://github.com/champfu-mcdex/arbitrum.git`
4. `./benchmark_arbitrum.sh`
   1. or `sudo ./benchmark_arbitrum.sh`
      1. make sure your sudo environment has necessary packages

## Run benchmark only (make sure Arbitrum is running)
1. `yarn arbitrum:benchmark` under mai3-benchmark

## What have done in quick start
1. Build geth locally
2. Deploy Arbitrum necessary smart contracts on geth
3. Build Arbitrum locally
   1. append arb-node, arb-validator docker compose command to docker-compose-arbitrum.yml
4. Setup Arbitrum
   1. remove-whitelist: for everyone can deposit from L1 to L2
   2. deposit
5. Deploy mai-protocol-v3 on Arbitrum
6. Evaluate mai-protocol-v3 benchmark
