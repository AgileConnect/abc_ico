import ether from './helpers/ether'
import finney from './helpers/finney'
import advanceToBlock from './helpers/advanceToBlock'
import EVMThrow from './helpers/EVMThrow'

const BigNumber = web3.BigNumber

const should = require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should()

const ABCpresale = artifacts.require('../contracts/ABCpresale.sol')
const MintableToken = artifacts.require('parts/token/MintableToken.sol')

contract('ABCpresale', function ([accounts, investor, owner, wallet, purchaser]) {

  const developerAddress = accounts[4]
  const lessThanCap = ether(60)

  beforeEach(async function () {
    this.startBlock = web3.eth.blockNumber + 10
    this.endBlock =   web3.eth.blockNumber + 20

    this.presale = await ABCpresale.new(this.startBlock, this.endBlock, wallet, developerAddress, {from: owner})

    this.token = MintableToken.at(await this.presale.token())
  })

  it('should be token owner', async function () {
    const owner = await this.token.owner()
    owner.should.equal(this.presale.address)
  })


  describe('accepting payments in the period of presale', function () {

    it('should reject payments before start', async function () {
      await this.presale.send(lessThanCap).should.be.rejectedWith(EVMThrow)
      await this.presale.buyTokens(investor, {from: purchaser, value: lessThanCap}).should.be.rejectedWith(EVMThrow)
    })

    it('should accept payments after start', async function () {
      await advanceToBlock(this.startBlock - 1)
      await this.presale.send(lessThanCap).should.be.fulfilled
      await this.presale.buyTokens(investor, {value: lessThanCap, from: purchaser}).should.be.fulfilled
    })

    it('should reject payments after end', async function () {
      await advanceToBlock(this.endBlock)
      await this.presale.send(lessThanCap).should.be.rejectedWith(EVMThrow)
      await this.presale.buyTokens(investor, {value: lessThanCap, from: purchaser}).should.be.rejectedWith(EVMThrow)
    })

    it('should reject payments lesser than 0.3 ether', async function () {
      await advanceToBlock(this.endBlock)
      await this.presale.send(lessThanCap).should.be.rejectedWith(EVMThrow)
      await this.presale.buyTokens(investor, {value: finney(299), from: purchaser}).should.be.rejectedWith(EVMThrow)
    })

    it('should reject payments bigger than 1000 ether', async function () {
      await advanceToBlock(this.endBlock)
      await this.presale.send(lessThanCap).should.be.rejectedWith(EVMThrow)
      await this.presale.buyTokens(investor, {value: ether(1001), from: purchaser}).should.be.rejectedWith(EVMThrow)
    })

  })

  describe('accepting payments', function () {

    beforeEach(async function () {
      await advanceToBlock(this.startBlock - 1)
    })

    it('should accept payments lesser than softcap', async function () {
      for(var i=0; i < 5; i++) {
        await this.presale.buyTokens(investor, {from: purchaser, value: ether(1000)})
      }
      await this.presale.send(ether(500)).should.be.fulfilled
    })

    it('should accept payments bigger than softcap lesser than hardcap', async function () {
      for(var i=0; i < 5; i++) {
        await this.presale.buyTokens(investor, {from: purchaser, value: ether(1000)})
      }
      await this.presale.send(ether(490)).should.be.fulfilled
      await this.presale.send(ether(30)).should.be.fulfilled
    })

    it('should reject payments bigger than hardcap', async function () {
      let ended = await this.presale.hasEnded()
      ended.should.equal(false)
      for(var i=0; i < 5; i++) {
        await this.presale.buyTokens(investor, {from: purchaser, value: ether(1000)})
      }
      await this.presale.buyTokens(investor, {from: purchaser, value: ether(551)}).should.be.rejectedWith(EVMThrow)
    })

    it('should reject payments if token owner changed', async function () {
      await this.presale.changeTokenOwner(investor, {from: owner}).should.be.fulfilled
      await this.presale.send(lessThanCap).should.be.rejectedWith(EVMThrow)
    })

    it('should reject payments if manually closed', async function () {
      await advanceToBlock(this.startBlock + 1)
      await this.presale.closePresale({from: owner}).should.be.fulfilled
      await this.presale.send(lessThanCap).should.be.rejectedWith(EVMThrow)
    })

  })

  describe('ending', function () {

    beforeEach(async function () {
      await advanceToBlock(this.startBlock - 1)
    })

    it('should be ended after end', async function () {
      let ended = await this.presale.hasEnded()
      ended.should.equal(false)
      await advanceToBlock(this.endBlock + 1)
      ended = await this.presale.hasEnded()
      ended.should.equal(true)
    })

    it('should not be ended if under cap', async function () {
      let hasEnded = await this.presale.hasEnded()
      hasEnded.should.equal(false)
      await this.presale.send(lessThanCap)
      hasEnded = await this.presale.hasEnded()
      hasEnded.should.equal(false)
    })

    it('should not be ended if just under cap', async function () {
      for(var i=0; i < 5; i++) {
        await this.presale.buyTokens(investor, {from: purchaser, value: ether(1000)})
      }
      await this.presale.buyTokens(investor, {from: purchaser, value: ether(499)})
      let hasEnded = await this.presale.hasEnded()
      hasEnded.should.equal(false)
    })

    it('should be ended after softcap reached', async function () {
      let ended = await this.presale.hasEnded()
      ended.should.equal(false)
      for(var i=0; i < 5; i++) {
        await this.presale.buyTokens(investor, {from: purchaser, value: ether(1000)})
      }
      await this.presale.buyTokens(investor, {from: purchaser, value: ether(500)})
      ended = await this.presale.hasEnded()
      ended.should.equal(true)
    })

    it('should be ended if manually closed', async function () {
      let hasEnded = await this.presale.hasEnded()
      await advanceToBlock(this.startBlock + 1)
      hasEnded.should.equal(false)
      await this.presale.closePresale({from: owner}).should.be.fulfilled
      hasEnded = await this.presale.hasEnded()
      hasEnded.should.equal(true)
    })

    it('cannot be finalized before ending', async function () {
      await this.presale.finalize({from: owner}).should.be.rejectedWith(EVMThrow)
    })

    it('cannot be finalized by third party after ending', async function () {
      await advanceToBlock(this.endBlock + 1)
      await this.presale.finalize({from: investor}).should.be.rejectedWith(EVMThrow)
    })

    it('can be finalized by owner after ending', async function () {
      await advanceToBlock(this.endBlock + 1)
      await this.presale.finalize({from: owner}).should.be.fulfilled
    })

    it('cannot be finalized twice', async function () {
      await advanceToBlock(this.endBlock + 1)
      await this.presale.finalize({from: owner})
      await this.presale.finalize({from: owner}).should.be.rejectedWith(EVMThrow)
    })

    it('logs finalized', async function () {
      await advanceToBlock(this.endBlock + 1)
      const {logs} = await this.presale.finalize({from: owner})
      const event = logs.find(e => e.event === 'Finalized')
      should.exist(event)
    })

  })

})
