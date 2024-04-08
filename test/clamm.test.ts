import { ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { assert } from 'console'
import { CLAMMInstance } from '../artifacts/ts'
import { deployCLAMM, deployUints, expectError } from '../src/utils'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

let sender: PrivateKeyWallet

describe('math tests', () => {
  beforeAll(async () => {
    sender = await getSigner(ONE_ALPH * 100000n, 0)
  })

  test('fee growth from fee', async () => {
    const uints = await deployUints(sender)
    const clamm = await deployCLAMM(sender, uints.contractInstance.contractId)
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
  test('fee growth from fee - domain', async () => {
    const uints = await deployUints(sender)
    const clamm = await deployCLAMM(sender, uints.contractInstance.contractId)

    const liquidityDenominator = 10n ** 5n
    const sqrtPriceDenominator = 10n ** 24n
    const feeGrowthDenominator = 10n ** 28n
    // max FeeGrowth case inside of domain
    {
      const maxTickSpacing = 100n
      const tickSearchRange = 256n
      const sqrtPriceUpper = 65535383934512647000000000000n
      const sqrtPriceLowerIndex = 221818n - maxTickSpacing * tickSearchRange
      const sqrtPriceLower = (
        await clamm.contractInstance.methods.calculateSqrtPrice({ args: { tickIndex: sqrtPriceLowerIndex } })
      ).returns

      const maxDeltaSqrtPrice = sqrtPriceUpper - sqrtPriceLower
      const maxLiquidity = (1n << 256n) - 1n

      const maxToken = (maxLiquidity * maxDeltaSqrtPrice) / liquidityDenominator / sqrtPriceDenominator
      const feeGrowth = (
        await clamm.contractInstance.methods.feeGrowthFromFee({ args: { liquidity: maxLiquidity, fee: maxToken } })
      ).returns
      expect(feeGrowth).toBe(473129365723326089999999999999999n)
    }
    // min FeeGrowth case inside of domain
    {
      const basisPoint = 10000n
      const minToken = 1n
      const maxLiquidity = minToken * feeGrowthDenominator * liquidityDenominator * basisPoint
      const feeGrowth = (
        await clamm.contractInstance.methods.feeGrowthFromFee({
          args: { liquidity: maxLiquidity, fee: minToken + basisPoint }
        })
      ).returns
      expect(feeGrowth).toBe(1n)
    }
    // outside of domain trigger overflow due to result not fit into FeeGrowth
    {
      const liquidity = 1n
      const fee = (1n << 256n) - 1n

      await expectError(
        clamm.contractInstance.methods.feeGrowthFromFee({
          args: { liquidity, fee }
        })
      )
    }
    // amount = 0
    {
      const liquidity = 1000n * 10n ** 5n
      const fee = 0n
      const feeGrowth = (await clamm.contractInstance.methods.feeGrowthFromFee({ args: { liquidity, fee } })).returns
      expect(feeGrowth).toBe(0n)
    }
    // L = 0
    {
      const liquidity = 0n
      const fee = 1100n
      await expectError(clamm.contractInstance.methods.feeGrowthFromFee({ args: { liquidity, fee } }))
    }
  })
  test('fee growth to fee', async () => {
    const uints = await deployUints(sender)
    const clamm = await deployCLAMM(sender, uints.contractInstance.contractId)
    // Equal
    {
      const amount = 100n
      const liquidity = 1000000n * 10n ** 5n
      const params = { args: { liquidity, fee: amount } }
      const feeGrowth = (await clamm.contractInstance.methods.feeGrowthFromFee(params)).returns
      const outParams = { args: { liquidity, feeGrowth } }
      const out = (await clamm.contractInstance.methods.toFee(outParams)).returns
      expect(out).toBe(amount)
    }
    // Greater Liquidity
    {
      const amount = 100n
      const liquidityBefore = 1000000n * 10n ** 5n
      const liquidityAfter = 10000000n * 10n ** 5n
      const params = { args: { liquidity: liquidityBefore, fee: amount } }
      const feeGrowth = (await clamm.contractInstance.methods.feeGrowthFromFee(params)).returns
      const outParams = { args: { liquidity: liquidityAfter, feeGrowth } }
      const out = (await clamm.contractInstance.methods.toFee(outParams)).returns
      expect(out).toBe(1000n)
    }
    // huge liquidity
    {
      const amount = 100000000000000n
      const liquidity = (1n << 77n) * 10n ** 5n
      const params = { args: { liquidity, fee: amount } }
      const feeGrowth = (await clamm.contractInstance.methods.feeGrowthFromFee(params)).returns
      // real    6.61744490042422139897126953655970282852649688720703125 × 10^-10
      // expected 6617444900424221398
      expect(feeGrowth).toBe(6617444900424221398n)
      const outParams = { args: { liquidity, feeGrowth } }
      const out = (await clamm.contractInstance.methods.toFee(outParams)).returns
      // real    9.99999999999999999853225897430980027744256 × 10^13
      // expected 99999999999999
      expect(out).toBe(99_999_999_999_999n)
    }
  })
  test('fee growth to fee - domain', async () => {
    const uints = await deployUints(sender)
    const clamm = await deployCLAMM(sender, uints.contractInstance.contractId)
    // overflowing mul
    {
      const amount = 600000000000000000n
      const liquidity = 10000000000000000000n * 10n ** 5n
      const params = { args: { liquidity, fee: amount } }
      const feeGrowth = (await clamm.contractInstance.methods.feeGrowthFromFee(params)).returns
      expect(feeGrowth).toBe(600000000000000000000000000n)
      const outParams = { args: { liquidity, feeGrowth } }
      const out = (await clamm.contractInstance.methods.toFee(outParams)).returns
      expect(out).toBe(amount)
    }
    // max value inside domain
    {
      const liquidity = (1n << 256n) - 1n
      const feeGrowth = 100000n * 10n ** 28n
      const out = (await clamm.contractInstance.methods.toFee({ args: { liquidity, feeGrowth } })).returns
      expect(out).toBe(115792089237316195423570985008687907853269983999999999999999999999999999999999n)
    }
    // Overflow
    {
      const liquidity = (1n << 256n) - 1n
      const feeGrowth = (1n << 256n) - 1n
      await expectError(clamm.contractInstance.methods.toFee({ args: { liquidity, feeGrowth } }))
    }
    // FeeGrowth = 0
    {
      const liquidity = 1000n * 10n ** 5n
      const feeGrowth = 0n
      const out = (await clamm.contractInstance.methods.toFee({ args: { liquidity, feeGrowth } })).returns
      expect(out).toBe(0n)
    }
    // Liquidity = 0
    {
      const liquidity = 0n
      const feeGrowth = 1000n * 10n ** 28n
      const out = (await clamm.contractInstance.methods.toFee({ args: { liquidity, feeGrowth } })).returns
      expect(out).toBe(0n)
    }
  })
  test('tick from sqrt price', async () => {
    const uints = await deployUints(sender)
    const clamm = await deployCLAMM(sender, uints.contractInstance.contractId)
    {
      const sqrtPrice = 999006987054867461743028n
      const result = (
        await clamm.contractInstance.methods.getTickAtSqrtPrice({ args: { sqrtPrice, tickSpacing: 10n } })
      ).returns
      expect(result).toBe(-20n)
    }
  })
  test('allign tick to tickspacing', async () => {
    const uints = await deployUints(sender)
    const clamm = await deployCLAMM(sender, uints.contractInstance.contractId)
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
    const uints = await deployUints(sender)
    const clamm = await deployCLAMM(sender, uints.contractInstance.contractId)
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
    const uints = await deployUints(sender)
    const clamm = await deployCLAMM(sender, uints.contractInstance.contractId)
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
    const uints = await deployUints(sender)
    const clamm = await deployCLAMM(sender, uints.contractInstance.contractId)
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
    const uints = await deployUints(sender)
    const clamm = await deployCLAMM(sender, uints.contractInstance.contractId)
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
    const uints = await deployUints(sender)
    const clamm = await deployCLAMM(sender, uints.contractInstance.contractId)
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
    const uints = await deployUints(sender)
    const clamm = await deployCLAMM(sender, uints.contractInstance.contractId)
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
    const uints = await deployUints(sender)
    const clamm = await deployCLAMM(sender, uints.contractInstance.contractId)
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
    const uints = await deployUints(sender)
    const clamm = await deployCLAMM(sender, uints.contractInstance.contractId)
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
    const uints = await deployUints(sender)
    const clamm = await deployCLAMM(sender, uints.contractInstance.contractId)
    const params = { args: { tickSpacing: 1n } }
    const maxLiquidity = (await clamm.contractInstance.methods.calculateMaxLiquidityPerTick(params)).returns
    expect(maxLiquidity).toEqual(261006384132333857238172165551313140818439365214444611336425014162283870n)
  })
  test('calculate min amount out', async () => {
    const uints = await deployUints(sender)
    const clamm = await deployCLAMM(sender, uints.contractInstance.contractId)
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
    const uints = await deployUints(sender)
    const clamm = await deployCLAMM(sender, uints.contractInstance.contractId)
    {
      const currentSqrtPrice = 10n ** 24n
      const targetSqrtPrice = 1004987562112089027021926n
      const liquidity = 2000n * 10n ** 5n
      const amount = 1n
      const byAmountIn = true
      const fee = 60000n
      const params = { args: { currentSqrtPrice, targetSqrtPrice, liquidity, amount, byAmountIn, fee } }
      const { nextSqrtPrice, amountIn, amountOut, feeAmount } = (
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
        const { nextSqrtPrice, amountIn, amountOut, feeAmount } = (
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
        const { nextSqrtPrice, amountIn, amountOut, feeAmount } = (
          await clamm.contractInstance.methods.computeSwapStep(paramsOut)
        ).returns
        expect(nextSqrtPrice).toEqual(targetSqrtPrice)
        expect(amountIn).toEqual(10n)
        expect(amountOut).toEqual(9n)
        expect(feeAmount).toEqual(1n)
      }
    }
  })

  describe('calculate fee growth inside', () => {
    let clamm: CLAMMInstance
    const globalFeeGrowthX = 15_0000000000000000000000000000n
    const globalFeeGrowthY = 15_0000000000000000000000000000n

    const tickLowerIndex = -2n
    const tickLowerFeeGrowthOutsideX = 0n
    const tickLowerFeeGrowthOutsideY = 0n

    const tickUpperIndex = 2n
    const tickUpperFeeGrowthOutsideX = 0n
    const tickUpperFeeGrowthOutsideY = 0n

    beforeEach(async () => {
      const uints = await deployUints(sender)
      clamm = (await deployCLAMM(sender, uints.contractInstance.contractId)).contractInstance
    })

    test('sqrt price between ticks', async () => {
      // <──────────────                    ──────────────>
      // fee_outside_t0| fee_growth_inside |fee_outside_t1
      //<───────────── t0 ────── C ────── t1 ───────────────────>
      // fee_growth_inside = fee_growth_global - t0.fee_outside - t1.fee_outside

      const tickCurrent = 0n

      // current tick inside range
      // lower    current     upper
      // |        |           |
      // -2       0           2

      const result = await clamm.methods.calculateFeeGrowthInside({
        args: {
          tickLowerIndex,
          tickLowerFeeGrowthOutsideX,
          tickLowerFeeGrowthOutsideY,
          tickUpperIndex,
          tickUpperFeeGrowthOutsideX,
          tickUpperFeeGrowthOutsideY,
          tickCurrent,
          globalFeeGrowthX,
          globalFeeGrowthY
        }
      })

      expect(result.returns[0]).toBe(15_0000000000000000000000000000n)
      expect(result.returns[1]).toBe(15_0000000000000000000000000000n)
    })

    test('sqrt price below ticks', async () => {
      //                      ───────fee_outside_t0──────────>
      //                     |fee_growth_inside| fee_outside_t1
      // ─────── c ─────── t0 ──────────────> t1 ───────────>
      // fee_growth_inside = t0.fee_outside - t1.fee_outside

      const tickCurrent = -4n

      // current tick below range
      // current  lower       upper
      // |        |           |
      // -4       2           2

      const result = await clamm.methods.calculateFeeGrowthInside({
        args: {
          tickLowerIndex,
          tickLowerFeeGrowthOutsideX,
          tickLowerFeeGrowthOutsideY,
          tickUpperIndex,
          tickUpperFeeGrowthOutsideX,
          tickUpperFeeGrowthOutsideY,
          tickCurrent,
          globalFeeGrowthX,
          globalFeeGrowthY
        }
      })

      expect(result.returns[0]).toBe(0n)
      expect(result.returns[1]).toBe(0n)
    })

    test('sqrt price above ticks', async () => {
      // <──────────fee_outside_t0──────────
      // fee_outside_t1  | fee_growth_inside|
      // ────────────── t1 ──────────────── t0 ─────── c ───────────>
      // fee_growth_inside = t0.fee_outside - t1.fee_outside

      const tickCurrent = 3n

      // current tick upper range
      // lower    upper       current
      // |        |           |
      // -2       2           4

      const result = await clamm.methods.calculateFeeGrowthInside({
        args: {
          tickLowerIndex,
          tickLowerFeeGrowthOutsideX,
          tickLowerFeeGrowthOutsideY,
          tickUpperIndex,
          tickUpperFeeGrowthOutsideX,
          tickUpperFeeGrowthOutsideY,
          tickCurrent,
          globalFeeGrowthX,
          globalFeeGrowthY
        }
      })

      expect(result.returns[0]).toBe(0n)
      expect(result.returns[1]).toBe(0n)
    })

    test('sqrt price above ticks, liquidity outside upper tick', async () => {
      const tickCurrent = 3n

      const tickUpperFeeGrowthOutsideX = 1n
      const tickUpperFeeGrowthOutsideY = 2n

      const globalFeeGrowthX = 5_0000000000000000000000000000n
      const globalFeeGrowthY = 5_0000000000000000000000000000n

      // current tick upper range
      // lower    upper       current
      // |        |           |
      // -2       2           3

      const result = await clamm.methods.calculateFeeGrowthInside({
        args: {
          tickLowerIndex,
          tickLowerFeeGrowthOutsideX,
          tickLowerFeeGrowthOutsideY,
          tickUpperIndex,
          tickUpperFeeGrowthOutsideX,
          tickUpperFeeGrowthOutsideY,
          tickCurrent,
          globalFeeGrowthX,
          globalFeeGrowthY
        }
      })

      expect(result.returns[0]).toBe(1n)
      expect(result.returns[1]).toBe(2n)
    })

    test('sqrt price in between ticks, liquidity outside upper tick', async () => {
      const tickCurrent = 0n

      const tickUpperFeeGrowthOutsideX = 2_0000000000000000000000000000n
      const tickUpperFeeGrowthOutsideY = 3_0000000000000000000000000000n

      // current tick inside range
      // lower    current     upper
      // |        |           |
      // -2       0           2

      const result = await clamm.methods.calculateFeeGrowthInside({
        args: {
          tickLowerIndex,
          tickLowerFeeGrowthOutsideX,
          tickLowerFeeGrowthOutsideY,
          tickUpperIndex,
          tickUpperFeeGrowthOutsideX,
          tickUpperFeeGrowthOutsideY,
          tickCurrent,
          globalFeeGrowthX,
          globalFeeGrowthY
        }
      })

      expect(result.returns[0]).toBe(13_0000000000000000000000000000n)
      expect(result.returns[1]).toBe(12_0000000000000000000000000000n)
    })

    test('sqrt price in between ticks, liquidity outside lower tick', async () => {
      const tickCurrent = 0n

      const tickLowerFeeGrowthOutsideX = 2_0000000000000000000000000000n
      const tickLowerFeeGrowthOutsideY = 3_0000000000000000000000000000n

      // current tick inside range
      // lower    current     upper
      // |        |           |
      // -2       0           2

      const result = await clamm.methods.calculateFeeGrowthInside({
        args: {
          tickLowerIndex,
          tickLowerFeeGrowthOutsideX,
          tickLowerFeeGrowthOutsideY,
          tickUpperIndex,
          tickUpperFeeGrowthOutsideX,
          tickUpperFeeGrowthOutsideY,
          tickCurrent,
          globalFeeGrowthX,
          globalFeeGrowthY
        }
      })

      expect(result.returns[0]).toBe(13_0000000000000000000000000000n)
      expect(result.returns[1]).toBe(12_0000000000000000000000000000n)
    })
  })

  describe('calculate fee growth inside - domain', () => {
    let clamm: CLAMMInstance

    const tickCurrent = 0n
    const globalFeeGrowthX = 20_0000000000000000000000000000n
    const globalFeeGrowthY = 20_0000000000000000000000000000n

    const tickLowerIndex = -20n
    const tickLowerFeeGrowthOutsideX = 20_0000000000000000000000000000n
    const tickLowerFeeGrowthOutsideY = 20_0000000000000000000000000000n

    const tickUpperIndex = -10n
    const tickUpperFeeGrowthOutsideX = 15_0000000000000000000000000000n
    const tickUpperFeeGrowthOutsideY = 15_0000000000000000000000000000n

    beforeEach(async () => {
      const uints = await deployUints(sender)
      clamm = (await deployCLAMM(sender, uints.contractInstance.contractId)).contractInstance
    })

    test('max fee growth', async () => {
      const result = await clamm.methods.calculateFeeGrowthInside({
        args: {
          tickLowerIndex,
          tickLowerFeeGrowthOutsideX,
          tickLowerFeeGrowthOutsideY,
          tickUpperIndex,
          tickUpperFeeGrowthOutsideX,
          tickUpperFeeGrowthOutsideY,
          tickCurrent,
          globalFeeGrowthX,
          globalFeeGrowthY
        }
      })

      expect(result.returns[0]).toBe(2n ** 256n - 1n - 5_0000000000000000000000000000n + 1n)
      expect(result.returns[1]).toBe(2n ** 256n - 1n - 5_0000000000000000000000000000n + 1n)
    })
  })

  test('calculate sqrt price', async () => {
    const uints = await deployUints(sender)
    const clamm = (await deployCLAMM(sender, uints.contractInstance.contractId)).contractInstance
    {
      const result = await clamm.methods.calculateSqrtPrice({ args: { tickIndex: 20_000n } })
      expect(result.returns).toBe(2_718145925979000000000000n)
    }
    {
      const result = await clamm.methods.calculateSqrtPrice({ args: { tickIndex: 200_000n } })
      expect(result.returns).toBe(22015_455979766288000000000000n)
    }
    {
      const result = await clamm.methods.calculateSqrtPrice({ args: { tickIndex: -20_000n } })
      expect(result.returns).toBe(367897834491000000000000n)
    }
    {
      const result = await clamm.methods.calculateSqrtPrice({ args: { tickIndex: -200_000n } })
      expect(result.returns).toBe(45422634000000000000n)
    }
    {
      const result = await clamm.methods.calculateSqrtPrice({ args: { tickIndex: 0n } })
      expect(result.returns).toBe(1_000000000000000000000000n)
    }
    {
      const result = await clamm.methods.calculateSqrtPrice({ args: { tickIndex: 221_818n } })
      expect(result.returns).toBe(65535_383934512647000000000000n)
    }
    {
      const result = await clamm.methods.calculateSqrtPrice({ args: { tickIndex: -221_818n } })
      expect(result.returns).toBe(15258932000000000000n)
    }
  })

  test('calculate sqrt price - domain', async () => {
    const uints = await deployUints(sender)
    const clamm = (await deployCLAMM(sender, uints.contractInstance.contractId)).contractInstance
    {
      expectError(clamm.methods.calculateSqrtPrice({ args: { tickIndex: 221_819n } }))
    }
    {
      expectError(clamm.methods.calculateSqrtPrice({ args: { tickIndex: -221_819n } }))
    }
  })
})
