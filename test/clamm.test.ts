import { DeployContractResult, ONE_ALPH, web3 } from '@alephium/web3'
import { getSigner } from '@alephium/web3-test'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { assert } from 'console'
import { CLAMMInstance } from '../artifacts/ts'
import { deployCLAMM, expectError } from '../src/utils'

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

let sender: PrivateKeyWallet

describe('math tests', () => {
  beforeAll(async () => {
    sender = await getSigner(ONE_ALPH * 100000n, 0)
  })

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
  test('fee growth from fee - domain', async () => {
    const clamm = await deployCLAMM(sender)

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
    const clamm = await deployCLAMM(sender)
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
    const clamm = await deployCLAMM(sender)
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
  describe('get delta x', () => {
    let clamm: DeployContractResult<CLAMMInstance>

    beforeAll(async () => {
      clamm = await deployCLAMM(sender)
    })
    test('zero at zero liquidity', async () => {
      const sqrtPriceA = 1n * 10n ** 24n
      const sqrtPriceB = 2n * 10n ** 24n
      const liquidity = 0n
      const paramsUp = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: true } }
      const paramsDown = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: false } }
      const resultUp = (await clamm.contractInstance.methods.getDeltaX(paramsUp)).returns
      const resultDown = (await clamm.contractInstance.methods.getDeltaX(paramsDown)).returns
      expect(resultUp).toEqual(0n)
      expect(resultDown).toEqual(0n)
    })
    test('equal at equal liquidity', async () => {
      const sqrtPriceA = 1n * 10n ** 24n
      const sqrtPriceB = 2n * 10n ** 24n
      const liquidity = 2n * 10n ** 5n
      const paramsUp = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: true } }
      const paramsDown = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: false } }
      const resultUp = (await clamm.contractInstance.methods.getDeltaX(paramsUp)).returns
      const resultDown = (await clamm.contractInstance.methods.getDeltaX(paramsDown)).returns
      expect(resultUp).toEqual(1n)
      expect(resultDown).toEqual(1n)
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
      expect(resultUp).toEqual(70109n)
      expect(resultDown).toEqual(70108n)
    })
    test('big', async () => {
      const sqrtPriceA = 1n * 10n ** 24n
      const sqrtPriceB = 5n * 10n ** 23n
      const liquidity = (2n ** 64n - 1n) * 10n ** 5n
      const paramsUp = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: true } }
      const paramsDown = { args: { sqrtPriceA, sqrtPriceB, liquidity, roundingUp: false } }
      const resultUp = (await clamm.contractInstance.methods.getDeltaX(paramsUp)).returns
      const resultDown = (await clamm.contractInstance.methods.getDeltaX(paramsDown)).returns
      expect(resultUp).toEqual(2n ** 64n - 1n)
      expect(resultDown).toEqual(2n ** 64n - 1n)
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
      clamm = await deployCLAMM(sender)
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
      expect(resultUp).toEqual(75884792730156830614567103553061795263351065677581979478702815696568066130226n)
      // expected: 75884792730156830614567103553061795263351065677581979504561495713443442818878n
      // received: 75884792730156830614567103553061795263351065677581979478702815696568066130226n
      expect(resultDown).toEqual(75884792730156830614567103553061795263351065677581979478702815696568066130225n)
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
      expect(resultUp).toEqual(1n)
      expect(resultDown).toEqual(0n)
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
      expect(resultUp).toEqual(3794315473971847510172532341754979462199874072217062972672351494741127621n)
      // expected: 3794315473971847510172532341754979462199874072217062973965311338137066233n
      // received: 3794315473971847510172532341754979462199874072217062972672351494741127620n
      expect(resultDown).toEqual(3794315473971847510172532341754979462199874072217062972672351494741127620n)
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
      expect(resultUp).toEqual(1n)
      expect(resultDown).toEqual(0n)
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
      expect(resultUp).toEqual(45875017378130362421757891862614875858481775310156442188214428734988n)
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
      expect(resultUp).toEqual(269608649375997235557394191156352599353486422139915864876650088n)

      // expected: 75883634844601460750582416171430603974060896681619645705711819135499453546638n
      // received: 75883634844601460750582416171430603974060896681619645679853533682422635835345n
      expect(resultDown).toEqual(75883634844601460750582416171430603974060896681619645679853533682422635835345n)
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
      expect(resultUp).toEqual(0n)
      expect(resultDown).toEqual(0n)
    })
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
      clamm = (await deployCLAMM(sender)).contractInstance
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
      clamm = (await deployCLAMM(sender)).contractInstance
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
})
