# mai3-benchmark
## Notice
### necessary packages
* python3 & pip3
* docker & docker-compose
* node
* truffle
* yarn
### github repository issue
* check your github's ssh connection or change Arbitrum's url from SSH to HTTP
  * by `vim .gitmodules`
## easy to start
1. `git checkout dev` <br>
2. `./benchmark_arbitrum.sh` <br>
   1. `sudo ./benchmark_arbitrum.sh (make sure your sudo environment has necessary packages)`

# Archive
<span style="color:gray">
### mai3-benchmark <br>
1. git clone git@github.com:mcdexio/mai3-benchmark.git <br>
2. cd mai3-benchmark <br>
3. git checkout dev <br>
4. git submodule update --init --recursive <br>
### Arbitrum <br>
1. cd arbitrum <br>
2. yarn <br>
3. yarn build <br>
### build geth <br>
1. add private key (.env) to arbitrum/packages/arb-bridge-eth <br>
2. yarn docker:build:geth <br>
3. yarn docker:geth <br>
&nbsp&nbsp&nbsp&nbsp   1.  will create bridge_eth_addresses.json under arbitrum/packages/arb-bridge-eth <br>
### build arbitrum <br>
1. yarn demo:initialize [--force=true] <br>
&nbsp&nbsp&nbsp&nbsp   1. will depend on arbitrum/packages/arb-bridge-eth/bridge_eth_address.json <br>
2. yarn demo:deploy <br>
&nbsp&nbsp&nbsp&nbsp   1. if fail, `sudo chown -R 1000:1000 rollups/` <br>
### remove whitelist <br>
1. yarn remove-whitelist <br>
&nbsp&nbsp&nbsp&nbsp   1. rollupOwn call rollup admin（rollupAddress)'s updateWhitelistConsumers <br>
&nbsp&nbsp&nbsp&nbsp &nbsp&nbsp&nbsp&nbsp     1. "whitelist's address" # get address from inbox <br>
&nbsp&nbsp&nbsp&nbsp &nbsp&nbsp&nbsp&nbsp     2. 0x0000000000000000000000000000000000000000 <br>
&nbsp&nbsp&nbsp&nbsp &nbsp&nbsp&nbsp&nbsp     3. ["inboxAddress"] <br>
### deposit <br>
1. yarn deposit inbox_address private_key dest_address amount(wei) <br>
&nbsp&nbsp&nbsp&nbsp   1. npx hardhat --network local_development deposit inbox_address private_key dest_address amount(wei) <br>
### deploy mai-protocol-v3 and test benchmark <br>
1. cd mai3-benchmark <br>
2. yarn <br>
3. yarn benchmark <br>
</span>