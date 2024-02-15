import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { assert } from 'console'
import { CLAMM } from '../artifacts/ts'
import { testPrivateKeys } from '../src/consts'
import { deployCLAMM } from '../src/testUtils'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')
let sender = new PrivateKeyWallet({ privateKey: testPrivateKeys[0] })
let recipient = new PrivateKeyWallet({ privateKey: testPrivateKeys[0] })

describe('math tests', () => {
  beforeAll(async () => {
    sender = await getSigner(ONE_ALPH * 100000n, 0)
    recipient = await getSigner(ONE_ALPH * 100000n, 0)
  })

  test('deploy', async () => {
    await deployCLAMM(sender, sender.address, recipient.address, '')
  })

  test('get delta x', async () => {
    const result = await deployCLAMM(sender, sender.address, recipient.address, '')
    const clamm = CLAMM.at(result.contractInstance.address)

    const sqrtPriceA = 234878324943782000000000000n
    const sqrtPriceB = 87854456421658000000000000n
    const liquidity = 983983249092n
    const paramsUp = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: true } }
    const paramsDown = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: false } }
    const resultUp = (await clamm.methods.getDeltaX(paramsUp)).returns
    const resultDown = (await clamm.methods.getDeltaX(paramsDown)).returns
    // 7010.8199533068819376891841727789301497024557314488455622925765280
    expect(resultUp).toEqual(70109n)
    expect(resultDown).toEqual(70108n)
  })
  test('get delta y', async () => {
    const result = await deployCLAMM(sender, sender.address, recipient.address, '')
    const clamm = CLAMM.at(result.contractInstance.address)

    const sqrtPriceA = 234878324943782000000000000n
    const sqrtPriceB = 87854456421658000000000000n
    const liquidity = 983983249092n
    const paramsUp = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: true } }
    const paramsDown = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: false } }
    const resultUp = (await clamm.methods.getDeltaY(paramsUp)).returns
    const resultDown = (await clamm.methods.getDeltaY(paramsDown)).returns
    // 144669023.842474597804911408
    expect(resultUp).toEqual(1446690239n)
    expect(resultDown).toEqual(1446690238n)
  })
  test('get next sqrt price x up', async () => {
    const result = await deployCLAMM(sender, sender.address, recipient.address, '')
    const clamm = CLAMM.at(result.contractInstance.address)

    {
      const startingSqrtPrice = 2n * 10n ** 24n
      const liquidity = 3n * 10n ** 5n
      const x = 5n
      const params = { args: { startingSqrtPrice, liquidity, x, addX: true } }
      const nextSqrtPrice = (await clamm.methods.getNextSqrtPriceXUp(params)).returns
      expect(nextSqrtPrice).toEqual(461538461538461538461539n)
    }
    {
      const startingSqrtPrice = 100000n * 10n ** 24n
      const liquidity = 500000000n * 10n ** 5n
      const x = 4000n
      const params = { args: { startingSqrtPrice, liquidity, x, addX: false } }
      const nextSqrtPrice = (await clamm.methods.getNextSqrtPriceXUp(params)).returns
      expect(nextSqrtPrice).toEqual(500000n * 10n ** 24n)
    }
  })
  test('get next sqrt price y down', async () => {
    const result = await deployCLAMM(sender, sender.address, recipient.address, '')
    const clamm = CLAMM.at(result.contractInstance.address)
    {
      const startingSqrtPrice = 2n * 10n ** 24n
      const liquidity = 3n * 10n ** 5n
      const y = 5n
      const params = { args: { startingSqrtPrice, liquidity, y, addY: true } }
      const nextSqrtPrice = (await clamm.methods.getNextSqrtPriceYDown(params)).returns
      expect(nextSqrtPrice).toEqual(3666666666666666666666666n)
    }
  })
  test('calculate amount delta', async () => {
    const result = await deployCLAMM(sender, sender.address, recipient.address, '')
    const clamm = CLAMM.at(result.contractInstance.address)
    // in-range
    {
      const currentTickIndex = 2n
      const currentSqrtPrice = 1000140000000000000000000n
      const liquidityDelta = 50n * 10n ** 5n
      const liquiditySign = true
      const upperTick = 3n
      const lowerTick = 0n
      const params = {
        args: { currentTickIndex, currentSqrtPrice, liquidityDelta, liquiditySign, upperTick, lowerTick }
      }
      const [x, y, add] = (await clamm.methods.calculateAmountDelta(params)).returns
      expect(x).toEqual(50n)
      expect(y).toEqual(1n)
      expect(add).toEqual(true)
    }
  })
  test('calculate max liquidity per tick', async () => {
    const result = await deployCLAMM(sender, sender.address, recipient.address, '')
    const clamm = CLAMM.at(result.contractInstance.address)

    const params = { args: { tickSpacing: 1n } }
    const maxLiquidity = (await clamm.methods.calculateMaxLiquidityPerTick(params)).returns
    expect(maxLiquidity).toEqual(261006384132333857238172165551313140818439365214444611336425014162283870n)
  })
  test('calculate min amount out', async () => {
    const result = await deployCLAMM(sender, sender.address, recipient.address, '')
    const clamm = CLAMM.at(result.contractInstance.address)
    // 0% fee
    {
      const expectedAmountOut = 100n
      const slippage = 0n
      const params = { args: { expectedAmountOut, slippage } }
      const result = (await clamm.methods.calculateMinAmountOut(params)).returns
      assert(result === expectedAmountOut)
    }
    // 100% fee
    {
      const expectedAmountOut = 100n
      const slippage = 10n ** 12n
      const params = { args: { expectedAmountOut, slippage } }
      const result = (await clamm.methods.calculateMinAmountOut(params)).returns
      expect(result).toEqual(0n)
    }
  })
  test('compute swap step', async () => {
    const result = await deployCLAMM(sender, sender.address, recipient.address, '')
    const clamm = CLAMM.at(result.contractInstance.address)

    {
      const currentSqrtPrice = 10n ** 24n
      const targetSqrtPrice = 1004987562112089027021926n
      const liquidity = 2000n * 10n ** 5n
      const amount = 1n
      const byAmountIn = true
      const fee = 60000n

      const params = { args: { currentSqrtPrice, targetSqrtPrice, liquidity, amount, byAmountIn, fee } }
      const [nextSqrtPrice, amountIn, amountOut, feeAmount] = (await clamm.methods.computeSwapStep(params)).returns
      expect(nextSqrtPrice).toEqual(currentSqrtPrice)
      expect(amountIn).toEqual(0n)
      expect(amountOut).toEqual(0n)
      expect(feeAmount).toEqual(1n)
    }
    {
      const currentSqrtPrice = 10n ** 24n
      const targetSqrtPrice = 1004987562112089027021926n
      const liquidity = 2000n * 10n ** 5n
      const amount = 20n
      const fee = 60000n
      {
        const paramsIn = {
          args: { currentSqrtPrice, targetSqrtPrice, liquidity, amount, byAmountIn: true, fee }
        }
        const [nextSqrtPrice, amountIn, amountOut, feeAmount] = (await clamm.methods.computeSwapStep(paramsIn)).returns
        expect(nextSqrtPrice).toEqual(targetSqrtPrice)
        expect(amountIn).toEqual(10n)
        expect(amountOut).toEqual(9n)
        expect(feeAmount).toEqual(1n)
      }
      {
        const paramsOut = {
          args: { currentSqrtPrice, targetSqrtPrice, liquidity, amount, byAmountIn: false, fee }
        }
        const [nextSqrtPrice, amountIn, amountOut, feeAmount] = (await clamm.methods.computeSwapStep(paramsOut)).returns
        expect(nextSqrtPrice).toEqual(targetSqrtPrice)
        expect(amountIn).toEqual(10n)
        expect(amountOut).toEqual(9n)
        expect(feeAmount).toEqual(1n)
      }
    }
  })
})
