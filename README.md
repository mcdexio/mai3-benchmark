# mai3-benchmark
## notice

### necessary packages
* python3 & pip3
* docker & docker-compose
* node
* truffle
* yarn

### quick start
1. git clone git@github.com:mcdexio/mai3-benchmark.git
2. cd mai3-benchmark
3. git submodule update --init --recursive
   1. check your github's ssh connection or change Arbitrum's URL from SSH to HTTP
      1. by `vim .gitmodules`
4. `./benchmark_arbitrum.sh`
   1. or `sudo ./benchmark_arbitrum.sh`
      1. make sure your sudo environment has necessary packages

### run benchmark only (make sure Arbitrum is running)
1. `yarn benchmark` under mai3-benchmark

### what have done in quick start
1. Build geth locally
2. Deploy Arbitrum necessary smart contracts on geth
3. Build Arbitrum locally
   1. append arb-node, arb-validator docker compose command to docker-compose-arbitrum.yml
4. Setup Arbitrum
   1. remove-whitelist: for everyone can deposit from L1 to L2
   2. deposit
5. Deploy mai-protocol-v3 on Arbitrum
6. Evaluate mai-protocol-v3 benchmark
