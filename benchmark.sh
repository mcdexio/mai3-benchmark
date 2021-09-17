#!/bin/bash

GITROOT=$(git rev-parse --show-toplevel)

# download submodule
git submodule update --init --recursive

# create .env under benchmark
echo PK='0xffb2b26161e081f0cdf9db67200ee0ce25499d5ee683180a9781e6cceb791c39' > .env

# install necessary packages of arbitrum
cd $GITROOT/arbitrum
echo DEVNET_PRIVKEY='0xffb2b26161e081f0cdf9db67200ee0ce25499d5ee683180a9781e6cceb791c39' > .env
echo DEVNET_PRIVKEY='0xffb2b26161e081f0cdf9db67200ee0ce25499d5ee683180a9781e6cceb791c39' > ./packages/arb-bridge-eth/.env
yarn
yarn build

cd $GITROOT
# Build L1: equal to docker:build:geth, docker:geth
docker-compose up arb-bridge-eth-geth
while ! nc -z localhost 7545; do sleep 2; done;
echo "Finished waiting for geth on localhost:7545..."
yarn deploy:live --network local_development --export bridge_eth_addresses.json && [ -f bridge_eth_addresses.json ]
echo "Deploy Arbitrum(L2) contract to L1"

# Build L2: equal to yarn demo:initialize, demo:deploy
yarn demo:initialize
yarn demo:deploy

# Setup L2
yarn remove-whitelist