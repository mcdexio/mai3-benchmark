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
# build geth
docker-compose up arb-bridge-eth-geth
yarn deploy:live --network local_development --export bridge_eth_addresses.json && [ -f bridge_eth_addresses.json ]
