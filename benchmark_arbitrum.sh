#!/bin/bash

GITROOT=$(git rev-parse --show-toplevel)

# create .env under benchmark
echo PK='0xffb2b26161e081f0cdf9db67200ee0ce25499d5ee683180a9781e6cceb791c39' > .env

# install necessary packages of arbitrum
cd $GITROOT/arbitrum
echo DEVNET_PRIVKEY='0xffb2b26161e081f0cdf9db67200ee0ce25499d5ee683180a9781e6cceb791c39' > .env
echo DEVNET_PRIVKEY='0xffb2b26161e081f0cdf9db67200ee0ce25499d5ee683180a9781e6cceb791c39' > ./packages/arb-bridge-eth/.env
yarn
if [ $? -ne 0 ]; then exit 1; fi
yarn build
if [ $? -ne 0 ]; then exit 1; fi

cd $GITROOT
# Build L1: equal to yarn docker:build:geth, yarn docker:geth
docker-compose -f docker-compose-arbitrum.yml up -d arb-bridge-eth-geth
while ! nc -z localhost 7545; do sleep 2; done;
echo "Finished waiting for geth on localhost:7545..."
yarn arbitrum:deploy:live --network local_development --export bridge_eth_addresses.json && [ -f bridge_eth_addresses.json ]
echo "Deploy Arbitrum(L2) contract to L1"

# Build L2: equal to yarn demo:initialize, demo:deploy
yarn arbitrum:demo:initialize
if [ "$USER" == "root" ]
then
  chown -R 1000:1000 arbitrum/rollups/
  if [ $? -ne 0 ]; then exit 1; fi
fi
yarn arbitrum:demo:deploy --benchmark-docker-compose-path=$GITROOT/docker-compose-arbitrum.yml

# Setup L2
yarn arbitrum:remove-whitelist
yarn arbitrum:deposit-only-for-benchmark

# test benchmark
yarn
if [ $? -ne 0 ]; then exit 1; fi
yarn arbitrum:benchmark
