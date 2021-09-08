# Default GETH
# Private key 0xffb2b26161e081f0cdf9db67200ee0ce25499d5ee683180a9781e6cceb791c39
# Public address 0x81183C9C61bdf79DB7330BBcda47Be30c0a85064

root_path = "~/MCDEX/mai3-benchmark" # modify your path

# get private key of rollup
from os import listdir
from os.path import isfile, join
import os
mypath_1 = "arbitrum/rollups/local/validator0/wallets"
mypath_2 = "arbitrum/rollups/local/validator1/wallets"
onlyfiles_1 = [f for f in listdir(mypath_1) if isfile(join(mypath_1, f))]
command = 'web3 ' + 'account ' + 'extract ' + '--keyfile ' + f'{root_path}/{mypath_1}/{onlyfiles_1[0]} ' + '--password ' + 'pass'
os.system(command)

onlyfiles_2 = [f for f in listdir(mypath_2) if isfile(join(mypath_2, f))]
command = 'web3 ' + 'account ' + 'extract ' + '--keyfile ' + f'{root_path}/{mypath_2}/{onlyfiles_2[0]} ' + '--password ' + 'pass'
os.system(command)
