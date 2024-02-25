import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { assert } from 'console'
import { testPrivateKeys } from '../src/consts'
import { deployCLAMM } from '../src/utils'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

let sender: PrivateKeyWallet

describe('math tests', () => {
  beforeAll(async () => {
    sender = await getSigner(ONE_ALPH * 100000n, 0)
  })
  test('placeholder', () => {})
  test('fee growth from fee', async () => {
    const clamm = await deployCLAMM(sender)
    {
      const liquidity = 10n ** 5n
      const amount = 1n
      const result = (await clamm.contractInstance.methods.feeGrowthFromFee({ args: { liquidity, fee: amount } }))
        .returns
      expect(result).toBe(10000000000000000000000000000n)
    }
    {
      const liquidity = 2n * 10n ** 5n
      const amount = 1n
      const result = (await clamm.contractInstance.methods.feeGrowthFromFee({ args: { liquidity, fee: amount } }))
        .returns
      expect(result).toBe(5n * 10n ** 27n)
    }
    {
      const liquidity = ((1n << 64n) - 1n) * 10n ** 5n
      const amount = 1n
      const result = (await clamm.contractInstance.methods.feeGrowthFromFee({ args: { liquidity, fee: amount } }))
        .returns
      expect(result).toBe(542101086n)
    }
    {
      const liquidity = 100n * 10n ** 5n
      const amount = 1000000n
      const result = (await clamm.contractInstance.methods.feeGrowthFromFee({ args: { liquidity, fee: amount } }))
        .returns
      expect(result).toBe(10000n * 10n ** 28n)
    }
  })
  test('tick from sqrt price', async () => {
    const clamm = await deployCLAMM(sender)
    {
      const sqrtPrice = 999006987054867461743028n
      const result = (
        await clamm.contractInstance.methods.getTickAtSqrtPrice({ args: { sqrtPrice, tickSpacing: 10n } })
      ).returns
      expect(result).toBe(-20n)
    }
  })
  test('allign tick to tickspacing', async () => {
    const clamm = await deployCLAMM(sender)
    {
      const accurateTick = 0n
      const tickSpacing = 3n
      const result = (await clamm.contractInstance.methods.allignTickToSpacing({ args: { accurateTick, tickSpacing } }))
        .returns
      expect(result).toBe(0n)
    }
    {
      const accurateTick = 14n
      const tickSpacing = 10n
      const result = (await clamm.contractInstance.methods.allignTickToSpacing({ args: { accurateTick, tickSpacing } }))
        .returns
      expect(result).toBe(10n)
    }
    {
      const accurateTick = 20n
      const tickSpacing = 10n
      const result = (await clamm.contractInstance.methods.allignTickToSpacing({ args: { accurateTick, tickSpacing } }))
        .returns
      expect(result).toBe(20n)
    }
    {
      const accurateTick = -14n
      const tickSpacing = 10n
      const result = (await clamm.contractInstance.methods.allignTickToSpacing({ args: { accurateTick, tickSpacing } }))
        .returns
      expect(result).toBe(-20n)
    }
    {
      const accurateTick = -21n
      const tickSpacing = 10n
      const result = (await clamm.contractInstance.methods.allignTickToSpacing({ args: { accurateTick, tickSpacing } }))
        .returns
      expect(result).toBe(-30n)
    }
    {
      const accurateTick = -120n
      const tickSpacing = 3n
      const result = (await clamm.contractInstance.methods.allignTickToSpacing({ args: { accurateTick, tickSpacing } }))
        .returns
      expect(result).toBe(-120n)
    }
  })
  test('log spacing over 1', async () => {
    const clamm = await deployCLAMM(sender)
    {
      for (let i = 0n; i < 100n; i++) {
        const sqrtPriceDecimal = (await clamm.contractInstance.methods.calculateSqrtPrice({ args: { tickIndex: i } }))
          .returns
        let tick = (
          await clamm.contractInstance.methods.getTickAtSqrtPrice({
            args: { sqrtPrice: sqrtPriceDecimal, tickSpacing: 3n }
          })
        ).returns
        let expectedTick = (
          await clamm.contractInstance.methods.allignTickToSpacing({ args: { accurateTick: i, tickSpacing: 3n } })
        ).returns
        expect(tick).toEqual(expectedTick)
      }
    }
    {
      for (let i = -100n; i < 0; i++) {
        const sqrtPriceDecimal = (await clamm.contractInstance.methods.calculateSqrtPrice({ args: { tickIndex: i } }))
          .returns
        let tick = (
          await clamm.contractInstance.methods.getTickAtSqrtPrice({
            args: { sqrtPrice: sqrtPriceDecimal, tickSpacing: 3n }
          })
        ).returns
        let expectedTick = (
          await clamm.contractInstance.methods.allignTickToSpacing({ args: { accurateTick: i, tickSpacing: 3n } })
        ).returns
        expect(tick).toEqual(expectedTick)
      }
    }
  })
  test('log', async () => {
    const clamm = await deployCLAMM(sender)
    {
      for (let i = 0n; i < 100n; i++) {
        const sqrtPriceDecimal = (await clamm.contractInstance.methods.calculateSqrtPrice({ args: { tickIndex: i } }))
          .returns
        let tick = (
          await clamm.contractInstance.methods.getTickAtSqrtPrice({
            args: { sqrtPrice: sqrtPriceDecimal, tickSpacing: 1n }
          })
        ).returns
        expect(tick).toEqual(i)
      }
    }
    {
      for (let i = -100n; i < 0; i++) {
        const sqrtPriceDecimal = (await clamm.contractInstance.methods.calculateSqrtPrice({ args: { tickIndex: i } }))
          .returns
        let tick = (
          await clamm.contractInstance.methods.getTickAtSqrtPrice({
            args: { sqrtPrice: sqrtPriceDecimal, tickSpacing: 1n }
          })
        ).returns
        expect(tick).toEqual(i)
      }
    }
  })

  test('calculate sqrt price', async () => {
    const clamm = await deployCLAMM(sender)
    {
      const params = { args: { tickIndex: 30n } }
      const sqrtPrice = (await clamm.contractInstance.methods.calculateSqrtPrice(params)).returns
      expect(sqrtPrice).toEqual(1001501050455000000000000n)
    }
    {
      const params = { args: { tickIndex: 20n } }
      const sqrtPrice = (await clamm.contractInstance.methods.calculateSqrtPrice(params)).returns
      expect(sqrtPrice).toEqual(1001000450120000000000000n)
    }
    {
      const params = { args: { tickIndex: 10n } }
      const sqrtPrice = (await clamm.contractInstance.methods.calculateSqrtPrice(params)).returns
      expect(sqrtPrice).toEqual(1000500100010000000000000n)
    }
    {
      const params = { args: { tickIndex: 0n } }
      const sqrtPrice = (await clamm.contractInstance.methods.calculateSqrtPrice(params)).returns
      expect(sqrtPrice).toEqual(1000000000000000000000000n)
    }
    {
      const params = { args: { tickIndex: -10n } }
      const sqrtPrice = (await clamm.contractInstance.methods.calculateSqrtPrice(params)).returns
      expect(sqrtPrice).toEqual(999500149965000000000000n)
    }
    {
      const params = { args: { tickIndex: -20n } }
      const sqrtPrice = (await clamm.contractInstance.methods.calculateSqrtPrice(params)).returns
      expect(sqrtPrice).toEqual(999000549780000000000000n)
    }
    {
      const params = { args: { tickIndex: -30n } }
      const sqrtPrice = (await clamm.contractInstance.methods.calculateSqrtPrice(params)).returns
      expect(sqrtPrice).toEqual(998501199320000000000000n)
    }
  })
  test('get delta x', async () => {
    const clamm = await deployCLAMM(sender)
    const sqrtPriceA = 234878324943782000000000000n
    const sqrtPriceB = 87854456421658000000000000n
    const liquidity = 983983249092n
    const paramsUp = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: true } }
    const paramsDown = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: false } }
    const resultUp = (await clamm.contractInstance.methods.getDeltaX(paramsUp)).returns
    const resultDown = (await clamm.contractInstance.methods.getDeltaX(paramsDown)).returns
    // 7010.8199533068819376891841727789301497024557314488455622925765280
    expect(resultUp).toEqual(70109n)
    expect(resultDown).toEqual(70108n)
  })
  test('get delta y', async () => {
    const clamm = await deployCLAMM(sender)
    const sqrtPriceA = 234878324943782000000000000n
    const sqrtPriceB = 87854456421658000000000000n
    const liquidity = 983983249092n
    const paramsUp = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: true } }
    const paramsDown = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: false } }
    const resultUp = (await clamm.contractInstance.methods.getDeltaY(paramsUp)).returns
    const resultDown = (await clamm.contractInstance.methods.getDeltaY(paramsDown)).returns
    // 144669023.842474597804911408
    expect(resultUp).toEqual(1446690239n)
    expect(resultDown).toEqual(1446690238n)
  })
  test('get next sqrt price x up', async () => {
    const clamm = await deployCLAMM(sender)
    {
      const startingSqrtPrice = 2n * 10n ** 24n
      const liquidity = 3n * 10n ** 5n
      const x = 5n
      const params = { args: { startingSqrtPrice, liquidity, x, addX: true } }
      const nextSqrtPrice = (await clamm.contractInstance.methods.getNextSqrtPriceXUp(params)).returns
      expect(nextSqrtPrice).toEqual(461538461538461538461539n)
    }
    {
      const startingSqrtPrice = 100000n * 10n ** 24n
      const liquidity = 500000000n * 10n ** 5n
      const x = 4000n
      const params = { args: { startingSqrtPrice, liquidity, x, addX: false } }
      const nextSqrtPrice = (await clamm.contractInstance.methods.getNextSqrtPriceXUp(params)).returns
      expect(nextSqrtPrice).toEqual(500000n * 10n ** 24n)
    }
  })
  test('get next sqrt price y down', async () => {
    const clamm = await deployCLAMM(sender)
    {
      const startingSqrtPrice = 2n * 10n ** 24n
      const liquidity = 3n * 10n ** 5n
      const y = 5n
      const params = { args: { startingSqrtPrice, liquidity, y, addY: true } }
      const nextSqrtPrice = (await clamm.contractInstance.methods.getNextSqrtPriceYDown(params)).returns
      expect(nextSqrtPrice).toEqual(3666666666666666666666666n)
    }
  })
  test('calculate amount delta', async () => {
    const clamm = await deployCLAMM(sender)
    // in-range
    {
      const currentTickIndex = 2n
      const currentSqrtPrice = 1000140000000000000000000n
      const liquidityDelta = 5000000n * 10n ** 5n
      const liquiditySign = true
      const upperTick = 3n
      const lowerTick = 0n
      const params = {
        args: { currentTickIndex, currentSqrtPrice, liquidityDelta, liquiditySign, upperTick, lowerTick }
      }
      const [x, y, add] = (await clamm.contractInstance.methods.calculateAmountDelta(params)).returns
      expect(x).toEqual(51n)
      expect(y).toEqual(700n)
      expect(add).toEqual(true)
    }
  })
  test('calculate max liquidity per tick', async () => {
    const clamm = await deployCLAMM(sender)
    const params = { args: { tickSpacing: 1n } }
    const maxLiquidity = (await clamm.contractInstance.methods.calculateMaxLiquidityPerTick(params)).returns
    expect(maxLiquidity).toEqual(261006384132333857238172165551313140818439365214444611336425014162283870n)
  })
  test('calculate min amount out', async () => {
    const clamm = await deployCLAMM(sender)
    // 0% fee
    {
      const expectedAmountOut = 100n
      const slippage = 0n
      const params = { args: { expectedAmountOut, slippage } }
      const result = (await clamm.contractInstance.methods.calculateMinAmountOut(params)).returns
      assert(result === expectedAmountOut)
    }
    // 100% fee
    {
      const expectedAmountOut = 100n
      const slippage = 10n ** 12n
      const params = { args: { expectedAmountOut, slippage } }
      const result = (await clamm.contractInstance.methods.calculateMinAmountOut(params)).returns
      expect(result).toEqual(0n)
    }
  })
  test('compute swap step', async () => {
    const clamm = await deployCLAMM(sender)
    {
      const currentSqrtPrice = 10n ** 24n
      const targetSqrtPrice = 1004987562112089027021926n
      const liquidity = 2000n * 10n ** 5n
      const amount = 1n
      const byAmountIn = true
      const fee = 60000n
      const params = { args: { currentSqrtPrice, targetSqrtPrice, liquidity, amount, byAmountIn, fee } }
      const [nextSqrtPrice, amountIn, amountOut, feeAmount] = (
        await clamm.contractInstance.methods.computeSwapStep(params)
      ).returns
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
        const [nextSqrtPrice, amountIn, amountOut, feeAmount] = (
          await clamm.contractInstance.methods.computeSwapStep(paramsIn)
        ).returns
        expect(nextSqrtPrice).toEqual(targetSqrtPrice)
        expect(amountIn).toEqual(10n)
        expect(amountOut).toEqual(9n)
        expect(feeAmount).toEqual(1n)
      }
      {
        const paramsOut = {
          args: { currentSqrtPrice, targetSqrtPrice, liquidity, amount, byAmountIn: false, fee }
        }
        const [nextSqrtPrice, amountIn, amountOut, feeAmount] = (
          await clamm.contractInstance.methods.computeSwapStep(paramsOut)
        ).returns
        expect(nextSqrtPrice).toEqual(targetSqrtPrice)
        expect(amountIn).toEqual(10n)
        expect(amountOut).toEqual(9n)
        expect(feeAmount).toEqual(1n)
      }
    }
  })
})
