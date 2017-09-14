var ABCpresale = artifacts.require("./ABCpresale.sol")

module.exports = function(deployer, network, accounts) {
  const startBlock = web3.eth.blockNumber+2 
  const endBlock = startBlock + 300  
  deployer.deploy(ABCpresale, startBlock, endBlock, web3.eth.accounts[0], web3.eth.accounts[1])
}
