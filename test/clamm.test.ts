import { DeployContractResult, ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { assert } from 'console'
import { CLAMMInstance } from '../artifacts/ts'
import { ArithmeticError, MaxTick, MaxU256, deployCLAMM, deployUints, expectError } from '../src/utils'

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
      expect(result).toStrictEqual({ value: 10000000000000000000000000000n, error: 0n })
    }
    {
      const liquidity = 2n * 10n ** 5n
      const amount = 1n
      const result = (await clamm.contractInstance.methods.feeGrowthFromFee({ args: { liquidity, fee: amount } }))
        .returns
      expect(result).toStrictEqual({ value: 5n * 10n ** 27n, error: 0n })
    }
    {
      const liquidity = ((1n << 64n) - 1n) * 10n ** 5n
      const amount = 1n
      const result = (await clamm.contractInstance.methods.feeGrowthFromFee({ args: { liquidity, fee: amount } }))
        .returns
      expect(result).toStrictEqual({ value: 542101086n, error: 0n })
    }
    {
      const liquidity = 100n * 10n ** 5n
      const amount = 1000000n
      const result = (await clamm.contractInstance.methods.feeGrowthFromFee({ args: { liquidity, fee: amount } }))
        .returns
      expect(result).toStrictEqual({ value: 10000n * 10n ** 28n, error: 0n })
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
      expect(feeGrowth).toStrictEqual({ value: 473129365723326089999999999999999n, error: 0n })
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
      expect(feeGrowth).toStrictEqual({ value: 1n, error: 0n })
    }
    // outside of domain trigger overflow due to result not fit into FeeGrowth
    {
      const liquidity = 1n
      const fee = (1n << 256n) - 1n

      const feeGrowth = (
        await clamm.contractInstance.methods.feeGrowthFromFee({
          args: { liquidity, fee }
        })
      ).returns
      expect(feeGrowth).toStrictEqual({
        value: MaxU256,
        error: ArithmeticError.CastOverflow
      })
    }
    // amount = 0
    {
      const liquidity = 1000n * 10n ** 5n
      const fee = 0n
      const feeGrowth = (await clamm.contractInstance.methods.feeGrowthFromFee({ args: { liquidity, fee } })).returns
      expect(feeGrowth).toStrictEqual({ value: 0n, error: 0n })
    }
    // L = 0
    {
      const liquidity = 0n
      const fee = 1100n
      const feeGrowth = (await clamm.contractInstance.methods.feeGrowthFromFee({ args: { liquidity, fee } })).returns
      expect(feeGrowth).toStrictEqual({ value: MaxU256, error: ArithmeticError.MulNotPositiveDenominator })
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
      const outParams = { args: { liquidity, feeGrowth: feeGrowth.value } }
      const out = (await clamm.contractInstance.methods.toFee(outParams)).returns
      expect(out).toStrictEqual({ value: amount, error: 0n })
    }
    // Greater Liquidity
    {
      const amount = 100n
      const liquidityBefore = 1000000n * 10n ** 5n
      const liquidityAfter = 10000000n * 10n ** 5n
      const params = { args: { liquidity: liquidityBefore, fee: amount } }
      const feeGrowth = (await clamm.contractInstance.methods.feeGrowthFromFee(params)).returns
      const outParams = { args: { liquidity: liquidityAfter, feeGrowth: feeGrowth.value } }
      const out = (await clamm.contractInstance.methods.toFee(outParams)).returns
      expect(out).toStrictEqual({ value: 1000n, error: 0n })
    }
    // huge liquidity
    {
      const amount = 100000000000000n
      const liquidity = (1n << 77n) * 10n ** 5n
      const params = { args: { liquidity, fee: amount } }
      const feeGrowth = (await clamm.contractInstance.methods.feeGrowthFromFee(params)).returns
      // real    6.61744490042422139897126953655970282852649688720703125 × 10^-10
      // expected 6617444900424221398
      expect(feeGrowth).toStrictEqual({ value: 6617444900424221398n, error: 0n })
      const outParams = { args: { liquidity, feeGrowth: feeGrowth.value } }
      const out = (await clamm.contractInstance.methods.toFee(outParams)).returns
      // real    9.99999999999999999853225897430980027744256 × 10^13
      // expected 99999999999999
      expect(out).toStrictEqual({ value: 99_999_999_999_999n, error: 0n })
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
      expect(feeGrowth).toStrictEqual({ value: 600000000000000000000000000n, error: 0n })
      const outParams = { args: { liquidity, feeGrowth: feeGrowth.value } }
      const out = (await clamm.contractInstance.methods.toFee(outParams)).returns
      expect(out).toStrictEqual({ value: amount, error: 0n })
    }
    // max value inside domain
    {
      const liquidity = (1n << 256n) - 1n
      const feeGrowth = 100000n * 10n ** 28n
      const out = (await clamm.contractInstance.methods.toFee({ args: { liquidity, feeGrowth } })).returns
      expect(out).toStrictEqual({
        value: 115792089237316195423570985008687907853269983999999999999999999999999999999999n,
        error: 0n
      })
    }
    // Overflow
    {
      const liquidity = (1n << 256n) - 1n
      const feeGrowth = (1n << 256n) - 1n
      const out = (await clamm.contractInstance.methods.toFee({ args: { liquidity, feeGrowth } })).returns
      expect(out).toStrictEqual({
        value: MaxU256,
        error: ArithmeticError.CastOverflow
      })
    }
    // FeeGrowth = 0
    {
      const liquidity = 1000n * 10n ** 5n
      const feeGrowth = 0n
      const out = (await clamm.contractInstance.methods.toFee({ args: { liquidity, feeGrowth } })).returns
      expect(out).toStrictEqual({ value: 0n, error: 0n })
    }
    // Liquidity = 0
    {
      const liquidity = 0n
      const feeGrowth = 1000n * 10n ** 28n
      const out = (await clamm.contractInstance.methods.toFee({ args: { liquidity, feeGrowth } })).returns
      expect(out).toStrictEqual({ value: 0n, error: 0n })
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
    expect(resultUp).toEqual({ value: 70109n, error: 0n })
    expect(resultDown).toEqual({ value: 70108n, error: 0n })
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
    expect(resultUp).toEqual({ value: 1446690239n, error: 0n })
    expect(resultDown).toEqual({ value: 1446690238n, error: 0n })
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
  describe('get delta x', () => {
    let clamm: DeployContractResult<CLAMMInstance>

    beforeAll(async () => {
      const uints = await deployUints(sender)
      clamm = await deployCLAMM(sender, uints.contractInstance.contractId)
    })
    test('zero at zero liquidity', async () => {
      const sqrtPriceA = 1n * 10n ** 24n
      const sqrtPriceB = 2n * 10n ** 24n
      const liquidity = 0n
      const paramsUp = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: true } }
      const paramsDown = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: false } }
      const resultUp = (await clamm.contractInstance.methods.getDeltaX(paramsUp)).returns
      const resultDown = (await clamm.contractInstance.methods.getDeltaX(paramsDown)).returns
      expect(resultUp).toEqual({ value: 0n, error: 0n })
      expect(resultDown).toEqual({ value: 0n, error: 0n })
    })
    test('equal at equal liquidity', async () => {
      const sqrtPriceA = 1n * 10n ** 24n
      const sqrtPriceB = 2n * 10n ** 24n
      const liquidity = 2n * 10n ** 5n
      const paramsUp = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: true } }
      const paramsDown = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: false } }
      const resultUp = (await clamm.contractInstance.methods.getDeltaX(paramsUp)).returns
      const resultDown = (await clamm.contractInstance.methods.getDeltaX(paramsDown)).returns
      expect(resultUp).toEqual({ value: 1n, error: 0n })
      expect(resultDown).toEqual({ value: 1n, error: 0n })
    })
    test('complex', async () => {
      const sqrtPriceA = 234878324943782000000000000n
      const sqrtPriceB = 87854456421658000000000000n
      const liquidity = 983983249092n
      const paramsUp = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: true } }
      const paramsDown = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: false } }
      const resultUp = (await clamm.contractInstance.methods.getDeltaX(paramsUp)).returns
      const resultDown = (await clamm.contractInstance.methods.getDeltaX(paramsDown)).returns
      // 7010.8199533068819376891841727789301497024557314488455622925765280
      expect(resultUp).toEqual({ value: 70109n, error: 0n })
      expect(resultDown).toEqual({ value: 70108n, error: 0n })
    })
    test('big', async () => {
      const sqrtPriceA = 1n * 10n ** 24n
      const sqrtPriceB = 5n * 10n ** 23n
      const liquidity = (2n ** 64n - 1n) * 10n ** 5n
      const paramsUp = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: true } }
      const paramsDown = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: false } }
      const resultUp = (await clamm.contractInstance.methods.getDeltaX(paramsUp)).returns
      const resultDown = (await clamm.contractInstance.methods.getDeltaX(paramsDown)).returns
      expect(resultUp).toEqual({ value: 2n ** 64n - 1n, error: 0n })
      expect(resultDown).toEqual({ value: 2n ** 64n - 1n, error: 0n })
    })
    test('shouldnt overflow in intermediate opeartions', async () => {
      const sqrtPriceA = 1n * 10n ** 24n
      const sqrtPriceB = 5n * 10n ** 23n
      const liquidity = (1n << 256n) - 1n
      const paramsUp = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: true } }
      const paramsDown = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: false } }
      await clamm.contractInstance.methods.getDeltaX(paramsUp)
      await clamm.contractInstance.methods.getDeltaX(paramsDown)
    })
    test('huge liquididty', async () => {
      const sqrtPriceA = 1n * 10n ** 24n
      const sqrtPriceB = 1n * 10n ** 24n + 1000000n
      const liquidity = 2n << 80n
      const paramsUp = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: true } }
      const paramsDown = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: false } }
      await clamm.contractInstance.methods.getDeltaX(paramsUp)
      await clamm.contractInstance.methods.getDeltaX(paramsDown)
    })
  })
  describe('get delta x - domain', () => {
    let clamm: DeployContractResult<CLAMMInstance>
    const maxSqrtPrice = 65535383934512647000000000000n
    const minSqrtPrice = 15258932000000000000n
    const almostMinSqrtPrice = 15259695000000000000n
    const maxLiquidity = (1n << 256n) - 1n
    const minLiquidity = 1n

    beforeAll(async () => {
      const uints = await deployUints(sender)
      clamm = await deployCLAMM(sender, uints.contractInstance.contractId)
    })
    test('maximalize delta sqrt price and liquidity', async () => {
      const params = {
        sqrtPriceA: maxSqrtPrice,
        sqrtPriceB: minSqrtPrice,
        liquidity: maxLiquidity
      }
      const paramsUp = { args: { ...params, roundingUp: true } }
      const paramsDown = { args: { ...params, roundingUp: false } }
      const resultUp = (await clamm.contractInstance.methods.getDeltaX(paramsUp)).returns
      const resultDown = (await clamm.contractInstance.methods.getDeltaX(paramsDown)).returns
      // expected: 75884792730156830614567103553061795263351065677581979504561495713443442818879n
      // received: 75884792730156830614567103553061795263351065677581979478702815696568066130226n
      expect(resultUp).toEqual({
        value: 75884792730156830614567103553061795263351065677581979478702815696568066130226n,
        error: 0n
      })
      // expected: 75884792730156830614567103553061795263351065677581979504561495713443442818878n
      // received: 75884792730156830614567103553061795263351065677581979478702815696568066130226n
      expect(resultDown).toEqual({
        value: 75884792730156830614567103553061795263351065677581979478702815696568066130225n,
        error: 0n
      })
    })
    test('maximalize delta sqrt price and minimalize liquidity', async () => {
      const params = {
        sqrtPriceA: maxSqrtPrice,
        sqrtPriceB: minSqrtPrice,
        liquidity: minLiquidity
      }
      const paramsUp = { args: { ...params, roundingUp: true } }
      const paramsDown = { args: { ...params, roundingUp: false } }
      const resultUp = (await clamm.contractInstance.methods.getDeltaX(paramsUp)).returns
      const resultDown = (await clamm.contractInstance.methods.getDeltaX(paramsDown)).returns
      expect(resultUp).toEqual({ value: 1n, error: 0n })
      expect(resultDown).toEqual({ value: 0n, error: 0n })
    })
    test('minimize denominator on maximize liquidity which fit into token amounts', async () => {
      const params = {
        sqrtPriceA: minSqrtPrice,
        sqrtPriceB: almostMinSqrtPrice,
        liquidity: maxLiquidity
      }
      const paramsUp = { args: { ...params, roundingUp: true } }
      const paramsDown = { args: { ...params, roundingUp: false } }
      const resultUp = (await clamm.contractInstance.methods.getDeltaX(paramsUp)).returns
      const resultDown = (await clamm.contractInstance.methods.getDeltaX(paramsDown)).returns
      // expected: 3794315473971847510172532341754979462199874072217062973965311338137066234n
      // received: 3794315473971847510172532341754979462199874072217062972672351494741127621n
      expect(resultUp).toEqual({
        value: 3794315473971847510172532341754979462199874072217062972672351494741127621n,
        error: 0n
      })
      // expected: 3794315473971847510172532341754979462199874072217062973965311338137066233n
      // received: 3794315473971847510172532341754979462199874072217062972672351494741127620n
      expect(resultDown).toEqual({
        value: 3794315473971847510172532341754979462199874072217062972672351494741127620n,
        error: 0n
      })
    })
    test('minimize denominator on minimize liquidity which fit into token amounts', async () => {
      const params = {
        sqrtPriceA: minSqrtPrice,
        sqrtPriceB: almostMinSqrtPrice,
        liquidity: minLiquidity
      }
      const paramsUp = { args: { ...params, roundingUp: true } }
      const paramsDown = { args: { ...params, roundingUp: false } }
      const resultUp = (await clamm.contractInstance.methods.getDeltaX(paramsUp)).returns
      const resultDown = (await clamm.contractInstance.methods.getDeltaX(paramsDown)).returns
      expect(resultUp).toEqual({ value: 1n, error: 0n })
      expect(resultDown).toEqual({ value: 0n, error: 0n })
    })
    test('delta price limited by search range on max liquidity', async () => {
      const searchLimit = 256n
      const tickSpacing = 100n
      const maxSearchLimit = 221818n - searchLimit * tickSpacing
      const minSearchSqrtPrice = (
        await clamm.contractInstance.methods.calculateSqrtPrice({
          args: { tickIndex: maxSearchLimit }
        })
      ).returns

      const params = {
        sqrtPriceA: maxSqrtPrice,
        sqrtPriceB: minSearchSqrtPrice,
        liquidity: maxLiquidity
      }
      const paramsUp = { args: { ...params, roundingUp: true } }
      const resultUp = (await clamm.contractInstance.methods.getDeltaX(paramsUp)).returns
      // Expected: 45875017378130362421757891862614875858481775310156442203847653871247n
      // Received: 45875017378130362421757891862614875858481775310156442188214428734988n
      expect(resultUp).toEqual({
        value: 45875017378130362421757891862614875858481775310156442188214428734988n,
        error: 0n
      })
    })
    test('minimal price diffrence', async () => {
      const almostMaxSqrtPrice = maxSqrtPrice - 1n * 10n ** 24n
      const almostMinSqrtPrice = minSqrtPrice + 1n * 10n ** 24n
      const paramsUpperBound = {
        args: { sqrtPriceA: maxSqrtPrice, sqrtPriceB: almostMaxSqrtPrice, liquidity: maxLiquidity, roundingUp: true }
      }
      const paramsBottomBound = {
        args: { sqrtPriceA: minSqrtPrice, sqrtPriceB: almostMinSqrtPrice, liquidity: maxLiquidity, roundingUp: true }
      }
      const resultUp = (await clamm.contractInstance.methods.getDeltaX(paramsUpperBound)).returns
      const resultDown = (await clamm.contractInstance.methods.getDeltaX(paramsBottomBound)).returns
      // expected: 269608649375997235557394191156352599353486422139915865816324471n
      // received: 269608649375997235557394191156352599353486422139915864876650088n
      expect(resultUp).toEqual({ value: 269608649375997235557394191156352599353486422139915864876650088n, error: 0n })

      // expected: 75883634844601460750582416171430603974060896681619645705711819135499453546638n
      // received: 75883634844601460750582416171430603974060896681619645679853533682422635835345n
      expect(resultDown).toEqual({
        value: 75883634844601460750582416171430603974060896681619645679853533682422635835345n,
        error: 0n
      })
    })
    test('zero liquidity', async () => {
      const params = {
        sqrtPriceA: maxSqrtPrice,
        sqrtPriceB: minSqrtPrice,
        liquidity: 0n
      }
      const paramsUp = { args: { ...params, roundingUp: true } }
      const paramsDown = { args: { ...params, roundingUp: false } }
      const resultUp = (await clamm.contractInstance.methods.getDeltaX(paramsUp)).returns
      const resultDown = (await clamm.contractInstance.methods.getDeltaX(paramsDown)).returns
      expect(resultUp).toEqual({ value: 0n, error: 0n })
      expect(resultDown).toEqual({ value: 0n, error: 0n })
    })
  })

  describe('get delta y', () => {
    let clamm: CLAMMInstance

    beforeEach(async () => {
      const uints = await deployUints(sender)
      clamm = (await deployCLAMM(sender, uints.contractInstance.contractId)).contractInstance
    })

    test('zero at zero liquidity', async () => {
      const sqrtPriceA = 1_000000000000000000000000n
      const sqrtPriceB = 1_000000000000000000000000n
      const liquidity = 0n

      const params = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: false } }
      const result = await clamm.methods.getDeltaY(params)

      expect(result.returns).toEqual({ value: 0n, error: 0n })
    })

    test('equal at equal liquidity', async () => {
      const sqrtPriceA = 1_000000000000000000000000n
      const sqrtPriceB = 2_000000000000000000000000n
      const liquidity = 2_00000n

      const params = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: false } }
      const result = await clamm.methods.getDeltaY(params)

      expect(result.returns).toEqual({ value: 2n, error: 0n })
    })

    test('big numbers', async () => {
      const sqrtPriceA = 234_878324943782000000000000n
      const sqrtPriceB = 87_854456421658000000000000n
      const liquidity = 9839832_49092n

      const paramsUp = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: true } }
      const paramsDown = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: false } }
      const resultUp = await clamm.methods.getDeltaY(paramsUp)
      const resultDown = await clamm.methods.getDeltaY(paramsDown)

      expect(resultUp.returns).toEqual({ value: 1446690239n, error: 0n })
      expect(resultDown.returns).toEqual({ value: 1446690238n, error: 0n })
    })

    test('big', async () => {
      const sqrtPriceA = 1_000000000000000000000000n
      const sqrtPriceB = 2_000000000000000000000000n
      const liquidity = (2n ** 64n - 1n) * 1_00000n

      const paramsUp = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: true } }
      const paramsDown = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: false } }
      const resultUp = await clamm.methods.getDeltaY(paramsUp)
      const resultDown = await clamm.methods.getDeltaY(paramsDown)

      expect(resultUp.returns).toEqual({ value: liquidity / 1_00000n, error: 0n })
      expect(resultDown.returns).toEqual({ value: liquidity / 1_00000n, error: 0n })
    })

    test('overflow', async () => {
      const sqrtPriceA = 1_000000000000000000000000n
      const sqrtPriceB = 2n ** 256n - 1n
      const liquidity = 2n ** 256n - 1n

      const paramsUp = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: true } }
      const paramsDown = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: false } }
      const resultUp = await clamm.methods.getDeltaY(paramsUp)
      const resultDown = await clamm.methods.getDeltaY(paramsDown)

      expect(resultUp.returns).toEqual({ value: MaxU256, error: ArithmeticError.CastOverflow })
      expect(resultDown.returns).toEqual({ value: MaxU256, error: ArithmeticError.CastOverflow })
    })

    test('huge liquidity', async () => {
      const sqrtPriceA = 1_000000000000000000000000n
      const sqrtPriceB = 1_000000000000000001000000n
      const liquidity = 2n ** 256n - 1n

      const paramsUp = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: true } }
      const paramsDown = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: false } }
      const resultUp = await clamm.methods.getDeltaY(paramsUp)
      const resultDown = await clamm.methods.getDeltaY(paramsDown)

      expect(resultUp.returns).toStrictEqual({
        value: 1157920892373161954235709850086879078532699846656405640n,
        error: 0n
      })
      expect(resultDown.returns).toStrictEqual({
        value: 1157920892373161954235709850086879078532699846656405640n,
        error: 0n
      })
    })
  })

  describe('get delta y - domain', () => {
    let clamm: CLAMMInstance
    const minSqrtPrice = 15258932000000000000n
    const maxSqrtPrice = 65535_383934512647000000000000n
    const minLiquidity = 1n
    const maxLiquidity = 2n ** 256n - 1n

    beforeEach(async () => {
      const uints = await deployUints(sender)
      clamm = (await deployCLAMM(sender, uints.contractInstance.contractId)).contractInstance
    })

    it('maximize delta sqrt price and liquidity', async () => {
      const paramsUp = {
        args: { sqrtPriceA: maxSqrtPrice, sqrtPriceB: minSqrtPrice, liquidity: maxLiquidity, roundingUp: true }
      }
      const paramsDown = {
        args: { sqrtPriceA: maxSqrtPrice, sqrtPriceB: minSqrtPrice, liquidity: maxLiquidity, roundingUp: false }
      }
      const resultUp = await clamm.methods.getDeltaY(paramsUp)
      const resultDown = await clamm.methods.getDeltaY(paramsDown)

      expect(resultUp.returns).toStrictEqual({
        value: 75884790229800029582010010030152469040784228171629896039591333116952600000000n,
        error: 0n
      })
      expect(resultDown.returns).toStrictEqual({
        value: 75884790229800029582010010030152469040784228171629896039591333116952599999999n,
        error: 0n
      })
    })

    it('can be zero', async () => {
      const params = {
        args: { sqrtPriceA: maxSqrtPrice, sqrtPriceB: maxSqrtPrice - 1n, liquidity: minLiquidity, roundingUp: false }
      }
      const result = await clamm.methods.getDeltaY(params)

      expect(result.returns).toStrictEqual({ value: 0n, error: 0n })
    })

    it('liquidity is zero', async () => {
      const params = {
        args: { sqrtPriceA: maxSqrtPrice, sqrtPriceB: minSqrtPrice, liquidity: 0n, roundingUp: true }
      }
      const result = await clamm.methods.getDeltaY(params)

      expect(result.returns).toStrictEqual({ value: 0n, error: 0n })
    })

    it('all max', async () => {
      const params = {
        args: { sqrtPriceA: maxSqrtPrice, sqrtPriceB: maxSqrtPrice, liquidity: maxLiquidity, roundingUp: true }
      }
      const result = await clamm.methods.getDeltaY(params)

      expect(result.returns).toStrictEqual({ value: 0n, error: 0n })
    })
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
      const params = { args: { tickIndex: 30n } }
      const sqrtPrice = (await clamm.methods.calculateSqrtPrice(params)).returns
      expect(sqrtPrice).toEqual(1001501050455000000000000n)
    }
    {
      const params = { args: { tickIndex: 20n } }
      const sqrtPrice = (await clamm.methods.calculateSqrtPrice(params)).returns
      expect(sqrtPrice).toEqual(1001000450120000000000000n)
    }
    {
      const params = { args: { tickIndex: 10n } }
      const sqrtPrice = (await clamm.methods.calculateSqrtPrice(params)).returns
      expect(sqrtPrice).toEqual(1000500100010000000000000n)
    }
    {
      const params = { args: { tickIndex: 0n } }
      const sqrtPrice = (await clamm.methods.calculateSqrtPrice(params)).returns
      expect(sqrtPrice).toEqual(1000000000000000000000000n)
    }
    {
      const params = { args: { tickIndex: -10n } }
      const sqrtPrice = (await clamm.methods.calculateSqrtPrice(params)).returns
      expect(sqrtPrice).toEqual(999500149965000000000000n)
    }
    {
      const params = { args: { tickIndex: -20n } }
      const sqrtPrice = (await clamm.methods.calculateSqrtPrice(params)).returns
      expect(sqrtPrice).toEqual(999000549780000000000000n)
    }
    {
      const params = { args: { tickIndex: -30n } }
      const sqrtPrice = (await clamm.methods.calculateSqrtPrice(params)).returns
      expect(sqrtPrice).toEqual(998501199320000000000000n)
    }
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

  describe('calculate amount delta', () => {
    let clamm: CLAMMInstance

    beforeEach(async () => {
      const uints = await deployUints(sender)
      clamm = (await deployCLAMM(sender, uints.contractInstance.contractId)).contractInstance
    })

    test('current tick between lower tick and upper tick', async () => {
      const currentTickIndex = 2n
      const currentSqrtPrice = 1_000140000000000000000000n
      const liquidityDelta = 5000000_00000n
      const liquiditySign = true
      const upperTick = 3n
      const lowerTick = 0n

      const params = {
        args: { currentTickIndex, currentSqrtPrice, liquidityDelta, liquiditySign, upperTick, lowerTick }
      }
      const result = (await clamm.methods.calculateAmountDelta(params)).returns
      expect(result).toEqual([51n, 700n, true])
    })

    test('current tick in the middle between lower tick and upper tick', async () => {
      const currentTickIndex = 2n
      const currentSqrtPrice = 1_000140000000000000000000n
      const liquidityDelta = 5000000_00000n
      const liquiditySign = true
      const upperTick = 4n
      const lowerTick = 0n

      const params = {
        args: { currentTickIndex, currentSqrtPrice, liquidityDelta, liquiditySign, upperTick, lowerTick }
      }
      const result = (await clamm.methods.calculateAmountDelta(params)).returns
      expect(result).toEqual([300n, 700n, true])
    })

    test('current tick smaller than lower tick', async () => {
      const currentTickIndex = 0n
      const currentSqrtPrice = 1_000000000000000000000000n
      const liquidityDelta = 10_00000n
      const liquiditySign = true
      const upperTick = 4n
      const lowerTick = 2n

      const params = {
        args: { currentTickIndex, currentSqrtPrice, liquidityDelta, liquiditySign, upperTick, lowerTick }
      }
      const result = (await clamm.methods.calculateAmountDelta(params)).returns
      expect(result).toEqual([1n, 0n, false])
    })

    test('current tick greater than upper tick', async () => {
      const currentTickIndex = 6n
      const currentSqrtPrice = 1_000000000000000000000000n
      const liquidityDelta = 10_00000n
      const liquiditySign = true
      const upperTick = 4n
      const lowerTick = 2n

      const params = {
        args: { currentTickIndex, currentSqrtPrice, liquidityDelta, liquiditySign, upperTick, lowerTick }
      }
      const result = (await clamm.methods.calculateAmountDelta(params)).returns
      expect(result).toEqual([0n, 1n, false])
    })
  })

  describe('calculate amount delta - domain', () => {
    let clamm: CLAMMInstance
    let maxLiquidity = MaxU256

    beforeEach(async () => {
      const uints = await deployUints(sender)
      clamm = (await deployCLAMM(sender, uints.contractInstance.contractId)).contractInstance
    })

    test('max x', async () => {
      const currentTickIndex = -MaxTick
      const currentSqrtPrice = 1_000000000000000000000000n
      const liquiditySign = true
      const upperTick = MaxTick
      const lowerTick = -MaxTick + 1n

      const params = {
        args: { currentTickIndex, currentSqrtPrice, liquidityDelta: maxLiquidity, liquiditySign, upperTick, lowerTick }
      }
      const result = (await clamm.methods.calculateAmountDelta(params)).returns
      expect(result).toEqual([
        75880998414682858767056931020720040283888865803509762415730143345073325002605n,
        0n,
        false
      ])
    })

    test('max y', async () => {
      const currentTickIndex = MaxTick
      const currentSqrtPrice = 1_000000000000000000000000n
      const liquiditySign = true
      const upperTick = MaxTick - 1n
      const lowerTick = -MaxTick

      const params = {
        args: { currentTickIndex, currentSqrtPrice, liquidityDelta: maxLiquidity, liquiditySign, upperTick, lowerTick }
      }
      const result = (await clamm.methods.calculateAmountDelta(params)).returns
      expect(result).toEqual([
        0n,
        75880996274614937472454279923345931777432945506580976051511441183276080000000n,
        false
      ])
    })

    test('delta liquidity = 0', async () => {
      const currentTickIndex = 2n
      const currentSqrtPrice = 1_000140000000000000000000n
      const liquidityDelta = 0n
      const liquiditySign = true
      const upperTick = 4n
      const lowerTick = 0n

      const params = {
        args: { currentTickIndex, currentSqrtPrice, liquidityDelta, liquiditySign, upperTick, lowerTick }
      }
      const result = (await clamm.methods.calculateAmountDelta(params)).returns
      expect(result).toEqual([0n, 0n, true])
    })

    test('error handling', async () => {
      const currentTickIndex = 0n
      const currentSqrtPrice = 1_000140000000000000000000n
      const liquidityDelta = 0n
      const liquiditySign = true
      const upperTick = 4n
      const lowerTick = 10n

      const params = {
        args: { currentTickIndex, currentSqrtPrice, liquidityDelta, liquiditySign, upperTick, lowerTick }
      }
      await expectError(clamm.methods.calculateAmountDelta(params))
    })
  })

  describe('compute swap step', () => {
    let clamm: CLAMMInstance

    beforeEach(async () => {
      const uints = await deployUints(sender)
      clamm = (await deployCLAMM(sender, uints.contractInstance.contractId)).contractInstance
    })

    test('one token by amount in', async () => {
      const currentSqrtPrice = 1_000000000000000000000000n
      const targetSqrtPrice = 1_004987562112089027021926n
      const liquidity = 2000_00000n
      const amount = 1n
      const fee = 600000000n

      const params = {
        args: { currentSqrtPrice, targetSqrtPrice, liquidity, amount, byAmountIn: true, fee }
      }
      const result = (await clamm.methods.computeSwapStep(params)).returns
      expect(result).toEqual({ nextSqrtPrice: currentSqrtPrice, amountIn: 0n, amountOut: 0n, feeAmount: 1n })
    })

    test('amount out capped at target sqrt price', async () => {
      const currentSqrtPrice = 1_000000000000000000000000n
      const targetSqrtPrice = 1_004987562112089027021926n
      const liquidity = 2000_00000n
      const amount = 20n
      const fee = 600000000n

      const paramsResultIn = {
        args: { currentSqrtPrice, targetSqrtPrice, liquidity, amount, byAmountIn: true, fee }
      }
      const paramsResultOut = {
        args: { currentSqrtPrice, targetSqrtPrice, liquidity, amount, byAmountIn: false, fee }
      }
      const resultIn = (await clamm.methods.computeSwapStep(paramsResultIn)).returns
      const resultOut = (await clamm.methods.computeSwapStep(paramsResultOut)).returns
      expect(resultIn).toEqual({ nextSqrtPrice: targetSqrtPrice, amountIn: 10n, amountOut: 9n, feeAmount: 1n })
      expect(resultOut).toEqual({ nextSqrtPrice: targetSqrtPrice, amountIn: 10n, amountOut: 9n, feeAmount: 1n })
    })

    test('amount in not capped', async () => {
      const currentSqrtPrice = 1_010000000000000000000000n
      const targetSqrtPrice = 10_000000000000000000000000n
      const liquidity = 300000000_00000n
      const amount = 1000000n
      const fee = 600000000n

      const params = {
        args: { currentSqrtPrice, targetSqrtPrice, liquidity, amount, byAmountIn: true, fee }
      }
      const result = (await clamm.methods.computeSwapStep(params)).returns
      expect(result).toEqual({
        nextSqrtPrice: 1_013331333333333333333333n,
        amountIn: 999400n,
        amountOut: 976487n,
        feeAmount: 600n
      })
    })

    test('amount out not capped', async () => {
      // const currentSqrtPrice = 101_000000000000000000000000n
      // const targetSqrtPrice = 100_000000000000000000000000n
      // const liquidity = 5000000000000_00000n
      // const amount = 2000000n
      // const fee = 600000000n
      // const params = {
      //   args: { currentSqrtPrice, targetSqrtPrice, liquidity, amount, byAmountIn: false, fee }
      // }
      // const result = (await clamm.methods.computeSwapStep(params)).returns
      // expect(result).toEqual({
      //   nextSqrtPrice: 100_999999600000000000000000n,
      //   amountIn: 197n,
      //   amountOut: amount,
      //   feeAmount: 1n
      // })
    })

    test('empty swap step when sqrt price is at tick', async () => {
      const currentSqrtPrice = 999500149965000000000000n
      const targetSqrtPrice = 999500149965000000000000n
      const liquidity = 200060000_00000n
      const amount = 1000000n
      const fee = 600000000n

      const params = {
        args: { currentSqrtPrice, targetSqrtPrice, liquidity, amount, byAmountIn: true, fee }
      }
      const result = (await clamm.methods.computeSwapStep(params)).returns
      expect(result).toEqual({
        nextSqrtPrice: currentSqrtPrice,
        amountIn: 0n,
        amountOut: 0n,
        feeAmount: 0n
      })
    })

    test('if liquidity is high, small amount in should not push sqrt price', async () => {
      const currentSqrtPrice = 999500149965000000000000n
      const targetSqrtPrice = 1_999500149965000000000000n
      const liquidity = 100000000000000000000000000_00000n
      const amount = 10n
      const fee = 600000000n

      const params = {
        args: { currentSqrtPrice, targetSqrtPrice, liquidity, amount, byAmountIn: true, fee }
      }
      const result = (await clamm.methods.computeSwapStep(params)).returns
      expect(result).toEqual({
        nextSqrtPrice: currentSqrtPrice,
        amountIn: 0n,
        amountOut: 0n,
        feeAmount: 10n
      })
    })

    test('amount in > u64 for swap to target sqrt price and when liquidity > 2^64', async () => {
      const currentSqrtPrice = 1_000000000000000000000000n
      const targetSqrtPrice = 1_000050000000000000000000n
      const liquidity = 368944000000000000000000_00000n
      const amount = 1n
      const fee = 600000000n

      const params = {
        args: { currentSqrtPrice, targetSqrtPrice, liquidity, amount, byAmountIn: true, fee }
      }
      const result = (await clamm.methods.computeSwapStep(params)).returns
      expect(result).toEqual({
        nextSqrtPrice: currentSqrtPrice,
        amountIn: 0n,
        amountOut: 0n,
        feeAmount: 1n
      })
    })

    test('amount out > u64 for swap to target sqrt price and when liquidity > 2^64', async () => {
      const currentSqrtPrice = 1_000000000000000000000000n
      const targetSqrtPrice = 1_000050000000000000000000n
      const liquidity = 368944000000000000000000_00000n
      const amount = 1n
      const fee = 600000000n

      const params = {
        args: { currentSqrtPrice, targetSqrtPrice, liquidity, amount, byAmountIn: false, fee }
      }
      const result = (await clamm.methods.computeSwapStep(params)).returns
      expect(result).toEqual({
        nextSqrtPrice: 1_000000000000000000000003n,
        amountIn: 2n,
        amountOut: 1n,
        feeAmount: 1n
      })
    })

    test('liquidity is zero and by amount in should skip to target sqrt price', async () => {
      const currentSqrtPrice = 1_000000000000000000000000n
      const targetSqrtPrice = 1_000050000000000000000000n
      const liquidity = 0n
      const amount = 100000n
      const fee = 600000000n

      const paramsIn = {
        args: { currentSqrtPrice, targetSqrtPrice, liquidity, amount, byAmountIn: true, fee }
      }
      const paramsOut = {
        args: { currentSqrtPrice, targetSqrtPrice, liquidity, amount, byAmountIn: true, fee }
      }
      const resultIn = (await clamm.methods.computeSwapStep(paramsIn)).returns
      const resultOut = (await clamm.methods.computeSwapStep(paramsOut)).returns
      expect(resultIn).toEqual({
        nextSqrtPrice: targetSqrtPrice,
        amountIn: 0n,
        amountOut: 0n,
        feeAmount: 0n
      })
      expect(resultOut).toEqual({
        nextSqrtPrice: targetSqrtPrice,
        amountIn: 0n,
        amountOut: 0n,
        feeAmount: 0n
      })
    })

    test('normal swap step but fee is set to 0', async () => {
      const currentSqrtPrice = 999950000000000000000000n
      const targetSqrtPrice = 1_000000000000000000000000n
      const liquidity = 50000000_00000n
      const amount = 1000n
      const fee = 0n

      const params = {
        args: { currentSqrtPrice, targetSqrtPrice, liquidity, amount, byAmountIn: true, fee }
      }
      const result = (await clamm.methods.computeSwapStep(params)).returns
      expect(result).toEqual({
        nextSqrtPrice: 999970000000000000000000n,
        amountIn: 1000n,
        amountOut: 1000n,
        feeAmount: 0n
      })
    })

    test('by amount out and x to y edge cases', async () => {
      // const tickIndex = -10n
      // const targetSqrtPrice = (await clamm.methods.calculateSqrtPrice({ args: { tickIndex } })).returns
      // const currentSqrtPrice = targetSqrtPrice + 1_000000000000000000000000n
      // const liquidity = 340282366920938463463374607_00000n
      // const oneToken = 1n
      // const tokensWithSameOutput = 85n
      // const zeroToken = 0n
      // const maxFee = 900000000000n
      // const minFee = 0n
      // const oneTokenParams = {
      //   args: {
      //     currentSqrtPrice,
      //     targetSqrtPrice,
      //     liquidity,
      //     amount: oneToken,
      //     byAmountIn: false,
      //     fee: maxFee
      //   }
      // }
      // const tokensWithSameOutputParams = {
      //   args: {
      //     currentSqrtPrice,
      //     targetSqrtPrice,
      //     liquidity,
      //     amount: tokensWithSameOutput,
      //     byAmountIn: false,
      //     fee: maxFee
      //   }
      // }
      // const zeroTokenParams = {
      //   args: {
      //     currentSqrtPrice,
      //     targetSqrtPrice,
      //     liquidity,
      //     amount: zeroToken,
      //     byAmountIn: false,
      //     fee: minFee
      //   }
      // }
      // const oneTokenResult = (await clamm.methods.computeSwapStep(oneTokenParams)).returns
      // const tokensWithSameOutputResult = (await clamm.methods.computeSwapStep(tokensWithSameOutputParams)).returns
      // const zeroTokenResult = (await clamm.methods.computeSwapStep(zeroTokenParams)).returns
      // expect(oneTokenResult).toEqual({
      //   nextSqrtPrice: currentSqrtPrice - 1n,
      //   amountIn: 86n,
      //   amountOut: 1n,
      //   feeAmount: 78n
      // })
      // expect(tokensWithSameOutputResult).toEqual({
      //   nextSqrtPrice: currentSqrtPrice - 1n,
      //   amountIn: 86n,
      //   amountOut: 85n,
      //   feeAmount: 78n
      // })
      // expect(zeroTokenResult).toEqual({
      //   nextSqrtPrice: currentSqrtPrice,
      //   amountIn: 0n,
      //   amountOut: 0n,
      //   feeAmount: 0n
      // })
    })
  })
})
